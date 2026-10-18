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
val stages = StageIndex.lookup(plan)               // inside the workflow
```

`StageIndex` is generated at build time by KSP (Kotlin Symbol Processing), from what each implementation declares it serves. A declaration names the step and the behaviors it covers, and leaves out the ones it doesn't care about:

```kotlin
@StageFor(step = EXECUTE, requiresRealtimeClearing = Y)
class PaymentExecuteStageWithRealtimeClearing(...) : PaymentExecuteStage
```

*(The annotation is illustrative; what matters is what it records.)*

For each plan key, the most specific match wins. A market override declares the same things plus its market, and lives in `market/{m}/stages/`. It is a more specific match for that market, so it beats the default there and nowhere else. That is why the plan key carries the market (Proposed). [Design → Routing](../../../design/routing.md#from-profile-to-stages) follows one profile through to the classes it runs. Four rules keep the index honest:

- Every combination has a default implementation. A combination with none can't be onboarded at all.
- The same generated code produces the build's capability manifest, every behavior combination the build can run. Provisioning checks each market release against it before anything goes live.
- Stages are never `abstract`. A variation is a concrete class composed in through the index, not an override of a base class, so reading one file tells you everything a stage does.
- A class's name must match its declaration. The processor builds the expected name from the step and what the class declares, and fails the build when the class is called anything else, so no name can drift from what the class serves.

Payment workflows are pinned to their build with Worker Versioning. A deploy that adds or changes a stage never changes the code under a payment that is already running.

## Naming an implementation

A stage interface is `Payment{Step}Stage`. An implementation keeps that name and adds what it serves, in a fixed order: `For` and the account type, `With` and each behavior it needs, then `In` and the market for an override. The one that declares nothing is `DefaultPayment{Step}Stage`. [Design → Stages](../../../design/component-model/stages.md#naming-implementations) has the full rule and a table of examples.

A name says what an implementation serves, never what it calls. A market that needs a mandate doesn't get a mandate stage: it gets a version of Verify that also calls Plans, which checks the mandate. The calls every Verify makes are written once, in a plain function, so this version adds only what is new:

```kotlin
/** The Instruments and Options calls every Verify makes. A plain function, not a base class. */
fun instrumentAndOptionChecks(
    instruments: InstrumentActivities,
    options: OptionsActivities,
    paymentId: String,
): Promise<Void> = Promise.allOf(
    Async.function(instruments::verify, paymentId),
    Async.function(options::resolveAmount, paymentId),
)

@StageFor(step = VERIFY, requiresMandateAuthorization = Y)
class PaymentVerifyStageWithMandate(
    private val instruments: InstrumentActivities,
    private val options: OptionsActivities,
    private val plans: PlansActivities,          // Plans, on the workflow's queue
    private val store: PaymentStore,
) : PaymentVerifyStage {

    override fun run(paymentId: String): VerifyOutcome {
        val checked = Promise.allOf(
            instrumentAndOptionChecks(instruments, options, paymentId),
            Async.function(plans::verifyMandate, paymentId),
        )
        // A business failure, such as a mandate Plans can't verify, means DECLINED. It is never retried.
        val next = if (passed(checked)) ACCEPTED else DECLINED
        return store.commitVerify(paymentId, expected = PENDING, next = next)
    }
}
```

*(A sketch: the method names are illustrative.)*

On the due date the same payment runs `PaymentReverifyStageWithMandate`, which calls Plans again. Represent doesn't check the mandate.
