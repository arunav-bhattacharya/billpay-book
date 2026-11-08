---
title: Building the Router
description: 'The Router is the only code that starts a payment workflow.'
sidebar_label: Router
---

import Lead from '@site/src/components/Lead';

# Building the Router

<Lead>The Router is the only code that starts a payment workflow. It is a library in the billpay-core codebase, not a service, so it runs inside both apps: in billpay-online the core APIs call it while a caller waits, and in billpay-offline the dispatchers call it for every row and request they release, so every start is admitted, pinned and given a run site the same way.</Lead>

Without it, two kinds of code would start payments, the API handlers and the dispatchers, and each would carry its own copy of the market rules. The copies would drift. [Design → Routing](../../design/routing.md) explains what the Router decides and why. This page is about building it: the two types it hands on, its six steps as code, and the details that are easy to get wrong.

## Who calls it

- The core APIs, for every write a caller waits on: `POST /payments`, `PUT` and `DELETE /payments/{payment-id}`, `POST /payments/{payment-id}/confirm`, `POST /refunds` and `POST /payment-installments`.
- The 3D Secure callback, `POST /payments/{payment-id}/authentication`, which the market's card provider calls directly. It carries no market, so it skips the profile check (agreed 2026-11-07), then goes as an update to the waiting workflow.
- The allocations callback, `POST /payments/{payment-id}/allocations`, once it has stored the batch. billpay-offline serves it. It needs neither the market nor the account type: its payment already exists, and the payment's workflows keep the config version they started on. So it starts with no resolved profile, and its workflow has no `Market`, `ConfigVersion` or `DueDate` search attribute (`DueDate` agreed 2026-11-07, the rest Proposed).
- The dispatchers, in billpay-offline, once for each Work Tracker row or inbox request they release.

On every `/payments` call, the create, the update, the cancel and the confirm, One-Data passes the card account's market and account type, which it looks up with `ReadCustomerAccountInfo.v1`, so the Router makes no lookup of its own. A create also carries each instruction's instrument type and payment ID (agreed 2026-11-07). The wire names of these fields come with the API contracts and are placeholders until then.

The confirm, and the customer's no to a payment that waits, go through admission only. They reach a workflow that is already running, as an update, so there is nothing to pick, pin or choose ([6. Start](#6-start) shows the call).

