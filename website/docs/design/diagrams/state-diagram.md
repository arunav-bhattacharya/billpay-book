---
title: State Diagrams
sidebar_label: State Diagram
---

# State Diagrams

The [payment state model](../payment-state-model.md) shows the whole lifecycle. This page takes it apart one workflow at a time — the states each workflow drives and how it hands off to the next. A `<<choice>>` diamond is a routing decision, not a state.

## Create Immediate Payment · `#CreateImmediatePaymentWF`

Validate, accept, then either run the payment straight through or, for a split, fan it out to `#ExecuteSplitPaymentWF`.

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> DECLINED: invalid
  ACCEPTED --> PROCESSING: execute (full / split)
  PROCESSING --> PROCESSED: fulfill
  state "ACCEPTED (splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: #ExecuteSplitPaymentWF
  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

## Create Schedule Payment · `#CreateSchedulePaymentWF`

Validate and park the payment at `SCHEDULED` for its future run date.

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> SCHEDULED: validate
  PENDING --> DECLINED: invalid
  SCHEDULED --> [*]: notify
  DECLINED --> [*]: notify
```

## Execute Scheduled Payment · `#ExecuteScheduledPaymentWF`

Runs on the execution date. It picks up a scheduled payment (or a corporate one that has already been allocated), re-validates, and processes it.

```mermaid
stateDiagram-v2
  state Entry <<choice>>
  [*] --> Entry
  Entry --> SCHEDULED
  Entry --> ALLOCATED
  SCHEDULED --> ACCEPTED: validate
  ALLOCATED --> ACCEPTED: validate
  SCHEDULED --> DECLINED: invalid
  ALLOCATED --> DECLINED: invalid
  ACCEPTED --> PROCESSING: execute (full / split)
  PROCESSING --> PROCESSED: fulfill
  state "ACCEPTED (splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: #ExecuteSplitPaymentWF
  DECLINED --> [*]: notify
  PROCESSED --> [*]
```

## Execute Split Payment · `#ExecuteSplitPaymentWF`

Processes one split leg — the same clearing, posting, and fulfilment as a full payment, at the leg level.

```mermaid
stateDiagram-v2
  [*] --> ACCEPTED
  ACCEPTED --> PROCESSING: execute (clearing / posting)
  PROCESSING --> PROCESSED: fulfill
  PROCESSED --> [*]
```

## Cancel Payment · `#CancelPaymentWF`

Cancels a payment that hasn't processed yet — either scheduled or accepted.

```mermaid
stateDiagram-v2
  state Current <<choice>>
  [*] --> Current: idempotency + validate
  Current --> SCHEDULED
  Current --> ACCEPTED
  SCHEDULED --> CANCELLED: cancel
  ACCEPTED --> CANCELLED: cancel
  CANCELLED --> [*]
```

## Update Payment · `#UpdatePaymentWF`

Cancels the original scheduled payment, creates a replacement, and maps the new payment back to the old one for the audit trail.

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  state "Original payment" as Orig {
    SCHEDULED --> CANCELLED: #CancelPaymentWF
  }
  state "Replacement payment" as New {
    PENDING_new: PENDING
    PENDING_new --> SCHEDULED_new: #CreateSchedulePaymentWF
    PENDING_new --> DECLINED_new: #CreateSchedulePaymentWF
    SCHEDULED_new: SCHEDULED
    DECLINED_new: DECLINED
  }
  PENDING --> Orig
  PENDING --> New
  Orig --> Mapping: map old to new
  New --> Mapping
  Mapping --> [*]
```

## Process Returned Payment · `#ProcessReturnedPaymentWF`

A payment that has processed, been fulfilled, or been paid can still be returned by the bank. If the return is representable, it spawns a representment.

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
  REPRESENTING --> [*]: #ProcessRepresentmentWF
```

## Process Representment · `#ProcessRepresentmentWF`

Re-attempts a returned payment. It settles as `REPRESENTED`, or fails validation as `DECLINED`.

```mermaid
stateDiagram-v2
  [*] --> REPRESENTING: validate
  REPRESENTING --> REPRESENTED: execute
  REPRESENTING --> DECLINED: invalid
  REPRESENTED --> [*]
  DECLINED --> [*]
```

## Get Corporate Payment Allocations · `#GetCorporatePaymentAllocationsWF`

Requests a corporate payment's allocation breakdown, waits for it, creates the split legs, and hands each to `#ExecuteSplitPaymentWF`.

```mermaid
stateDiagram-v2
  state Source <<choice>>
  [*] --> Source
  Source --> SCHEDULED
  Source --> ACCEPTED
  SCHEDULED --> ALLOCATING: request
  ACCEPTED --> ALLOCATING: request
  ALLOCATING --> ALLOCATED: receive + create splits
  ALLOCATED --> [*]
```

## Process Inbound Payment · `#ProcessInboundPaymentWF`

Handles a payment a third party initiates. If Amex doesn't accept it, the payment is `DISALLOWED`.

```mermaid
stateDiagram-v2
  [*] --> PENDING: idempotency
  PENDING --> ACCEPTED: validate
  PENDING --> DISALLOWED: not accepted
  ACCEPTED --> PROCESSING: post
  PROCESSING --> PROCESSED: fulfill
  state "ACCEPTED (splits)" as ACCEPTED_SPLITS
  ACCEPTED --> ACCEPTED_SPLITS: create splits (Consumer)
  ACCEPTED_SPLITS --> [*]: #ExecuteSplitPaymentWF
  DISALLOWED --> [*]
  PROCESSED --> [*]
```

## Create Balance Refund · `#CreateBalanceRefundWF`

Sends money back to the customer from a credit balance, following the same validate-process-fulfil path as a payment.

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> ACCEPTED: validate
  PENDING --> DECLINED: invalid
  ACCEPTED --> PROCESSING
  PROCESSING --> PROCESSED
  PROCESSED --> [*]
  DECLINED --> [*]
```

## Paid Events Processing · `#PaidEventsProcessingWF`

The periodic sweep that closes a payment out. A `PROCESSED` payment becomes `PAID` only once both its clearing-settlement and AR-posted events have arrived.

```mermaid
stateDiagram-v2
  [*] --> PROCESSED: both events arrived
  PROCESSED --> PAID: settle
  PAID --> [*]
```
