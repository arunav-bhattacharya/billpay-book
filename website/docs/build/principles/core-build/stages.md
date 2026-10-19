---
title: Building Stages
description: 'A stage is one business step of a journey: it makes its calls, commits the new state once, and returns its outcome.'
sidebar_label: Stages
---

import Lead from '@site/src/components/Lead';

# Building Stages

<Lead>A stage is one business step of a journey: it makes its calls, commits the new state once, and returns its outcome. It is also the only layer that changes with a market's behaviors, so a market that does something differently gets a different stage implementation, never a different workflow.</Lead>

[Design → Stages](../../../design/component-model/stages.md) lists every stage, the state it moves and what it varies by. This page is about writing one.

## The shape of a stage

Every stage is a `Payment{Step}Stage` interface with two functions. `run` does the step and returns what happened. `announce` tells RTF, and Raven where the customer is told, about the change `run` committed. The workflow calls them in that order, so a payment's events always reach RTF after the state they describe is in Oracle.

```kotlin
interface PaymentExecuteStage {
    fun run(paymentId: String, verified: VerifyOutcome): ExecuteOutcome  // PROCESSING, after the calls succeed
    fun announce(paymentId: String)                                      // the PROCESSING event
}
```

An implementation is named for what it serves, never for a market: `PaymentVerifyStageWithMandate` is the Verify for every market that requires mandate authorization. If two markets share a rule, they share the file, and a market's name in a class name usually means the rule was written in the wrong place. [Naming an implementation](#naming-an-implementation) has the rule.

## Writing run

A stage makes its calls first, in parallel wherever they don't depend on each other, and then commits once. Here is the Execute for a consumer payment, which clears, posts to Accounts Receivable (AR) and raises open-to-buy at the same time. Open-to-buy needs the instrument's details in clear text, so its branch asks Payment Instruments first, and `thenCompose` chains the two without holding up clearing and AR:

```kotlin
class PaymentExecuteStageWithRealtimeClearing(
    private val clearing: ClearingActivities,
    private val receivables: ReceivablesActivities,
    private val instruments: InstrumentActivities,   // Payment Instruments, no rate limit
    private val authorization: AuthorizationActivities,
    private val store: PaymentStore,                 // a local activity
    private val events: LifecycleEventActivities,    // RTF
) : PaymentExecuteStage {

    override fun run(paymentId: String, verified: VerifyOutcome): ExecuteOutcome {
        val details = Async.function(instruments::clearTextDetails, paymentId)
        val openToBuy = details.thenCompose { d -> Async.function(authorization::raiseOpenToBuy, paymentId, d) }
        Promise.allOf(
            Async.function(clearing::clear, paymentId),
            Async.function(receivables::reduceBalance, paymentId),
            openToBuy,
        ).get()
        // One commit: the guarded move, the timeline row with the cluster,
        // and any Work Tracker rows this step opens or closes.
        val outcome = store.commitExecute(paymentId, expected = ACCEPTED, next = PROCESSING)
        // Fulfil's notifications need the same details. They travel on in the workflow,
        // and the payload codec keeps them encrypted in history.
        return outcome.copy(instrument = details.get())
    }

    override fun announce(paymentId: String) =
        events.publish(paymentId, PROCESSING)      // no Raven message for PROCESSING by default
}
```

*(A sketch: the interface names follow the spec; the method and implementation names are illustrative.)*

Stage code runs inside the workflow, so it follows the workflow's rules. It calls activities through their stubs, uses `Async.function` and `Promise.allOf` for parallel calls, and reaches nothing else: no client, no clock, no database. Everything that touches the world happens in an activity. A stage may call plain helper functions, but never a workflow, another stage or a client.

The commit is a guarded update: it moves the payment only if it is still in the state the stage expects. If another writer moved it first, such as a cancel that beat Reverify to a scheduled payment, the update changes no row, and the stage returns the payment as it stands instead of failing. The workflow reads that outcome and stops, which is why a stage returns its outcome rather than leaving the workflow to guess.

## The announcement

`announce` is a separate step because it can't share the commit. The commit is one Oracle transaction; RTF and Raven are calls to other systems, and Oracle can't roll them back. So the stage commits first and announces after, and the workflow waits for each announcement before the next stage starts. Which status changes send a Raven message is a market setting, and a change that is switched off sends only the RTF event.

Two stages bend that order:

- On the Online cluster, Capture and Verify commit back to back so the caller's answer isn't held up. Both announcements follow the reply, in order.
- Fulfil announces before its commit, because `PROCESSED` means the event and the message have gone out. Its other calls go first, and comms go last.

## How a stage gets picked

A workflow never chooses its stages, and nothing hands them to it. When it starts, it looks them up from the plan key the [Router](./router.md) pinned:

```kotlin
val stages = StageIndex.lookup(plan)               // inside the workflow: one row per step
```