Calling it is a plain function call inside the app. Each app holds a Temporal client for its own cluster only, so the run site always names that cluster: billpay-online starts on the Online cluster and billpay-offline on the Offline cluster. The dispatchers call it from their `claimAndStart` activity, never from workflow code, because starting a workflow is I/O and workflow code [has to stay deterministic](./workflows.md#why-workflow-code-must-be-deterministic).

Control workflows don't go through the Router. The dispatchers, the governor and market onboarding start from their Schedules or their own API.

## The two types it hands on

Every start but the allocations callback's produces a resolved profile, which the workflow receives, and every start produces a run site, which says where and how it starts. A sketch: the resolved profile's fields are the spec's, and the other names are illustrative.

```kotlin
data class ResolvedProfile(
    val market: Market,                           // so a market's own classes, such as GB's, can apply
    val journey: Journey,
    val accountType: AccountType,                 // CONSUMER, CORPORATE or BUSINESS_TRAVEL
    val requiresArPosting: Boolean,               // the other four behaviors arrive resolved,
    val requiresRealtimeClearing: Boolean,        // Y or N, never BOTH
    val requiresMandateAuthorization: Boolean,
    val requiresBankConfirmation: Boolean,
    val cardAuthentication: Boolean,              // Y for a debit card: every one needs 3D Secure (Proposed)
    val configVersion: Int,                       // the market config version they came from
    val ruleSettings: RuleSettings,               // the verification rules' thresholds, from that version
    val confirmationWindow: Duration? = null,     // for a payment that waits for the customer; 2 minutes for a debit card
)

data class RunSite(
    val cluster: Cluster,                         // ONLINE or OFFLINE
    val taskQueue: String,                        // online-wf or offline-wf; the cluster picks the ds-* queues
    val priority: Int?,                           // 1 to 5, on the Offline cluster
    val fairnessKey: String?,                     // a market, a parent payment ID, "returns"...
    val workflowId: String,                       // the payment ID plus its suffix
)
```

The resolved profile is a workflow input, so Temporal records it in the workflow's history, and two rules follow. Its JSON must read the same when the workflow replays, so a new field gets a default ([Serialization](../tech-stack/serialization.md)). And it carries values, never a pointer to config: the workflow has to see the behaviors and rule settings as they were when it started, whatever the market changes later.

## The six steps

The steps run in the same order for every caller:

```kotlin
fun route(request: RouteRequest): Routed {
    val version = admit(request) ?: return Routed.NotLive                // 1
    if (request is AllocationsCallback && !budget.allows(request)) {
        return Routed.OverBudget(budget.retryAfter())                     // 429 with Retry-After
    }
    val journey = request.journey(version)                                // 2
    val behaviors = resolve(version, journey, request)                    // 3
    val profile = ResolvedProfile.of(journey, behaviors, version)         // 4
    val runSite = chooseRunSite(journey, profile, request)                // 5
    return start(journey, profile, runSite, request)                      // 6
}
```

### 1. Admit

The Router checks that the market, the account type and the API are live in this environment. It checks them against the copy of the onboarding config each app caches in its JVM, so admission adds no call to a database or another service (agreed 2026-10-18). Only a call that names a market is checked: the 3D Secure callback and the allocations callback carry none (agreed 2026-11-07). Each pod reloads its copy when the onboarding workflow activates or rolls back a version (agreed 2026-10-19). That workflow runs on the Offline cluster, so the news reaches billpay-online through Oracle. Proposed: every 15 s each pod reads `market_config_active` and reloads when the version or `IN_SERVICE_IN` changed, and the same read takes `market_config_version`'s keys, because a version set up for mock accounts can exist before it is active, and adding one doesn't change `market_config_active` (2026-11-07). If the check fails, the Router refuses the start, and the caller turns the refusal into the right outcome:

| Caller | What a refusal becomes |
| --- | --- |
| A core API | 422, which senders don't retry |
| A core API, for a create One-Data held while billpay-online was slow, which RTF delivers with an async flag that a direct call never carries (agreed 2026-11-07) | Not a refusal: the create is captured and declined, so the customer is told and the delete call to One-Data still runs (agreed 2026-10-18). The Router starts its workflow with a resolved profile that only captures and declines, and Verify declines it (agreed 2026-10-19) |
| An inbox dispatcher | The request is marked `REJECTED` through `UpdateStartRequests.v1`, and an alert tells operations. The sender is not told |
| A Work Tracker dispatcher | The row goes from `DISPATCHING` to `FAILED`, which raises the retries-exhausted alert. A row is refused only when its market was taken out of service after the row was written |

The allocations callback has one more check: its start must fit inside its traffic class's budget, or the API answers 429 with `Retry-After`, and the allocations manager retries. Proposed (2026-11-07): the class is `ALLOCATION_CALLBACK`, with its `RATE_ALLOCATION` row scoped `'*'`. Its bucket holds one second of rate, a `PAUSE` override answers `Retry-After: 30`, `MAXIMUM` caps the rate, and a class with no row isn't limited. The callback runs in the corporate priority class, keyed on its payment. Dispatchers skip this check, because the [governor](../../design/pacing.md#the-governor) already sets their rate.

### 2. Pick the journey

The routing table on [Design → Routing](../../design/routing.md#trigger-to-workflow) is the spec for this step. Most of it is a fixed mapping: an update is always `UPDATE`, a `REPRESENT` row is always `REPRESENT`. Only a create has conditions. So the step is built in two parts, and neither is a central `when` that every new request has to edit. Proposed (2026-10-20).

**Each request names its own journey.** `RouteRequest` is a sealed interface with one abstract function, so a new request type doesn't compile until it says which journey it takes. The Work Tracker item types and the inbox request types are enums that carry their journey, so a new item type can't be added without one either:

```kotlin
sealed interface RouteRequest {
    fun journey(version: MarketVersion): Journey
}

data class UpdatePayment(/* ... */) : RouteRequest {
    override fun journey(version: MarketVersion) = Journey.UPDATE
}

data class DueRow(val itemType: WorkItemType /* ... */) : RouteRequest {
    override fun journey(version: MarketVersion) = itemType.journey
}

enum class WorkItemType(val journey: Journey) {
    SCHED_EXEC(Journey.EXECUTE_SCHEDULED),
    ALLOC_EXEC(Journey.EXECUTE_SCHEDULED),
    ALLOC_REQUEST(Journey.REQUEST_ALLOCATIONS),
    ALLOC_LEG(Journey.EXECUTE_SPLIT),
    REPRESENT(Journey.REPRESENT),
}

enum class StartRequestType(val journey: Journey) {      // pulled from One-Data's inbox
    AR_PAYMENT(Journey.CREATE_SCHEDULED),
    AR_REFUND(Journey.BALANCE_REFUND),
    RETURN(Journey.PROCESS_RETURN),
    INBOUND(Journey.PROCESS_INBOUND),
}
```

`CancelPayment`, `Refund`, `PayAndPlan` and `AllocationsCallback` each return their one journey the same way. This is the replace-conditional-with-polymorphism move: the knowledge sits with the type it belongs to, and the compiler checks that none is missing.

**A create asks an ordered list of rules.** Each `JourneyRule` is a small specification: a journey, the condition in words, and a test. The rules are tried in order and the first that matches wins, like a chain of responsibility, so the order in the list is the order of the routing table:

```kotlin
class JourneyRule(
    val journey: Journey,
    val condition: String,                                     // the words the routing table prints
    val matches: (CreatePayment, MarketVersion) -> Boolean,
)

object CreateJourneys {
    private val rules = listOf(
        JourneyRule(Journey.CREATE_INTENT, "Waits for the customer: bank confirmation or a debit card") { r, v -> r.waitsForCustomer(v) },
        JourneyRule(Journey.CREATE_SCHEDULED, "Future-dated") { r, _ -> r.isFutureDated },
        JourneyRule(Journey.MULTIPLE_INSTRUCTIONS, "Today, several instructions") { r, _ -> r.instructions.size > 1 },
        JourneyRule(Journey.PAY_WITH_MR_POINTS, "Today, MR Points alone") { r, _ -> r.instructions.single().isMrPoints },
        JourneyRule(Journey.CREATE_IMMEDIATE, "Today, one instruction") { _, _ -> true },
    )

    fun pick(r: CreatePayment, v: MarketVersion): Journey = rules.first { it.matches(r, v) }.journey
}

data class CreatePayment(/* ... */) : RouteRequest {
    override fun journey(version: MarketVersion) = CreateJourneys.pick(this, version)
}
```

The Router's step is then one line, `val journey = request.journey(version)`.

The rules are a plain list in one file, not beans that Quarkus collects the way it collects stages. Stages vary by market, so each market adds its own and a registry sorts them out. Journeys don't vary by market: they change only when the code does, and their order matters, so one list a reviewer can read top to bottom is the clearer place for them.

**A test keeps the code and the table together.** It walks every request type, item type, inbox type and create rule, writes the routing table as trigger, condition and journey, and compares it with a checked-in copy, the way the [stage report](./stage-resolver.md) works. A change to which journey a request takes fails the test until the same pull request updates the copy, so the reviewer sees the row that moved.

The request's payment method comes from the instrument type One-Data passes for each instruction, so the Router knows before anything starts whether a way to pay needs bank confirmation (Pay with Bank Transfer, Plaid), is a debit card (3D Secure) or is MR Points (agreed 2026-11-07).

A create that waits for its customer takes a journey of its own, `CREATE_INTENT`, whose workflow holds the wait and takes the confirm and the no as updates. `waitsForCustomer` is true when the market's bank-confirmation behavior resolves to Y for the request's payment method, or when the payment method is a debit card. It is the first rule because a payment that waits has to run in the one workflow that can wait for its customer. A request with several instructions, or a Pay & Plan request, that would need bank confirmation gets 422 instead, and so does a debit card create that is future-dated, has several instructions or carries MR Points, a corporate create that pays by debit card or needs bank confirmation, and a Pay & Plan request that pays by debit card. Pay with MR Points alone has its own rule, after several instructions (its place in the order is Proposed).

No rule here looks at the account's other payments. A create on an account that already has a payment in `PENDING` never reaches the Router: One-Data declines it with 200 `DECLINED` before it calls billpay-online ([Stored creates and the pending check](../api-spec/one-data.md#stored-creates-and-the-pending-check)).

### 3. Resolve the behaviors

Each behavior in the market's version is Y, N or BOTH, and a workflow must only ever see Y or N. BOTH becomes one or the other here, by the rule onboarding stored with it:

- For most behaviors the rule lists the journeys that get Y. Realtime clearing is the usual example: only a pay-today payment from a channel gets it. A scheduled execution always resolves it to N, even where the release sets `requiresRealtimeClearing` to Y, because a future-dated payment never clears in real time (agreed 2026-11-08).
- For bank confirmation the rule lists payment methods instead. A method that needs the customer to confirm at their bank gets Y. Bank confirmation takes only payments made today. Which account types can take it is configurable: consumer for now, and business travel can be turned on later. Until then, a business travel request whose method needs it is refused with 422 (Proposed). A corporate payment whose method would need it is refused with 422. A future-dated request, or one with several instructions, that would need it is refused with 422: Pay with Bank Transfer and a payment confirmed through Plaid pay today only.
- Card authentication is never BOTH, because no market chooses it: the Router sets it to Y whenever the payment method is a debit card (Proposed).

```kotlin
fun resolveFlag(rule: BehaviorRule, journey: Journey, method: PaymentMethod?): Boolean =
    when (rule.value) {
        Y -> true
        N -> false
        BOTH -> if (rule.byPaymentMethod) method in rule.methods else journey in rule.journeys
    }
```

The version is the active one, with one exception. A new version is tested with real payments before it goes live, from mock accounts set up for that version (agreed 2026-11-07). Proposed: the release's JSON lists them, `testAccounts` by account token, frozen with the release, and the Router pins that version for any payment from one of them, even before it is active, and keeps it for that payment's updates, cancels and due-date execution (agreed 2026-11-08). Every other account runs on the active version.

### 4. Pin the resolved profile

The workflow gets the resolved profile as an input and looks up its stages with it at runtime. Nothing else ever hands a workflow its stages. The profile carries the market as well as the behaviors, because a market's own class, such as GB's funds check for Pay with Bank Transfer, applies by market:

```kotlin
val stages = stageResolver.resolve(profile)              // inside the workflow, on its own thread
```

Each stage, and each check or method a stage uses, says where it applies: a market or every market, an account type, and the behaviors that must be Y or N. For each job the most specific class that applies wins, so a market's own class beats a shared one with the same key in that market and nowhere else, while classes with different keys add up. Quarkus finds every class at build time, and a registry works out every combination when the app starts, so a lookup is a map read. The same registries work out the build's capability manifest, which `GET /market-onboarding/capabilities` returns and the onboarding workflow checks every release against.

The Router builds the resolved profile but never picks a class. During a rolling deploy the Router and the workers can run different builds, so the classes are picked by the build that runs them. [Building Stages](./stages.md#how-a-stage-gets-picked) shows how a class says where it applies, and [Building the Stage Resolver](./stage-resolver.md) works through one payment from its resolved profile to the checks it runs.

The profile also carries the market's rule settings from the same version, such as its largest payment and the instrument types it takes (agreed 2026-10-18). The [verification rules](./stages.md#writing-verification-rules) in Verify, Reverify and Represent read them from there, so a market changes a threshold with a release, and a running payment keeps the values it started with. For a payment that waits for its customer, the profile carries the market's confirmation window too, which the workflow's timer uses.


#### Rule settings, with an example

The field names and values here are illustrative (Proposed, 2026-10-20). The spec fixes only what the settings are for: the market's largest payment and the instrument types it takes.

1. In the Market Onboarding UI, the GB consumer profile's Operations step sets the largest payment to 25,000 GBP and the instrument types to bank account only.
2. A second person approves it, and it is frozen as release v7, the settings with it:

   ```json
   "ruleSettings": {
     "maxPaymentAmount": { "amount": "25000.00", "currency": "GBP" },
     "acceptedInstrumentTypes": ["BANK_ACCOUNT"]
   }
   ```

3. Once v7 is active in an environment, every pod reloads its in-memory copy of the config, and for each new GB consumer payment the Router copies the settings into the resolved profile as values:

   ```kotlin
   data class RuleSettings(
       val maxPaymentAmount: Money,
       val acceptedInstrumentTypes: Set<InstrumentType>,
   )

   val profile = ResolvedProfile.of(journey, behaviors, version)   // ruleSettings = version.ruleSettings
   ```

4. Verify puts them into `VerificationFacts` with the checks' answers, and a rule reads them like any other fact:

   ```kotlin
   val withinLimit = FactSpec { it.payment.amount <= it.ruleSettings.maxPaymentAmount }

   Rule(
       id = "AMOUNT_WITHIN_LIMIT",
       steps = setOf(VERIFY, REVERIFY),
       runsWhen = FactSpec { true },
       passes = withinLimit,
       priority = 600,
   )
   ```

5. A payment of 30,000 GBP fails the rule and is declined with the rule's code. If release v8 raises the limit to 40,000, payments already running keep 25,000, because it is in their history, and payments started after v8 goes live get 40,000. A scheduled payment is routed again on its due date, so its Reverify checks against the version active that day.

The rule's logic is code and changes with a deploy. The number is config and changes with a release.

The start also sets the search attributes, once: `PaymentId`, `Market`, `Journey`, `DueDate`, `ConfigVersion`, and `ParentPaymentId` for a leg, or the group ID for an instruction of a create with several instructions (Proposed). `Journey` holds the journey's name and `ConfigVersion` the version number (Proposed, 2026-11-07). The composite of several instructions takes the group ID as its own `PaymentId`, so `PaymentId = groupId` finds it and `ParentPaymentId = groupId` finds its children (Proposed, 2026-11-07). The allocations callback starts with no profile, so its workflow carries no `Market` or `ConfigVersion` (Proposed), and no `DueDate` (agreed 2026-11-07).

### 5. Choose the run site

The run site is the cluster, the task queue, the priority and fairness key, and the workflow ID.

- Work a caller waits for runs on the Online cluster, on `online-wf`, and its Execute and Fulfil calls always go to the Online cluster's `ds-*` queues (agreed 2026-11-07). The run site doesn't name those queues: they have the same names on both clusters, so the cluster picks them (agreed 2026-11-07). Work a dispatcher or the allocations callback starts runs on the Offline cluster, on `offline-wf`. Three workflows run on either, depending on what started them ([Workflows](./workflows.md#which-cluster-runs-it)).
- Priority and fairness key are set once, from the traffic class, and every activity inherits them. They matter only on the Offline cluster's shared queues, and [Design → Throttling](../../design/throttling.md#priority-and-fairness) has the classes.
- The workflow ID is the payment ID, a ULID, plus a suffix such as `-init` or `-execute`. A create with several instructions is the exception: its composite is `{groupId}-init`, from the group ID One-Data passes for the request, and each instruction's child is `{groupId}_{paymentId}-init` (Proposed, 2026-11-07). Pay & Plan's and MR Points' composites are `{paymentId}-plan` and `{paymentId}-points`, so the payment's own workflow keeps `{paymentId}-init` (agreed 2026-11-07). Billpay derives no ID of its own. For pulled work and async starts it comes from the request: the payment ID in its idempotency key or, for a return, the returned payment and its presentment sequence. That is what lets a repeated request find the same workflow.

Online's limits never change the run site. The governor writes them, a SEPA run's cap included, to `downstream_limit`, and billpay-online sets them on its own `ds-*` queues, so a cap changes a queue's limit, never where a call runs ([Design → Throttling](../../design/throttling.md#when-the-cutoff-wins)). Proposed (2026-11-07): a queue's limit is `ONLINE_CAP_TPS` while `ONLINE_CAP_END_TS` is in the future, and `AGREED_TPS` otherwise. A queue with no row keeps the limit it has, and a cap with no end time is ignored, since the governor always writes the two together.

### 6. Start

A caller who waits gets Update-With-Start, answered within 2.5 seconds, which keeps the reply inside One-Data's own 3:

```kotlin
val options = WorkflowOptions.newBuilder()
    .setWorkflowId(runSite.workflowId)                        // {paymentId}-init
    .setTaskQueue(runSite.taskQueue)                          // online-wf
    .setWorkflowIdConflictPolicy(WorkflowIdConflictPolicy.WORKFLOW_ID_CONFLICT_POLICY_USE_EXISTING)
    .setTypedSearchAttributes(searchAttributes(request, profile))
    .build()
val wf = onlineClient.newWorkflowStub(CreateImmediatePaymentWorkflow::class.java, options)
val start = WithStartWorkflowOperation(wf::run, request.body, profile)   // the request itself: nothing is written first

val reply = try {
    CompletableFuture.supplyAsync({                             // the bound covers the whole call
        WorkflowClient.executeUpdateWithStart(wf::decision, UpdateOptions.newBuilder<PaymentDecision>().build(), start)
    }, temporalCalls).get(2500, TimeUnit.MILLISECONDS)          // Verify's decision
} catch (e: TimeoutException) {
    PaymentDecision.PENDING                                     // captured; it finishes on its own
}
```

The request itself is the start input, so the API writes nothing before the start: Capture writes it in the workflow's first task, and the caller's path has no extra database call. `USE_EXISTING` makes a repeated request join the running workflow instead of starting a second one. The 2.5-second bound covers the whole call, not just its result. On the Online cluster the decision runs as local activities inside the workflow's first task, and the worker reports the update as accepted only when that task completes, so the acceptance and the answer arrive together. A payment not decided in 2.5 seconds is answered `PENDING`, and the workflow carries on without the caller.

The options set no reuse policy, so the default, `ALLOW_DUPLICATE`, applies once a run has closed. A create repeated after that starts a new run, and Capture's idempotency check decides what it does (agreed 2026-10-18). If the payment is still `PENDING` with nothing waiting on it, because the last run died before deciding, the new run carries on from the next stage. Otherwise it returns the payment as it stands and ends, so no stage runs twice. Workflows and activities are idempotent, so this needs no special policy.

Everything else is a plain start, safe to repeat:

```kotlin
val options = WorkflowOptions.newBuilder()
    .setWorkflowId(runSite.workflowId)                        // {paymentId}-execute, from the row
    .setTaskQueue(runSite.taskQueue)                          // offline-wf
    .setWorkflowIdReusePolicy(WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE)
    .setPriority(Priority.newBuilder()
        .setPriorityKey(runSite.priority!!)                   // 1 for execution
        .setFairnessKey(runSite.fairnessKey!!)                // the market
        .build())
    .setTypedSearchAttributes(searchAttributes(request, profile))
    .build()
val wf = offlineClient.newWorkflowStub(ExecuteScheduledPaymentWorkflow::class.java, options)
try {
    WorkflowClient.start(wf::run, request.paymentId, profile)  // a row names a payment already in Oracle
} catch (e: WorkflowExecutionAlreadyStarted) {
    // A repeated tick or a retried activity already started it. That counts as done.
}
```

`REJECT_DUPLICATE` refuses a second run once the first has closed, so a row released twice can't execute a payment twice. The allocations callback starts the same way and also sets conflict policy `USE_EXISTING`. Its API replies 202 only after the start returns, so the workflow exists before the allocations manager hears back. While the Offline cluster is down, that start fails, and the API answers 503 with `Retry-After`.

The confirm, and the no to a payment that waits, start nothing. They are updates to the payment's running `CreatePaymentIntentWorkflow`:

```kotlin
val stub = onlineClient.newUntypedWorkflowStub("$paymentId-init")
val options = UpdateOptions.newBuilder(PaymentDecision::class.java)
    .setUpdateName("confirm")
    .setUpdateId("$paymentId-confirm")                          // a repeat attaches to the same update
    .setWaitForStage(WorkflowUpdateStage.COMPLETED)
    .build()
val reply = try {
    CompletableFuture.supplyAsync({ stub.startUpdate(options).result }, temporalCalls)
        .get(2500, TimeUnit.MILLISECONDS)                       // Verify's decision, under the same bound
} catch (e: TimeoutException) {
    PaymentDecision.PENDING                                     // it finishes on its own
} catch (e: ExecutionException) {
    when (e.cause) {
        is WorkflowUpdateException -> answerFromOracle(paymentId)     // turned away: 409 for a cancelled payment
        is WorkflowNotFoundException -> answerFromOracle(paymentId)   // closed: a retry whose reply was lost
        else -> throw e
    }
}
```

*(A sketch: the API names are the Java SDK's, the rest illustrative.)*

The workflow's validator turns away a confirm that comes after it has an answer, or once it no longer waits, before anything is written to its history.

Neither cluster uses eager workflow start: the server refuses it with Update-With-Start (`RequestEagerExecution is not supported`), and online latency comes from Update-With-Start and local activities instead. On the Online cluster, Verify's calls run as local activities, so the whole decision happens in the workflow's first task.

## Re-routing on the due date

A scheduled payment is routed twice. Its create goes through the Router when the customer schedules it. On the due date, the dispatcher hands its `SCHED_EXEC` row, or a corporate payment's `ALLOC_EXEC` row, to the Router like any other start. The Router resolves the behaviors from that day's active version and pins a new resolved profile, so the payment executes with today's config. The version it was scheduled under stays in its timeline for audit.

In code, a due row is one more kind of request, which is the point of having one Router. The two guardrails that make this safe are already in place: the resolved profile carries the behaviors and the version, and a workflow code change that would alter a running payment's steps is patched and replay-tested.
