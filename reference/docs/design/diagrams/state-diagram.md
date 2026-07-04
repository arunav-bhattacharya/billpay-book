---
id: state-diagram
title: State Diagrams
sidebar_position: 1
---

# State Diagrams

One state diagram per workflow. Each diagram captures every transition the
workflow can perform and which **Payment Service(s)** drive it.

For a single, combined view of the full state model, see
[The Payment State Model](../payment-state-model.md).

## 1. Create Immediate Payment WF

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> DECLINED: invalid

  ACCEPTED --> PROCESSING: execute (Full / Split)
  PROCESSING --> PROCESSED: fulfill

  state "ACCEPTED (Splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF

  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

:::note[Service mapping]
- **idempotency** → `IdempotencyService`
- **validate** → `PaymentValidationService` + `PaymentStateTransitionService`
- **execute (Full / Split)** → `PaymentExecutionService` *(Full)* or `PaymentClearingService` *(Split, full-level clearing)*
- **fulfill** → `PaymentFulfillmentService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **notify** (DECLINED) → `EventNotificationService`
:::

## 2. Create Schedule Payment WF

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> SCHEDULED: validate
  PENDING --> DECLINED: invalid

  SCHEDULED --> [*]: notify
  DECLINED --> [*]: notify
```

:::note[Service mapping]
- **idempotency** → `IdempotencyService`
- **validate** → `PaymentValidationService` + `PaymentStateTransitionService`
- **notify** (SCHEDULED) → `EventNotificationService` *(Corporate additionally triggers `#GetCorporatePaymentAllocationsWF`)*
- **notify** (DECLINED) → `EventNotificationService`
:::

## 3. Execute Scheduled Payment WF

```mermaid
stateDiagram-v2
  state Entry <<choice>>
  [*] --> Entry
  Entry --> SCHEDULED
  Entry --> ALLOCATIONS_RECEIVED

  SCHEDULED --> ACCEPTED: validate
  ALLOCATIONS_RECEIVED --> ACCEPTED: validate
  SCHEDULED --> DECLINED: invalid
  ALLOCATIONS_RECEIVED --> DECLINED: invalid

  ACCEPTED --> PROCESSING: execute (Full / Split)
  PROCESSING --> PROCESSED: fulfill

  state "ACCEPTED (Splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF

  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

:::note[Service mapping]
- **validate** → `PaymentValidationService` + `PaymentStateTransitionService`
- **execute (Full / Split)** → `PaymentExecutionService` *(Full)* or `PaymentClearingService` *(Split, full-level clearing)*
- **fulfill** → `PaymentFulfillmentService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **notify** (DECLINED) → `EventNotificationService`
:::

## 4. Execute Split Payment WF

Operates at **split level** on `split_trans_dtl`.

```mermaid
stateDiagram-v2
  [*] --> ACCEPTED
  ACCEPTED --> PROCESSING: execute (clearing / posting)
  PROCESSING --> PROCESSED: fulfill
  PROCESSED --> [*]
```

:::note[Service mapping]
- **execute (clearing / posting)** → `PaymentExecutionService` *(split, clearing-at-split)* **or** `PaymentPostingService` *(split)*, both paired with `PaymentSplitStateTransitionService`
- **fulfill** → `PaymentFulfillmentService` *(split)* + `PaymentSplitStateTransitionService`
:::

## 5. Cancel Payment WF

```mermaid
stateDiagram-v2
  state CurrentState <<choice>>
  [*] --> CurrentState: idempotency + validate
  CurrentState --> SCHEDULED
  CurrentState --> ACCEPTED
  SCHEDULED --> CANCELLED: cancel
  ACCEPTED --> CANCELLED: cancel
  CANCELLED --> [*]
```

:::note[Service mapping]
- **idempotency + validate** → `IdempotencyService` + `PaymentCancelValidationService`
- **cancel** → `PaymentCancellationService` + `PaymentStateTransitionService`
:::

## 6. Update Payment WF

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency

  state "Original payment" as Orig {
    SCHEDULED --> CANCELLED: → #CancelPaymentWF
  }

  state "Replacement payment" as New {
    PENDING_new: PENDING
    PENDING_new --> SCHEDULED_new: → #CreateSchedulePaymentWF
    PENDING_new --> DECLINED_new: → #CreateSchedulePaymentWF
    SCHEDULED_new: SCHEDULED
    DECLINED_new: DECLINED
  }

  PENDING --> Orig
  PENDING --> New
  Orig --> Mapping: map old → new
  New --> Mapping
  Mapping --> [*]
