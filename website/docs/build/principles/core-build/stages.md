---
title: Building Stages
sidebar_label: Stages
---

import Lead from '@site/src/components/Lead';

# Building Stages

<Lead>A stage is one state transition, as code: a Kotlin class with a single function that takes the payment in one state and returns it in the next, doing the persistence and event publication for exactly that move. Workflows sequence stages; stages do the transitions. Nothing else does.</Lead>

## What a stage looks like

Naming is mechanical: `{From}To{To}Stage`. `InitiatedToPendingStage`, `PendingToAcceptedStage`, `AcceptedToProcessingStage`. The name tells you the edge. One class, one public function, one transition.

The [domain model](../../data-model/payment.md) types the transition for you. Each lifecycle state is its own Kotlin type and the edges between them are extension functions, so a stage's signature *is* its contract.

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

- **A stage calls activity groups and activities. Nothing else.** Not workflows, not other stages, not clients. If a stage wants another transition to happen, that is the workflow's decision to make.
- **Every transition persists and publishes.** Updating the transaction detail row, appending to the lifecycle-event log, and publishing the event to Lumi via RTF is what `PaymentStateTransitionActivity` (or its split-level twin) is for, and every stage ends with it. A state change that is not recorded cannot be traced afterwards.
- **Never `abstract`.** Stages vary by composition, same as workflows.
- **One default implementation per dimension combination.** Every stage has a default for a given set of dimensions. Where a combination makes no sense, say a corporate account with no AR posting, there is no implementation at all, and no workflow can start with it. At runtime the market's profile picks which implementation the workflow composes. See the [additional rules](../../../design/principles.md) in Design.
- **Name for behaviour, not market.** If the UK and Singapore share a non-realtime clearing rule, they share one stage implementation with a behavioural name. A market name in a class name usually means the rule was written in the wrong place.

## Where they live

Defaults in `core/lib/stages/impl/`, market overrides in `market/{m}/stages/`. The per-workflow catalogue of stages, showing which workflow runs which and in what order, is in [Design → Stages](../../../design/stages.md).
