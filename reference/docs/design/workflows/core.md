---
id: core
title: Core Workflows
sidebar_position: 1
---

# Core Workflows

Core workflows are Billpay's **single-responsibility orchestrations**. Each
workflow advances a payment through a well-defined slice of its lifecycle,
using [Payment Services](../services.md) as activities.

| # | Workflow | Worker | Trigger |
| -- | --- | --- | --- |
| 1 | [`#CreateImmediatePaymentWF`](#1-createimmediatepaymentwf) | Realtime | `POST /payments`, date = today |
| 2 | [`#CreateSchedulePaymentWF`](#2-createschedulepaymentwf) | Realtime / Batch | `POST /payments`, date = future |
| 3 | [`#ExecuteScheduledPaymentWF`](#3-executescheduledpaymentwf) | Batch | Schedule executor |
| 4 | [`#ExecuteSplitPaymentWF`](#4-executesplitpaymentwf) | Realtime / Batch | Triggered from another workflow |
| 5 | [`#CancelPaymentWF`](#5-cancelpaymentwf) | Realtime | `DELETE /payments/{id}` |
| 6 | [`#UpdatePaymentWF`](#6-updatepaymentwf) | Realtime | `PUT /payments/{id}` |
| 7 | [`#ProcessReturnedPaymentWF`](#7-processreturnedpaymentwf) | Batch | Money Movement Event Handler |
| 8 | [`#ProcessRepresentmentWF`](#8-processrepresentmentwf) | Batch | After a representable return |
| 9 | [`#GetCorporatePaymentAllocationsWF`](#9-getcorporatepaymentallocationswf) | Batch | Corporate payment creation |
| 10 | [`#ProcessInboundPaymentWF`](#10-processinboundpaymentwf) | Batch | `POST /payments/inbound` |
| 11 | [`#CreateBalanceRefundWF`](#11-createbalancerefundwf) | Realtime / Batch | `POST /refunds` |

:::tip
For the state-machine view of every workflow on a single page, jump to
[State Diagrams](../diagrams/state-diagram.md).
:::

## 1. `#CreateImmediatePaymentWF`

- **Worker:** Realtime
- **Triggered by:** `POST /payments` with `payment-date = today`, single instruction

**Steps**

1. `Input → PENDING` via `IdempotencyService`
2. `PENDING → ACCEPTED` *or* `DECLINED` via `PaymentValidationService` + `PaymentStateTransitionService`
3. **If `ACCEPTED` & Full payment:**
   - `ACCEPTED → PROCESSING` via `PaymentExecutionService` + `PaymentStateTransitionService`
   - `PROCESSING → PROCESSED` via `PaymentFulfillmentService` + `PaymentStateTransitionService`
4. **Else if `ACCEPTED` & Split payment:**
   - **Corporate** → trigger `#GetCorporatePaymentAllocationsWF`
   - **Consumer** → create splits via `PaymentSplitsCreationService`, then trigger `#ExecuteSplitPaymentWF`
   - If **clearing at Full level** → `ACCEPTED → PROCESSING` via `PaymentClearingService` + `PaymentStateTransitionService`
5. **Else if `DECLINED`:**
   - `EventNotificationService`

## 2. `#CreateSchedulePaymentWF`

- **Worker:** Realtime (when called from API) or Batch (when fanned out)
- **Triggered by:** `POST /payments` with `payment-date = future`

**Steps**

1. `Input → PENDING` via `IdempotencyService`
2. `PENDING → SCHEDULED` *or* `DECLINED` via `PaymentValidationService` + `PaymentStateTransitionService`
3. **If `SCHEDULED`:**
   - `EventNotificationService`
   - If **Corporate** → trigger `#GetCorporatePaymentAllocationsWF`
4. **If `DECLINED`:**
   - `EventNotificationService`

## 3. `#ExecuteScheduledPaymentWF`

- **Worker:** Batch
- **Triggered by:** the **Scheduled Payment Executor** schedule

**Steps**

1. `SCHEDULED` / `ALLOCATIONS_RECEIVED` → `ACCEPTED` *or* `DECLINED` via `PaymentValidationService` + `PaymentStateTransitionService`
2. **If `ACCEPTED` & Full payment:**
   - `ACCEPTED → PROCESSING` via `PaymentExecutionService` + `PaymentStateTransitionService`
   - `PROCESSING → PROCESSED` via `PaymentFulfillmentService` + `PaymentStateTransitionService`
3. **Else if `ACCEPTED` & Split payment:**
   - **Consumer** → create splits at split-tx level via `PaymentSplitsCreationService`, then trigger `#ExecuteSplitPaymentWF`
   - If **clearing at Full level** → `ACCEPTED → PROCESSING` via `PaymentClearingService` + `PaymentStateTransitionService`
4. **Else if `DECLINED`:**
   - `EventNotificationService`

## 4. `#ExecuteSplitPaymentWF`

- **Worker:** Realtime or Batch (depending on parent)
- **Triggered by:** `#CreateImmediatePaymentWF`, `#ExecuteScheduledPaymentWF`, or the **Corporate Allocations Processor** schedule

**Steps**

1. **If clearing at Split level:**
   - `ACCEPTED → PROCESSING` via `PaymentExecutionService` (split level) + `PaymentSplitStateTransitionService`
2. **Else:**
   - `ACCEPTED → PROCESSING` via `PaymentPostingService` (split level) + `PaymentSplitStateTransitionService`
3. `PROCESSING → PROCESSED` via `PaymentFulfillmentService` (split level) + `PaymentSplitStateTransitionService`

## 5. `#CancelPaymentWF`

- **Worker:** Realtime
- **Triggered by:** `DELETE /payments/{id}`

**Steps**

1. `IdempotencyService` (no state transition)
2. `PaymentCancelValidationService` (no state transition)
3. **If eligible:** `SCHEDULED` / `ACCEPTED` → `CANCELLED` via `PaymentCancellationService` + `PaymentStateTransitionService`

## 6. `#UpdatePaymentWF`

- **Worker:** Realtime
- **Triggered by:** `PUT /payments/{id}`

**Steps**

1. `Input → PENDING` via `IdempotencyService`
2. Cancel the original: `SCHEDULED → CANCELLED` via child `#CancelPaymentWF`
3. Create the replacement: `PENDING → SCHEDULED` *or* `DECLINED` via child `#CreateSchedulePaymentWF`
4. Persist the link old → new via `MapNewPaymentIdToPreviousIdService`

## 7. `#ProcessReturnedPaymentWF`

- **Worker:** Batch
- **Triggered by:** the Money Movement Event Handler

**Steps**

1. `IdempotencyService` + `PaymentReturnValidationService`
2. **If valid return** (also identify split vs. full):
   - `PAID` / `PROCESSING` / `PROCESSED` → `RETURNED` via `PaymentReturnExecutionService` + `PaymentStateTransitionService`
   - If representable (`PaymentRepresentmentEligibilityService`):
     - Create a new `REPRESENTING` presentment via `PaymentRepresentmentCreationService`
3. **Else (invalid return):** notify via `EventNotificationService` — no state transition, payment stays in its current state

## 8. `#ProcessRepresentmentWF`

- **Worker:** Batch
- **Triggered by:** `#ProcessReturnedPaymentWF` for representable returns

**Steps**

1. `REPRESENTING` evaluated by `PaymentRepresentmentValidationService`
2. **If valid:** `REPRESENTING → REPRESENTED` via `PaymentRepresentmentExecutionService` + `PaymentStateTransitionService`
3. **Else:** `REPRESENTING → DECLINED` via `PaymentStateTransitionService`

## 9. `#GetCorporatePaymentAllocationsWF`

- **Worker:** Batch
- **Triggered by:** any corporate payment workflow

**Steps**

1. `SCHEDULED` / `ACCEPTED` → `ALLOCATIONS_REQUESTED` via `AllocationsRequestService` + `PaymentStateTransitionService`
2. `ALLOCATIONS_REQUESTED → ALLOCATIONS_RECEIVED` via `AllocationsReceivedService` + `PaymentSplitsCreationService` + `PaymentStateTransitionService`

## 10. `#ProcessInboundPaymentWF`

- **Worker:** Batch
- **Triggered by:** `POST /payments/inbound`

**Steps**

1. `Input → PENDING` via `IdempotencyService`
2. `PENDING → ACCEPTED` *or* `DECLINED` via `PaymentValidationService` + `PaymentStateTransitionService`
3. **If `ACCEPTED` & Full:**
   - `PROCESSING` via `PaymentPostingService` + `PaymentStateTransitionService`
   - `PROCESSED` via `PaymentFulfillmentService` + `PaymentStateTransitionService`
4. **Else if `ACCEPTED` & Split (Consumer):**
   - Create splits via `PaymentSplitsCreationService`
   - Trigger `#ExecuteSplitPaymentWF`
5. **Else if `DECLINED`:**
   - `REJECTED` via `PaymentRejectionService` + `PaymentStateTransitionService`

## 11. `#CreateBalanceRefundWF`

- **Worker:** Realtime or Batch
- **Triggered by:** `POST /refunds`

**Steps**

1. `PENDING`
2. `ACCEPTED` *or* `DECLINED` (terminal)
3. `PROCESSING`
4. `PROCESSED`

:::info
The exact services for the balance-refund workflow are TBD in the source spec.
See [Payment Services](../services.md) for `Generic` services
that compose into this flow.
:::
