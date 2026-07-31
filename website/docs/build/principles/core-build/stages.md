---
title: Building Stages
sidebar_label: Stages
---

import Lead from '@site/src/components/Lead';

# Building Stages

<Lead>A stage is one state transition, as code: a Kotlin class with a single function that takes the payment in one state and returns it in the next, doing the persistence and event publication for exactly that move. Workflows sequence stages; stages do the transitions. Nothing else does.</Lead>

## What a stage looks like

Naming is mechanical: `{From}To{To}Stage`. `InitiatedToPendingStage`, `PendingToAcceptedStage`, `AcceptedToProcessingStage`. The name tells you the edge. One class, one public function, one transition.

The [domain model](../../domain-model/payment.md) types the transition for you. Each lifecycle state is its own Kotlin type and the edges between them are extension functions, so a stage's signature *is* its contract.

```kotlin
class PendingToAcceptedStage(
    private val stateTransition: PaymentStateTransitionActivity,
) {
    fun execute(payment: PendingFullPayment): AcceptedFullPayment {
        // Enrich: the verified option, instrument, amount and executable
        // timeline come out of validation, upstream of this stage.
        val accepted = payment.toAcceptedFullPayment(amount, timeline, option, instrument)

        // Persist the move and publish the ACCEPTED lifecycle event.
        stateTransition.transition(accepted)

        return accepted
    }
}
```

*(Shape, simplified. The real signatures carry more context.)* The compiler is doing real work here. You cannot hand this stage a `ScheduledFullPayment`, and you cannot forget that acceptance requires a **verified** option and instrument, because `toAcceptedFullPayment` will not accept anything less.

## Rules for stages

Design sets the [rules a stage obeys](../../../design/principles.md). What they mean when you are writing one:

- The constructor takes activity groups and activities, and nothing else. There is no workflow, stage, or client to inject, so the call rule holds by construction.
- End every `execute` with `PaymentStateTransitionActivity`, or its split-level twin for a leg. That single call does the detail-row update, the lifecycle-event append, and the publish to Lumi via RTF. A transition that skips it is a state change nobody can trace.
- Write a concrete class per dimension combination rather than an `abstract` base with overrides. A combination that makes no sense, say a corporate account with no AR posting, simply has no class, which is what stops a workflow starting with it.
- Put the behaviour in the class name. If the UK and Singapore share a non-realtime clearing rule, they share one file. A market name in a class name usually means the rule was written in the wrong place.

## Where they live

Defaults in `core/lib/stages/impl/`, market overrides in `market/{m}/stages/`. The per-workflow catalogue of stages, showing which workflow runs which and in what order, is in [Design → Stages](../../../design/component-model/stages.md).