```

:::note[Service mapping]
- **idempotency** → `IdempotencyService`
- **→ #CancelPaymentWF / → #CreateSchedulePaymentWF** → child workflows
- **map old → new** → `MapNewPaymentIdToPreviousIdService` *(records the relationship in `ORIG_TRANS_REFER_MAP`)*
:::

## 7. Process Returned Payment WF

```mermaid
stateDiagram-v2
  state Current <<choice>>
  state "PAID" as PaidSource
  [*] --> Current: idempotency + validate
  Current --> PaidSource
  Current --> PROCESSING
  Current --> PROCESSED

  PaidSource --> RETURNED: return
  PROCESSING --> RETURNED: return
  PROCESSED --> RETURNED: return

  RETURNED --> REPRESENTING: create representment
  RETURNED --> [*]
  REPRESENTING --> [*]: → #ProcessRepresentmentWF
```

:::note[Service mapping]
- **idempotency + validate** → `IdempotencyService` + `PaymentReturnValidationService`
- **return** → `PaymentReturnExecutionService` + `PaymentStateTransitionService`
- **create representment** → `PaymentRepresentmentEligibilityService` + `PaymentRepresentmentCreationService`
- **invalid return** (no state transition) → `EventNotificationService`
:::

## 8. Process Representment WF

```mermaid
stateDiagram-v2
  [*] --> REPRESENTING: validate
  REPRESENTING --> REPRESENTED: execute
  REPRESENTING --> DECLINED: invalid
  REPRESENTED --> [*]
  DECLINED --> [*]
```

:::note[Service mapping]
- **validate** → `PaymentRepresentmentValidationService`
- **execute** → `PaymentRepresentmentExecutionService` + `PaymentStateTransitionService`
- **invalid** → state transition only via `PaymentStateTransitionService`
:::

## 9. Get Corporate Payment Allocations WF

```mermaid
stateDiagram-v2
  state Source <<choice>>
  [*] --> Source
  Source --> SCHEDULED
  Source --> ACCEPTED

  SCHEDULED --> ALLOCATIONS_REQUESTED: request
  ACCEPTED  --> ALLOCATIONS_REQUESTED: request

  ALLOCATIONS_REQUESTED --> ALLOCATIONS_RECEIVED: receive + create splits

  ALLOCATIONS_RECEIVED --> [*]
```

:::note[Service mapping]
- **request** → `AllocationsRequestService` + `PaymentStateTransitionService`
- **receive + create splits** → `AllocationsReceivedService` + `PaymentSplitsCreationService` + `PaymentStateTransitionService`
:::

## 10. Process Inbound Payment WF

```mermaid
stateDiagram-v2
  state "DECLINED" as InboundDeclined
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> InboundDeclined: invalid

  ACCEPTED --> PROCESSING: post
  PROCESSING --> PROCESSED: fulfill

  state "ACCEPTED (Splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: → #ExecuteSplitPaymentWF

  InboundDeclined --> REJECTED: reject
  REJECTED --> [*]
  PROCESSED --> [*]
```

:::note[Service mapping]
- **idempotency** → `IdempotencyService`
- **validate** → `PaymentValidationService` + `PaymentStateTransitionService`
- **post** → `PaymentPostingService` + `PaymentStateTransitionService`
- **fulfill** → `PaymentFulfillmentService` + `PaymentStateTransitionService`
- **create splits (Consumer)** → `PaymentSplitsCreationService`
- **reject** → `PaymentRejectionService` + `PaymentStateTransitionService`
:::

## 11. Create Balance Refund WF

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> ACCEPTED
  PENDING --> DECLINED
  ACCEPTED --> PROCESSING
  PROCESSING --> PROCESSED
  PROCESSED --> [*]
  DECLINED --> [*]
```

## 12. Paid Events Processing Workflow

```mermaid
stateDiagram-v2
  [*] --> PROCESSED: idempotency + validate
  PROCESSED --> PAID: settle
  PAID --> [*]
```

:::note[Service mapping]
- **idempotency + validate** → `IdempotencyService` + `PaidEventValidationService`
- **settle** → `PaymentSettlementService` + `PaymentStateTransitionService`
:::
