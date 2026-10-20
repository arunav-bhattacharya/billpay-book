---
title: Building Dispatchers and the Governor
description: 'A dispatcher is a small workflow that turns due work into workflow starts, at the rate the governor sets.'
sidebar_label: Dispatchers and Governor
---

import Lead from '@site/src/components/Lead';

# Building Dispatchers and the Governor

<Lead>A dispatcher is a small workflow that turns due work into workflow starts, at the rate the governor sets. Eight of them share one shape, and this page builds it: the loop, the activity that claims and starts, the heartbeat that makes a crash harmless, and the governor's check that feeds them all.</Lead>

[Design → Pacing](../design/pacing.md) explains why offline work is paced, what each dispatcher releases and how a tick runs. This page is about writing the code. The table it claims from, its indexes and the claim's SQL are on [Database](./database.md#the-work-tracker).

## One workflow, one activity

A dispatcher is two pieces. The workflow runs on the Offline cluster and loops over ticks. Each tick is one activity, `claimAndStart`, on the dispatcher's own control queue, such as `ctl-sched` or `ctl-leg`, so one kind of work can't hold up another.

The workflow holds no rows and starts nothing itself. Starting a workflow is I/O, and [workflow code has to stay deterministic](./core-build/workflows.md#why-workflow-code-must-be-deterministic), so every claim and every start happens inside the activity. The workflow only adds up counts and decides whether to go round again. A sketch, with illustrative names:

```kotlin
class DispatcherWorkflowImpl : DispatcherWorkflow {
    private val dispatch = Workflow.newActivityStub(
        DispatchActivities::class.java,
        controlQueueOptions,                       // its ctl-* queue, a 10 s heartbeat timeout
    )

    override fun run(kind: DispatchKind, sofar: Counts) {
        var total = sofar
        while (true) {
            val tick = dispatch.claimAndStart(kind)
            total += tick
            if (tick.claimed == 0) {
                dispatch.sweep(kind)                // this run's rows still DISPATCHING
                return                              // nothing due: the run ends
            }
            if (Workflow.getInfo().isContinueAsNewSuggested) {
                Workflow.continueAsNew(kind, total)
            }
        }
    }
}
```

An empty claim ends the run, and the next trigger of its [Schedule](./schedules.md) starts a fresh one. That keeps every run short, with a small history, instead of one workflow that waits forever.

## Writing claimAndStart

One tick is about 20 seconds of work at the current rate: 50 TPS gives 1,000 rows. The activity claims them, starts one workflow per row through the Router, and keeps the pace with a token bucket, so 50 TPS is one start every 20 ms.

```kotlin
override fun claimAndStart(kind: DispatchKind): Counts {
    val ctx = Activity.getExecutionContext()
    val resume = ctx.getHeartbeatDetails(Position::class.java).orElse(null)
    val rows = resume?.rows ?: store.claim(kind, limit = rates.allowed(kind) * 20, runId(ctx))
    val bucket = TokenBucket(rates.allowed(kind))
    val started = mutableListOf<WorkRow>()

    for (i in (resume?.next ?: 0) until rows.size) {
        if (i % 50 == 0) {                                   // every 50 or so starts
            bucket.rate = rates.allowed(kind)                // a new rate lands within seconds
            while (store.inFlight(kind) >= cap(kind)) {      // backpressure
                beat(ctx, Position(rows, i))
                Thread.sleep(500)
            }
        }
        bucket.acquire { beat(ctx, Position(rows, i)) }      // heartbeat while it waits, too
        when (router.route(DueRow(rows[i]))) {               // admit, pin, choose the run site, start
            Started, AlreadyStarted -> started += rows[i]    // already started counts as done
            Refused -> store.markFailed(rows[i])             // its market was taken out of service
        }
        beat(ctx, Position(rows, i + 1))                     // the SDK throttles what it sends
    }
    store.markDispatched(started)                            // guarded on DISPATCHING
    return Counts(claimed = rows.size, started = started.size)
}
```

The heartbeat carries the tick's position, and that position is what a retry resumes from. The SDK throttles how often heartbeats actually reach the server, so the last recorded position can be a few seconds behind. That costs nothing: the retry repeats a few starts, and a start that is already running counts as done. The rest of the sketch is the part that's easy to get wrong:

- Every status change on a Work Tracker row is a guarded update, like every other status change in Oracle. Marking a row `DISPATCHED` applies only while it is still `DISPATCHING`, so it never overwrites a row that a fast workflow has already closed as `DONE`.
- The Router sets the workflow ID from the row: the payment ID plus its suffix, such as `{paymentId}-execute`. With reuse policy `REJECT_DUPLICATE`, a row released twice can't execute its payment twice, and a start that fails as already started is a success, not an error.
- The tick waits on the in-flight cap before it starts more work, never after. The real rate then settles at the cap divided by the time a payment takes, which is the whole point of the cap.
- A row the Router refuses goes to `FAILED`, which raises the retries-exhausted alert. That only happens when its market was taken out of service after the row was written.

### When a worker dies mid-tick

The heartbeat timeout is 10 seconds. A worker that dies mid-tick misses it, Temporal retries the activity on another worker, and the retry reads the last heartbeat's position and carries on from there. It doesn't claim again, and the rows it already started fail as already started, which counts as done.

Rows that were claimed but never started stay `DISPATCHING`. The sweep at the end of the run starts them again, and the next run catches anything the sweep missed. Again, a start that finds its workflow already running counts as done, so nothing runs twice.

## The inbox dispatchers

The AR intake, returns and inbound dispatchers run the same loop against One-Data's inbox instead of the Work Tracker, through [One-Data's inbox functions](./api-spec/one-data.md#inbox-functions):

| Work Tracker dispatcher | Inbox dispatcher |
| --- | --- |
| Claims rows with `FOR UPDATE SKIP LOCKED`, stamped with its run | Reads `READY` requests with `ReadStartRequests.v1`. Nothing is claimed: its Schedule allows one run at a time, and a repeated start counts as done |
| Marks rows `DISPATCHED` | Marks requests `DONE` with `UpdateStartRequests.v1` once started, or `REJECTED` when the Router can't admit them, which raises an alert for operations |
| Caps its in-flight work | Has no in-flight cap, because no Work Tracker row counts its work. The governor's rate paces it, and drops to zero while RTF calls fail or a downstream it calls is out |

The workflow ID comes from the request: the payment ID in its idempotency key, or for a return, the returned payment and its presentment sequence. A request that arrives twice finds the same workflow. The request's body is the workflow's start input, so the workflow never reads the inbox itself.

## Rates and overrides

The activity reads the dispatcher's row in `rate_allocation` every few seconds. The governor writes that row every 15 seconds, so a new rate reaches a running tick within seconds, with no signal and no extra workflow history.

Operators override the governor through the ops API: pause, resume, or a maximum rate. An override is a row in `rate_allocation` too, and it always wins over the governor's. If the governor itself stops, its rows go stale, and once a row is 5 minutes old the dispatchers fall back to their floors instead of running on a rate nobody is watching.

## The leg dispatcher's two extra jobs

The leg dispatcher starts corporate legs like any other dispatcher, and it does two more things on the side.

- Once a parent's Execute marks it released, the dispatcher writes the legs of every batch stored for that payment, 1,000 rows at a time, each leg with its `SCHEDULED` `ALLOC_LEG` row, through `PaymentStore`. It heartbeats its position as it goes, and each batch records when its legs were written, so a retried release writes nothing twice.
- Every 60 seconds it counts legs by status for the parents still `PROCESSING`. Once every batch of a parent has its legs and every leg is `PROCESSED` or `PAID`, it sends the parent's RTF event and Raven message, then moves the parent to `PROCESSED` with a guarded update.

## The governor

`GovernorWorkflow` runs on the Offline cluster with the workflow ID `governor` plus the trigger time its Schedule appends, on `ctl-governor`. A Schedule with overlap policy SKIP starts it again if it isn't running. Every 15 seconds one activity reads Prometheus and Oracle, decides, and writes the result. It continues-as-new every hour and costs about 20 Temporal writes a minute.

```kotlin
class GovernorWorkflowImpl : GovernorWorkflow {
    private val check = Workflow.newActivityStub(GovernorActivities::class.java, governorOptions)

    override fun run(state: GovernorState) {
        var s = state
        val started = Workflow.currentTimeMillis()
        while (Workflow.currentTimeMillis() - started < HOUR) {
            s = check.decideAndApply(s)          // read, decide, write; one activity per check
            Workflow.sleep(Duration.ofSeconds(15))
        }
        Workflow.continueAsNew(s)
    }
}
```

The decision is plain code inside the activity, and it should read like the rules on [Design → Pacing](../design/pacing.md#the-governor), which hold the signal bands and the order the budget is handed out in:

1. Read the five signals. The worst one decides: raise, hold or cut.
2. Raise the budget by 5%, but only after two calm checks in a row, because the metrics lag about 30 seconds. Cut it by multiplying by 0.8. Offline Aurora CPU over 70%, or online p99 over its SLO, halves it instead.
3. Keep the budget in Temporal writes per second, never above the ceiling the load test measured, and charge each class its cost per workflow.
4. Hand it out in order: online first, then the SEPA cutoff floor, the US floor, AR intake, and the rest by priority up to their demand. Cap every class by its downstreams' offline share.
5. Write the rates to `rate_allocation`, change a downstream queue's limit through the task queue config API only when it moves, and record the inputs and outputs in a `governor_decision` row, so any rate can be explained later.

Missing metrics mean hold. Still missing after 5 minutes, the governor drops every class to its floor. Overrides always win, here as in the dispatchers.

## Sizing

- A tick costs about 5 Temporal writes. Releasing a million payments at 50 TPS takes about 1,000 ticks, so about 5,000 writes, against the millions the payments write themselves.
- One activity can issue a few hundred starts a second. Past that, split a dispatcher into lanes, each owning a hash bucket of `ref_id` at the rate divided by the number of lanes.
- The execution cap starts at 1,000 payments in flight, and the load test tunes it.
