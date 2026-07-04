---
title: ActivityGroups & Activities
sidebar_label: ActivityGroups & Activities
---

import Lead from '@site/src/components/Lead';

# ActivityGroups & Activities

<Lead>An activity is one retryable action — publish an event, persist a record, update a downstream balance. An activity group coordinates a cohesive set of them for a single business concern. Activities are shared across markets and stay thin, delegating protocol details to clients.</Lead>

Groups whose behaviour varies by market carry their dimensions; the rest are generic.

| Activity / ActivityGroup | State transition | What it does |
| --- | --- | --- |
| `PersistPendingPaymentActivity` | input → `PENDING` | Inserts the idempotency, transaction-detail, and lifecycle-event rows and publishes `PENDING`. From `InitiatedToPendingStage`. |
| `IdempotencyCheckActivity` | — | Inserts the idempotency record for an API; a duplicate means a repeat request. From workflows that check idempotency. |
| `PaymentValidationActivityGroup` *(all dimensions)* | `PENDING` → `ACCEPTED` / `SCHEDULED` / `DECLINED` | Calls external systems and evaluates whether the payment is valid. From the create workflows. |
| `PaymentValidationOnExecutionActivityGroup` *(all dimensions)* | `SCHEDULED` / `ALLOCATED` → `ACCEPTED` / `DECLINED` | Re-validates a scheduled payment on execution, fetching what it needs first. From `#ExecuteScheduledPaymentWF`. |
| `PaymentStateTransitionActivity` | any | Updates the transaction-detail and lifecycle-event tables and publishes the event for a payment-level transition. From every stage. |
| `PaymentSplitStateTransitionActivity` | any (split level) | The same, at the split level. From stages that handle splits. |
| `PaymentScheduledNotificationActivityGroup` *(accountType, requiresArPosting)* | — | Notifies systems when a payment is scheduled. From `PendingToScheduledStage`. |
| `PaymentDeclinedNotificationActivityGroup` *(accountType, requiresArPosting)* | — | Notifies systems when a payment is declined. From `PendingToDeclinedStage`. |
| `PaymentAllocatingActivityGroup` | `PENDING` / `SCHEDULED` → `ALLOCATING` | Requests allocations for a corporate payment. From `ToAllocatingStage`. |
| `PaymentAllocatedActivityGroup` | `ALLOCATING` → `ALLOCATED` | Receives the allocations. From `ToAllocatedStage`. |
| `PaymentExecutionActivityGroup` *(accountType, requiresArPosting, requiresRealtimeClearing)* | `ACCEPTED` → `PROCESSING` | In parallel: send to clearing, reduce the AR balance, increase Open-To-Buy. From `AcceptedToProcessingStage`. |
| `PaymentFulfillmentActivityGroup` *(accountType)* | `PROCESSING` → `PROCESSED` | Notifies accounting and balance-and-control, then communications. From `ProcessingToProcessedStage`. |
| `PaymentSplitsCreationActivity` | `ACCEPTED` (full) → `ACCEPTED` (split) | Creates the split legs and publishes their lifecycle events. From the create and execute workflows. |
| `PaymentCancelValidationActivityGroup` *(accountType)* | — | Checks state and external eligibility for a cancellation. From `#CancelPaymentWF`. |
| `PaymentCancellationActivityGroup` *(accountType, requiresArPosting)* | `SCHEDULED` / `ACCEPTED` → `CANCELLED` | Notifies systems once a payment is cancelled. From `#CancelPaymentWF`. |
| `PaymentReturnValidationActivity` | — | Checks the current state of a returned payment. From `#ProcessReturnedPaymentWF`. |
| `PaymentReturnExecutionActivityGroup` *(accountType)* | `PROCESSING` / `PROCESSED` / `PAID` → `RETURNED` | Notifies systems once a payment is returned. From `ToReturnedStage`. |
| `PaymentRepresentmentEligibilityActivityGroup` *(all dimensions)* | — | Checks whether a return can be re-presented. From `#ProcessReturnedPaymentWF`. |
| `PaymentRepresentmentCreationActivityGroup` | `RETURNED` → `REPRESENTING` | Creates the representment transaction. From `ToRepresentingStage`. |
| `PaymentRepresentmentValidationActivityGroup` *(all dimensions)* | — | Re-checks representment eligibility on the processing day. From `#ProcessRepresentmentWF`. |
| `PaymentRepresentmentExecutionActivityGroup` *(all dimensions)* | `REPRESENTING` → `REPRESENTED` | Clears and notifies systems once re-presented. From `RepresentingToRepresentedStage`. |
| `MapNewPaymentIdToPreviousIdActivity` | — | Maps a replacement payment id to the original for the audit trail. From `#UpdatePaymentWF`. |

For the layering that governs what may call what, see the [component model](./principles.md).
