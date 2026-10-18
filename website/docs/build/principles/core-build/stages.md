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

Every stage is a `{Step}Stage` interface with two functions. `run` does the step and returns what happened. `announce` tells RTF, and Raven where the customer is told, about the change `run` committed. The workflow calls them in that order, so a payment's events always reach RTF after the state they describe is in Oracle.

```kotlin
interface ExecuteStage {
    fun run(paymentId: String): ExecuteOutcome     // PROCESSING, after the calls succeed
    fun announce(paymentId: String)                // the PROCESSING event
}
```

The implementations are named for the behavior they serve, never for a market. `MandateVerifyStage` is the Verify that checks a mandate, wherever a market needs one. If two markets share a rule, they share the file, and a market's name in a class name usually means the rule was written in the wrong place.

## Writing run

A stage makes its calls first, in parallel wherever they don't depend on each other, and then commits once. Here is the Execute for a consumer payment, which clears, posts to Accounts Receivable (AR) and raises open-to-buy at the same time:

```kotlin
class RealtimeClearingExecuteStage(
    private val clearing: ClearingActivities,
    private val receivables: ReceivablesActivities,
    private val authorization: AuthorizationActivities,
    private val store: PaymentStore,               // a local activity
    private val events: LifecycleEventActivities,  // RTF
) : ExecuteStage {

    override fun run(paymentId: String): ExecuteOutcome {
        Promise.allOf(
            Async.function(clearing::clear, paymentId),
            Async.function(receivables::reduceBalance, paymentId),
            Async.function(authorization::raiseOpenToBuy, paymentId),
        ).get()
        // One commit: the guarded move, the timeline row with the cluster,
        // and any Work Tracker rows this step opens or closes.
        return store.commitExecute(paymentId, expected = ACCEPTED, next = PROCESSING)
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
class RealtimeClearingExecuteStage(...) : ExecuteStage
```

*(The annotation is illustrative; what matters is what it records.)*

For each plan key, the most specific match wins. A market override declares the same things plus its market, and lives in `market/{m}/stages/`. It is a more specific match for that market, so it beats the default there and nowhere else. Three rules keep the index honest:

- Every combination has a default implementation. A combination with none can't be onboarded at all.
- The same generated code produces the build's capability manifest, every behavior combination the build can run. Provisioning checks each market release against it before anything goes live.
- Stages are never `abstract`. A variation is a concrete class composed in through the index, not an override of a base class, so reading one file tells you everything a stage does.

Payment workflows are pinned to their build with Worker Versioning. A deploy that adds or changes a stage never changes the code under a payment that is already running.
