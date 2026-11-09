---
title: Building Activities
description: 'An activity makes the calls to one system, and nothing else.'
sidebar_label: Activities
---

import Lead from '@site/src/components/Lead';

# Building Activities

<Lead>An activity makes the calls to one system, and nothing else. It is the only layer that touches the world, so writing one well comes down to three habits: take an ID, make every call safe to repeat, and leave the retrying to Temporal.</Lead>

[Design → Activities](../../design/component-model/activities.md) has the catalogue: every interface, its system, its task queue and the stages that call it, and the retry rules. This page shows how to write one.

## One interface per system

Each system gets one interface, `{System}Activities`, in `core/lib/activities/`, with its implementation in `impl/`. `ClearingActivities` talks to clearing, `ReceivablesActivities` to Accounts Receivable, and so on. The implementation calls that system's [client](./clients.md), and the client owns the wire format. Activities are shared by every market and never vary by behavior: that is the stage's job.

```kotlin
@ActivityInterface
interface ClearingActivities {
    fun clear(paymentId: String): ClearingResult
}

class ClearingActivitiesImpl(
    private val store: PaymentStoreReader,
    private val client: ClearingClient,
) : ClearingActivities {

    override fun clear(paymentId: String): ClearingResult {
        val p = store.forClearing(paymentId)                 // load what this call needs
        return try {
            client.clear(p, idempotencyKey = "$paymentId-clear")
        } catch (e: TooManyRequests) {
            // Wait out Retry-After, plus up to 250 ms of jitter (Proposed), instead of the policy's interval.
            throw ApplicationFailure.newFailureWithCauseAndDelay(
                "429 from clearing", "RateLimited", e, e.retryAfter.plusMillis(jitter()))
        }
    }
}
```

*(A sketch: the interface and the idempotency key follow the spec; the other names are illustrative.)*

Three things in that sketch are rules, not style:

- The activity takes the payment ID and loads what it needs, or a small value it needs, such as the money movement, when that saves a database read (agreed 2026-11-08). Its inputs are recorded in workflow history, so passing whole payment objects would bloat every history and freeze old data into it. Capture's `PaymentStore` call takes the request the workflow was started with, because nothing is in Oracle yet. And data from Payment Options and Payment Instruments reaches a later call that needs it, such as open-to-buy or the notifications in Fulfil, from the stage, with the payload codec keeping it encrypted in history.
- Every HTTP call carries an idempotency key such as `{paymentId}-{step}`. An activity can be retried after a timeout even when its call went through, and the key is what makes the second call harmless.
- The HTTP client has its own retries off. One task is one call, so a queue's rate limit stays the real call rate, and Temporal decides when to try again.

## Options belong to the stub

Where an activity runs, how long a call may take and how it retries are set on the stub the stage creates, not inside the activity:

```kotlin
private val clearing = Workflow.newActivityStub(
    ClearingActivities::class.java,
    ActivityOptions.newBuilder()
        .setTaskQueue("ds-clearing")                            // the rate-limited queue, on either cluster
        .setStartToCloseTimeout(Duration.ofSeconds(6))          // just above the 5 s HTTP timeout (Proposed)
        .setRetryOptions(RetryOptions.newBuilder()
            .setInitialInterval(Duration.ofSeconds(6))           // the first retry after 6 s, doubling,
            .setMaximumInterval(Duration.ofMinutes(45))          // at most 45 minutes apart
            .setDoNotRetry(BusinessFailure::class.java.name)     // a decline is final
            .build())
        .build(),
)
```

A call to a throttled system runs on that system's `ds-*` queue, whose server-side limit is the throttle. That holds on both clusters: Execute's and Fulfil's calls on the Online cluster are always rate-limited too, at the limits the governor sets (agreed 2026-11-07). A call nobody throttles, such as RTF or Payment Instruments, runs on the workflow's own queue with eager dispatch.