`StageIndex` is generated at build time by KSP (Kotlin Symbol Processing), from what each implementation declares it serves. A declaration names the step and the behaviors it covers, and leaves out the ones it doesn't care about:

```kotlin
@StageFor(step = EXECUTE, requiresRealtimeClearing = Y)
class PaymentExecuteStageWithRealtimeClearing(...) : PaymentExecuteStage
```

*(The annotation is illustrative; what matters is what it records.)*

The most specific match wins, and KSP works that out for every combination while the code compiles. It writes the answers as a table, one row per combination for each step, so the lookup at runtime reads a row and weighs nothing. A market override declares the same things plus its market, and lives in `market/{m}/stages/`. It is a more specific match for that market, so it beats the default there and nowhere else. That is why the plan key carries the market. GB has one: for Pay with Bank Transfer, its Verify also checks that the customer's bank account holds enough money. [Design → Routing](../../../design/routing.md#from-profile-to-stages) follows one profile through to the classes it runs, and [Building the Stage Index](./stage-index.md) works through Verify's table row by row, with the mistakes that stop the build and why KSP was chosen.

Stages are never `abstract`. A variation is a concrete class composed in through the index, not an override of a base class, so reading one file tells you everything a stage does. Payment workflows are pinned to their build with Worker Versioning, so a deploy that adds or changes a stage never changes the code under a payment that is already running.

## Naming an implementation

A stage interface is `Payment{Step}Stage`. An implementation keeps that name and adds what it serves, in a fixed order: `For` and the account type, `With` and each behavior it needs, then `In` and the market for an override. The one that declares nothing is `DefaultPayment{Step}Stage`. [Design → Stages](../../../design/component-model/stages.md#naming-implementations) has the full rule and a table of examples.

A name says what an implementation serves, never what it calls. A market that needs a mandate doesn't get a mandate stage: it gets a version of Verify, `PaymentVerifyStageWithMandate`, that also fetches the mandate details from Plans and runs the rules that check them. The next section shows that class.

## Writing verification rules

Verify, Reverify and Represent decide the same way. Each runs its checks, gathers the answers into one set of facts, runs the rules that apply, and commits once. [Design → Stages](../../../design/component-model/stages.md#how-verification-decides) explains the model, and this is the code it turns into:

```kotlin
/** One data source. Its call runs in parallel with the other checks' calls. */
class MandateCheck(private val plans: PlansActivities) : Check<MandateDetails> {
    override val key = CheckKey.MANDATE
    override fun fetch(paymentId: String): Promise<MandateDetails> =
        Async.function(plans::mandateDetails, paymentId)
}

/** A pure condition over the facts: no calls, no clock. */
val mandateActive = Rule(
    id = "MANDATE_ACTIVE",
    declineCode = DeclineCode.MANDATE_INACTIVE,   // illustrative: the closest existing code, until mandate codes are agreed
    priority = 300,                               // the highest-priority failure decides
    steps = setOf(Step.VERIFY, Step.REVERIFY),
    needs = setOf(CheckKey.MANDATE),
) { facts -> facts.mandate!!.status == MandateStatus.ACTIVE }

@StageFor(step = VERIFY, requiresMandateAuthorization = Y)
class PaymentVerifyStageWithMandate(
    instruments: InstrumentActivities,
    options: OptionsActivities,
    plans: PlansActivities,                       // all three on the workflow's queue
    private val settings: RuleSettings,           // the market's thresholds, from the plan key
    private val store: PaymentStore,
) : PaymentVerifyStage {

    private val checks = listOf(InstrumentCheck(instruments), OptionsCheck(options), MandateCheck(plans))

    override fun run(paymentId: String): VerifyOutcome {
        val facts = fetchAll(checks, paymentId, settings,
            asOf = Workflow.currentTimeMillis())      // the only clock a rule may see
        val report = RuleCatalog.evaluate(Step.VERIFY, facts)   // every rule that applies
        val outcome = store.commitVerify(paymentId, report.decision, report.failedRuleIds)
        return outcome.copy(facts = facts)            // travels on to Execute and Fulfil
    }
}
```

*(A sketch: the names are illustrative.)*

- The default Verify is the same class with two checks, Instrument and Options. A version differs only in its list of checks, never in an `if` on a behavior.
- `fetchAll` waits for every check. An activity returns what its system said, such as a closed account or an expired mandate, as data, and throws only on an error, which Temporal retries. So an outage never declines a payment, and a "no" is never retried.
- Rules live in one catalog, `core/lib/verification/rules/`, each with the steps it runs in. `PaymentReverifyStageWithMandate` runs the same mandate rule on the due date. Represent calls none of these three systems: it will add checks and rules of its own once they are defined.
- A rule reads only the facts, never `Instant.now()` or a service. That is what makes it safe inside the workflow, where a replay must reach the same decision.
- The report keeps every rule's result. The commit's timeline row keeps the IDs of the rules that failed in its event JSON, and `billpay_verification_declines_total` counts declines by step and rule.
