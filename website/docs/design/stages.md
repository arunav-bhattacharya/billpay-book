---
title: Stages
---

import Lead from '@site/src/components/Lead';

# Stages

<Lead>A stage is one state-transition decision point — a Kotlin class with a single function that does the validation, persistence, and event publication for that transition. It consumes one payment state and emits the next. Workflows call stages; a stage never calls a workflow or an external system directly.</Lead>

Every transition a payment makes is a stage. Which implementation runs is chosen from the market's dimensions, so the same transition can behave differently across markets without changing the workflow.

## The stages

| Stage | Transition | What it does |
| --- | --- | --- |
| `InitiatedToPendingStage` | input → `PENDING` | Persists the payment and its idempotency record and publishes `PENDING`. A duplicate index means the request isn't idempotent. |
| `PendingToAcceptedStage` | `PENDING` → `ACCEPTED` | Enriches and persists the accepted payment; publishes `ACCEPTED`. |
| `PendingToScheduledStage` | `PENDING` → `SCHEDULED` | Persists the scheduled payment; publishes `SCHEDULED`. |
| `PendingToDeclinedStage` | `PENDING` → `DECLINED` | Records the declined payment; publishes `DECLINED`. |
| `PendingToDisallowedStage` | `PENDING` → `DISALLOWED` | Records an inbound payment Amex did not accept. |
| `ScheduledToAcceptedStage` | `SCHEDULED` → `ACCEPTED` | Re-validates a scheduled payment on its execution date and accepts it. |
| `ScheduledToCancelledStage` | `SCHEDULED` → `CANCELLED` | Cancels a scheduled payment. |
| `AcceptedToProcessingStage` | `ACCEPTED` → `PROCESSING` | Sends to clearing, reduces the AR balance, and increases Open-To-Buy — in parallel, varying by account type and clearing rule. |
| `AcceptedToCancelledStage` | `ACCEPTED` → `CANCELLED` | Cancels an accepted payment. |
| `ProcessingToProcessedStage` | `PROCESSING` → `PROCESSED` | Notifies accounting, balance-and-control, and risk in parallel, then communications last. |
| `ToReturnedStage` | `PAID` / `PROCESSING` / `PROCESSED` → `RETURNED` | Records a returned payment and notifies downstream systems. |
| `ToRepresentingStage` | `RETURNED` → `REPRESENTING` | Enriches representment details and creates the representment transaction. |
| `RepresentingToRepresentedStage` | `REPRESENTING` → `REPRESENTED` | Clears and settles a re-attempted payment. |
| `RepresentingToDeclinedStage` | `REPRESENTING` → `DECLINED` | Declines a representment that fails validation. |
| `ToAllocatingStage` | `PENDING` / `SCHEDULED` → `ALLOCATING` | Requests the allocation breakdown from the allocation-processing system. |
| `ToAllocatedStage` | `ALLOCATING` → `ALLOCATED` | Records the received allocations and creates the split legs. |

See the [component model](./principles.md) for how stages sit between workflows and activity groups, and the [state model](./payment-state-model.md) for the states themselves.