Every downstream HTTP call in Execute and Fulfil times out at 5 s, and its activity's start-to-close sits just above that (Proposed: 6 s), so the HTTP timeout fires first and a hung call frees its slot (agreed 2026-11-07). Verify's calls keep a shorter start-to-close, about 2 to 3 times the call's p99. Payment Instruments, Payment Options and Plans answer within 300 to 400 ms at p99 (agreed 2026-11-07), so Verify's start-to-close is at most about 1.2 s, held in a setting of its own (Proposed, 2026-11-08: a 1 s HTTP timeout under it). The schedule-to-close limit decides when to give up.

Which HTTP answers are business failures, and so never retried, is set per contract. Until the contracts arrive, a 422 is the only one, and every other error retries (Proposed, 2026-11-07).

## The decision's calls on the Online cluster

A caller on the Online cluster waits for Verify's decision, so the calls that make it run as local activities: Payment Instruments, Payment Options and Plans in Verify, the card provider's authorization in Verify for a debit card, and the provider in RequestConfirmation. A local activity runs in the worker that holds the workflow task, with no trip through a task queue. Capture, Verify's calls and Verify's commit all finish inside the workflow's first task, and the caller's answer comes straight out of it. Together they cost about 2 history writes, where Verify's k calls as regular activities would cost about 2k + 3.

Only a system without a rate limit can be called this way, because a local activity skips the queue and with it the queue's limit. None of these has one. The card authorization debits the customer's account, so it carries the payment ID as its idempotency key, and a retry gets the first answer back instead of a second debit (Proposed). The stage resolver makes the stubs, and picks each one by the cluster the workflow runs on. On the Online cluster a Verify call gets 2 attempts in the worker (agreed 2026-11-08), and one that still fails goes out again as a regular activity. The provider's call gets a single try, because its link has to come back inside the API's wait:

```kotlin
private val online =
    Workflow.getInfo().taskQueue == "online-wf"

// Online: 2 attempts in the worker that holds the workflow task
private val local = Workflow.newLocalActivityStub(
    InstrumentActivities::class.java,
    LocalActivityOptions.newBuilder()
        .setStartToCloseTimeout(timeout)   // Verify's: 2 to 3 times a p99 of at most 300 to 400 ms
        .setRetryOptions(RetryOptions.newBuilder()
            .setMaximumAttempts(2).build())
        .build(),
)
// Online, after those 2 attempts: a regular activity for 24 hours
private val regular = Workflow.newActivityStub(
    InstrumentActivities::class.java,
    ActivityOptions.newBuilder()
        .setTaskQueue("online-wf")
        .setStartToCloseTimeout(timeout)
        .setScheduleToCloseTimeout(Duration.ofHours(24))
        .build(),
)
// Offline: the workflow's own queue, with eager dispatch
private val offline = Workflow.newActivityStub(
    InstrumentActivities::class.java, workflowQueueOptions)

fun instrument(paymentId: String): Instrument? =
    if (!online) offline.instrument(paymentId)
    else try {
        local.instrument(paymentId)
    } catch (e: ActivityFailure) {
        if (e.cause is CanceledFailure) throw e   // a cancellation is not a reason to try again
        regular.instrument(paymentId)   // then the exception list
    }
```

*(A sketch.)*

A Java local activity with neither a schedule-to-close nor a maximum number of attempts isn't retried at all, so the 2 attempts are set. A short failure is retried in place, at once (Proposed: after 1 ms), since the caller is waiting. If both fail, the same call goes out on `online-wf`, which retries it for up to 24 hours. Verify's calls on the Offline cluster, in Reverify and in AR intake's Verify, get the same 24 hours as a regular activity (agreed 2026-11-08); past that, the payment goes on the exception list, as for any activity whose retries run out. The caller isn't kept waiting meanwhile: a payment not decided at 2.5 seconds is answered `PENDING`, and it carries on when the system is back. The provider's stub sets a maximum of one attempt instead, because RequestConfirmation gets one try that fits inside the caller's wait. Everything after the decision, Execute and Fulfil included, stays on regular activities.

## One interface, three queues

`TransactionNotificationActivities` is the one interface that covers more than one system. TFNE, GPHDB and B2Notifier hear the same news at the same moment, so they share an interface, but each keeps its own method and its own queue, so each keeps its own rate limit. The stub takes options per method:

