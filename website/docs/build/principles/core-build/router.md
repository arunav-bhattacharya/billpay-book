---
title: Building the Router
description: 'The Router is the only code that starts a payment workflow.'
sidebar_label: Router
---

import Lead from '@site/src/components/Lead';

# Building the Router

<Lead>The Router is the only code that starts a payment workflow. It is a library inside billpay-core, not a service: the core APIs call it while a caller waits, and the dispatchers call it for every row and request they release, so every start is admitted, pinned and placed the same way.</Lead>

Without it, two kinds of code would start payments, the API handlers and the dispatchers, and each would carry its own copy of the market rules. The copies would drift. [Design → Routing](../../../design/routing.md) explains what the Router decides and why. This page is about building it: the two types it hands on, its six steps as code, and the details that are easy to get wrong.

## Who calls it

- The core APIs, for every write a caller waits on: `POST /payments`, `PUT` and `DELETE /payments/{payment-id}`, `POST /payments/{payment-id}/confirm`, `POST /refunds` and `POST /payment-installments`.
- The allocations callback, `POST /payments/{payment-id}/allocations`, once it has stored the batch.
- The dispatchers, once for each Work Tracker row or inbox request they release.

Calling it is a plain function call inside billpay-core. The app holds a Temporal client for each cluster, and the Router takes the one its placement names. The dispatchers call it from their `claimAndStart` activity, never from workflow code, because starting a workflow is I/O and workflow code [has to stay deterministic](./workflows.md#why-workflow-code-must-be-deterministic).

Control workflows don't go through the Router. The dispatchers, the governor and market provisioning start from their Schedules or their own API.

## The two types it hands on

Every start produces a plan key, which the workflow receives, and a placement, which says where and how it starts. A sketch: the plan key's fields are the spec's, and the other names are illustrative.

```kotlin
data class PlanKey(
    val market: Market,                           // Proposed: so a market override can match
    val journey: Journey,
    val accountType: AccountType,                 // CONSUMER, CORPORATE or BUSINESS_TRAVEL
    val requiresArPosting: Boolean,               // the other four behaviors arrive resolved,
    val requiresRealtimeClearing: Boolean,        // Y or N, never BOTH
    val requiresMandateAuthorization: Boolean,
    val requiresBankConfirmation: Boolean,
    val configVersion: Int,                       // the market config version they came from
    val waitsForGoAhead: Boolean = false,         // Proposed: other payments were pending
)

data class Placement(
    val cluster: Cluster,                         // ONLINE or OFFLINE
    val taskQueue: String,                        // online-wf or offline-wf
    val priority: Int?,                           // 1 to 5, on the Offline cluster
    val fairnessKey: String?,                     // a market, a parent payment ID, "returns"...
    val workflowId: String,                       // the payment ID plus its suffix
    val cappedQueues: Map<Downstream, String>,    // Online only, while a SEPA run caps it
)
```

The plan key is a workflow input, so Temporal records it in the workflow's history, and two rules follow. Its JSON must read the same when the workflow replays, so a new field gets a default ([Serialization](../tech-stack/serialization.md)). And it carries values, never a pointer to config: the workflow has to see the behaviors as they were when it started, whatever the market changes later.

## The six steps

The steps run in the same order for every caller:

```kotlin
fun route(request: RouteRequest): Routed {
    val version = admit(request) ?: return Routed.NotLive                // 1
    if (request is AllocationsCallback && !budget.allows(request)) {
        return Routed.OverBudget(budget.retryAfter())                     // 429 with Retry-After
    }
    val journey = pickJourney(request)                                    // 2
    val behaviors = resolve(version, journey, request)                    // 3
    val plan = PlanKey.of(journey, behaviors, version.number)             // 4
    val placement = place(journey, plan, request)                         // 5
    return start(journey, plan, placement, request)                       // 6
}
```

### 1. Admit

The Router checks that the market, the account type and the API are live in this environment. It checks them against billpay-core's in-memory copy of the onboarding config, so admission adds no call to a database or another service (agreed 2026-10-18). Proposed: each pod reloads its copy when provisioning activates or rolls back a version. If the check fails, the Router refuses the start, and the caller turns the refusal into the right outcome:

| Caller | What a refusal becomes |
| --- | --- |
| A core API | 422, which senders don't retry |
| A core API, for a create One-Data held while billpay-core was slow | Not a refusal: the create is captured and declined, so the customer is told and the delete call to One-Data still runs (agreed 2026-10-18). Proposed: the Router starts its workflow with a plan that only captures and declines |
| An inbox dispatcher | The request is marked `REJECTED` through `UpdateStartRequests.v1`, and an alert tells operations. The sender is not told |
| A Work Tracker dispatcher | The row goes from `DISPATCHING` to `FAILED`, which raises the retries-exhausted alert. A row is refused only when its market was taken out of service after the row was written |

The allocations callback has one more check: its start must fit inside its traffic class's budget, or the API answers 429 with `Retry-After`, and the allocations manager retries. Dispatchers skip this check, because the [governor](../../../design/pacing.md#the-governor) already sets their rate.

### 2. Pick the journey

The routing table on [Design → Routing](../../../design/routing.md) is the spec for this function, and the code should read like it:

```kotlin
fun pickJourney(r: RouteRequest): Journey = when (r) {
    is CreatePayment -> when {
        r.isFutureDated -> Journey.CREATE_SCHEDULED
        r.instructions.size > 1 -> Journey.MULTIPLE_INSTRUCTIONS
        else -> Journey.CREATE_IMMEDIATE              // bank confirmation takes this journey too
    }
    is PayAndPlan -> Journey.PAY_AND_PLAN
    is UpdatePayment -> Journey.UPDATE
    is CancelPayment -> Journey.CANCEL
    is ConfirmPayment -> Journey.CONFIRM
    is Refund -> Journey.BALANCE_REFUND
    is AllocationsCallback -> Journey.RECEIVE_ALLOCATIONS
    is DueRow -> when (r.itemType) {                  // a Work Tracker row
        SCHED_EXEC, ALLOC_EXEC -> Journey.EXECUTE_SCHEDULED
        ALLOC_REQUEST -> Journey.REQUEST_ALLOCATIONS
        ALLOC_LEG -> Journey.EXECUTE_SPLIT
        REPRESENT -> Journey.REPRESENT
        CONFIRM_EXPIRY -> Journey.CANCEL              // on the Offline cluster
    }
    is StartRequest -> when (r.type) {                // pulled from One-Data's inbox
        AR_PAYMENT -> Journey.CREATE_SCHEDULED
        AR_REFUND -> Journey.BALANCE_REFUND
        RETURN -> Journey.PROCESS_RETURN
        INBOUND -> Journey.PROCESS_INBOUND
    }
}
```

A payment that needs bank confirmation isn't a journey of its own. It takes the pay-today journey, and its resolved behavior tells the workflow to run RequestConfirmation in place of Verify. Nor is a create that waits for the customer's go-ahead because other payments on the card account are pending: it takes its usual journey, pay today or scheduled, and the plan key marks the wait (step 4).

### 3. Resolve the behaviors

Each behavior in the market's version is Y, N or BOTH, and a workflow must only ever see Y or N. BOTH becomes one or the other here, by the rule onboarding stored with it:

- For most behaviors the rule lists the journeys that get Y. Realtime clearing is the usual example: only a pay-today payment from a channel gets it.
- For bank confirmation the rule lists payment methods instead. A method that needs the customer to confirm at their bank gets Y. Only consumer payments made today take bank confirmation, so a corporate or future-dated payment always resolves to N, and a request with several instructions that would need it is refused with 422.

```kotlin
fun resolveFlag(rule: BehaviorRule, journey: Journey, method: PaymentMethod?): Boolean =
    when (rule.value) {
        Y -> true
        N -> false
        BOTH -> if (rule.byPaymentMethod) method in rule.methods else journey in rule.journeys
    }
```

The version is the active one, with one exception. Provisioning tests a new version with real payments before it goes live, so for test accounts only, the Router accepts a pinned version instead.

### 4. Pin the plan key

The workflow gets the plan key as an input and looks up its stages with it at runtime. Nothing else ever hands a workflow its stages. The key carries the market as well as the behaviors (Proposed), because a market override is matched on the market:

```kotlin
val stages = StageIndex.lookup(plan)              // inside the workflow
```

`StageIndex` is generated by KSP (Kotlin Symbol Processing) at build time, from the stage implementations, and the most specific match wins, so a market override beats the default for its market. The same generated code produces the build's capability manifest, which `GET /provisioning/capabilities` returns and provisioning checks every release against. [Building Stages](./stages.md#how-a-stage-gets-picked) shows how an implementation declares what it serves.

When One-Data sends a create with the IDs of other pending payments on the card account, the plan key also marks that the payment waits for a go-ahead, so the index picks RequestConfirmation's and Verify's go-ahead implementations (Proposed). [Design → Journeys](../../../design/journeys/index.md#pay-while-another-payment-is-pending) follows that payment from the wait to the customer's yes or no.

The start also sets the search attributes, once: `PaymentId`, `Market`, `Journey`, `DueDate`, `ConfigVersion`, and `ParentPaymentId` for a leg.

### 5. Place

Placement is the cluster, the task queue, the priority and fairness key, and the workflow ID.

- Work a caller waits for runs on the Online cluster, on `online-wf`. Work a dispatcher or the allocations callback starts runs on the Offline cluster, on `offline-wf`. Four workflows run on either, depending on what started them ([Workflows](./workflows.md#which-cluster-runs-it)).
- Priority and fairness key are set once, from the traffic class, and every activity inherits them. They matter only on the Offline cluster's shared queues, and [Design → Throttling](../../../design/throttling.md#priority-and-fairness) has the classes.
- The workflow ID is the payment ID, a ULID, plus a suffix such as `-init` or `-execute`. For pulled work and async starts it comes from the request: the payment ID in its idempotency key or, for a return, the returned payment and its presentment sequence. That is what lets a repeated request find the same workflow.

The Online cap is the one part of placement that changes with time. While a SEPA run caps Online on a downstream, `downstream_limit` holds the cap and its end time, and the Router places that downstream's calls for each new Online payment on the Online cluster's `ds-*` queue for it. A cap past its end time is ignored, so a stopped governor can't leave customers capped. Placement is pinned at start, and a running payment never switches queues. Proposed: the capped queues travel into the workflow with the plan key, and the stages build their activity options from them.

### 6. Start

A caller who waits gets Update-With-Start, answered within 2.5 seconds, which keeps the reply inside One-Data's own 3:

```kotlin
val options = WorkflowOptions.newBuilder()
    .setWorkflowId(placement.workflowId)                        // {paymentId}-init
    .setTaskQueue(placement.taskQueue)                          // online-wf
    .setWorkflowIdConflictPolicy(WorkflowIdConflictPolicy.WORKFLOW_ID_CONFLICT_POLICY_USE_EXISTING)
    .setTypedSearchAttributes(searchAttributes(request, plan))
    .build()
val wf = onlineClient.newWorkflowStub(CreateImmediatePaymentWorkflow::class.java, options)

val handle = WorkflowClient.startUpdateWithStart(
    wf::decision,
    UpdateOptions.newBuilder<PaymentDecision>().setWaitForStage(WorkflowUpdateStage.ACCEPTED).build(),
    WithStartWorkflowOperation(wf::run, request.paymentId, plan),
)
val reply = try {
    handle.resultAsync.get(2500, TimeUnit.MILLISECONDS)         // Verify's decision
} catch (e: TimeoutException) {
    PaymentDecision.PENDING                                     // captured; it finishes on its own
}
```

`USE_EXISTING` makes a repeated request join the running workflow instead of starting a second one. The API waits for the update to be accepted, then for its result with a 2.5-second timeout, which is how it keeps its promise: a payment not decided by then is answered `PENDING`, and the workflow carries on without the caller.

The options set no reuse policy, so the default, `ALLOW_DUPLICATE`, applies once a run has closed. A create repeated after that starts a new run, and Capture's idempotency check decides what it does (agreed 2026-10-18). If the payment is still `PENDING` with nothing waiting on it, because the last run died before deciding, the new run carries on from the next stage. Otherwise it returns the payment as it stands and ends, so no stage runs twice. Workflows and activities are idempotent, so this needs no special policy.

Everything else is a plain start, safe to repeat:

```kotlin
val options = WorkflowOptions.newBuilder()
    .setWorkflowId(placement.workflowId)                        // {paymentId}-execute, from the row
    .setTaskQueue(placement.taskQueue)                          // offline-wf
    .setWorkflowIdReusePolicy(WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE)
    .setPriority(Priority.newBuilder()
        .setPriorityKey(placement.priority!!)                   // 1 for execution
        .setFairnessKey(placement.fairnessKey!!)                // the market
        .build())
    .setTypedSearchAttributes(searchAttributes(request, plan))
    .build()
val wf = offlineClient.newWorkflowStub(ExecuteScheduledPaymentWorkflow::class.java, options)
try {
    WorkflowClient.start(wf::run, request.paymentId, plan)
} catch (e: WorkflowExecutionAlreadyStarted) {
    // A repeated tick or a retried activity already started it. That counts as done.
}
```

`REJECT_DUPLICATE` refuses a second run once the first has closed, so a row released twice can't execute a payment twice. The allocations callback starts the same way and also sets conflict policy `USE_EXISTING`. Its API replies 202 only after the start returns, so the workflow exists before the allocations manager hears back. While the Offline cluster is down, that start fails, and the API answers 503 with `Retry-After`.

Neither cluster uses eager workflow start: the server refuses it with Update-With-Start, and online latency comes from Update-With-Start and local activities instead.

## Re-routing on the due date

A scheduled payment is routed twice. Its create goes through the Router when the customer schedules it. On the due date, the dispatcher hands its `SCHED_EXEC` row, or a corporate payment's `ALLOC_EXEC` row, to the Router like any other start. The Router resolves the behaviors from that day's active version and pins a new plan key, so the payment executes with today's config. The version it was scheduled under stays in its timeline for audit.

In code, a due row is one more kind of request, which is the point of having one Router. The two guardrails that make this safe are already in place: the plan key carries the behaviors and the version, and Worker Versioning pins the workflow to its build.