```kotlin
@ActivityInterface
interface TransactionNotificationActivities {
    fun notifyTfne(paymentId: String, details: InstrumentDetails)      // TFNE
    fun recordHistory(paymentId: String, details: InstrumentDetails)   // GPHDB
    fun notifyB2(paymentId: String, details: InstrumentDetails)        // B2Notifier
}

private val notifications = Workflow.newActivityStub(
    TransactionNotificationActivities::class.java,
    notificationOptions,                                         // timeouts and retries, as above
    mapOf(                                                       // one queue per system, on Offline
        "NotifyTfne" to notificationOptions.toBuilder().setTaskQueue("ds-tfne").build(),
        "RecordHistory" to notificationOptions.toBuilder().setTaskQueue("ds-gphdb").build(),
        "NotifyB2" to notificationOptions.toBuilder().setTaskQueue("ds-b2notifier").build(),
    ),
)
```

*(The method names are illustrative.)*

A worker on each of the three queues registers the same implementation, and each only ever receives its own method's tasks. Each method calls one client, so the rule that a call reaches one system still holds.

## The stores and Oracle

Every store reads and writes Oracle directly: `PaymentStore` for payment state, the corporate completion counts included, since they read `split_trans_dtl` (2026-11-08), `WorkTrackerStore` for the Work Tracker's claims and sweeps, `AllocationBatchStore` for allocation batches, `ConfigStore` for the published market config and `ControlStore` for the dispatcher runs, the rate and downstream limits and the governor's decisions. An activity calls a store, as it calls a client, and nothing else holds a connection.

Every database activity runs as a local activity on its first 2 attempts, inside the workflow task, so a healthy commit costs no task round trip. If both fail, the next try runs as a regular activity with the full retry policy (agreed 2026-11-08). Each operation is one transaction. A stage commit, for example, is the guarded status update, the timeline row with the cluster, and any Work Tracker rows the step opens or closes:

```kotlin
override fun commit(c: StageCommit): Boolean = transaction(pool) {
    val moved = TransDtl.update({
        (TransDtl.transId eq c.paymentId) and (TransDtl.status eq c.expected.code)
    }) { it[status] = c.next.code } == 1                     // the guard

    if (moved) {
        TransLfcycEvent.insert { /* c.next, with the cluster that ran the step */ }
        c.workRows.forEach { WorkTracker.insertIfAbsent(it) } // deterministic item_id
        c.closesRow?.let { WorkTracker.markDone(it) }
    }
    moved                                                    // false: someone else moved it first
}
```

A commit that changes no row isn't an error. It means another writer, such as a cancel, moved the payment first, and the stage returns the payment as it stands. Because a local activity runs again if a worker dies mid-task, and the regular retry runs it again after that, every write in a store is insert-if-absent or a guarded update, so running it twice changes nothing.

Give the local stub `maximumAttempts` 2, and the regular retry its first retry after 6 seconds, doubling, a maximum retry interval of 45 minutes and a schedule-to-close of a few hours (agreed 2026-11-08). That is what lets a payment wait out an Oracle outage and carry on when Oracle is back, without holding a workflow task while it waits. Capture on the Online cluster is the exception: both its local attempts fit inside a short deadline, 2 s with 1 s per attempt, and a miss fails the create with 503 and no regular retry, so a caller gets a quick error before billpay-online's 2.5 s wait ends (Proposed, 2026-11-08). The schedule-to-close limits are settings: `billpay.activities.decision-schedule-to-close` (24 h), `announcement-schedule-to-close` (4 h, for RTF and Raven) and `database-schedule-to-close` (4 h) (Proposed, 2026-11-08). Don't make any other call local just for speed: speed never costs a retry.

## RTF and Raven are activities too

There is no outbox. A stage's announcement calls `LifecycleEventActivities`, which sends the lifecycle event to RTF, and `CommunicationActivities`, which sends the customer's message through Raven. Both carry idempotency keys, and both get a long schedule-to-close, like the database activities: they must succeed, so an outage pauses payments where they are instead of failing them.

RTF has no rate limit, and it guarantees delivery once it has an event, so its calls run on the workflow's own queue. Raven has an agreed rate, so its calls run on `ds-comms` like any other throttled system, on both clusters, the announcements at Verify's decision included (Proposed, 2026-11-07).
