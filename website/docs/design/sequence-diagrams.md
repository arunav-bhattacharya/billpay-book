---
title: Sequence Diagrams
description: "End-to-end traces from a caller's perspective."
sidebar_label: Sequence Diagrams
---

import Lead from '@site/src/components/Lead';

# Sequence Diagrams

<Lead>**End-to-end traces from a caller's perspective.** Each one follows a single Billpay flow from the caller through the Core API and the Router to the Workflows, and on to the ActivityGroups and Activities that do the work.</Lead>

<details>
<summary>How to read these diagrams</summary>

- The navy group at the top is the caller: the client and the contract it calls, such as `CreatePayment.v3`. The light-blue group is the Billpay Platform, everything past that contract. Reconciliation flows show only the platform group.
- Amex-blue blocks are a workflow on an **online** worker, in the request path with the caller waiting. Electric-blue blocks are a workflow on an **offline** worker: schedules, event handlers, and anything drained in batches.
- Pale-blue blocks are a sub-workflow invoked from inside another.
- Dashed gold marks async work that runs after the caller has been answered.
- Chips such as `state → ACCEPTED` mark a lifecycle transition. They are one colour throughout, because the chip already names the state. The [payment state model](./payment-state-model.md) is where outcomes are colour-coded.
- Each ActivityGroup or Activity is its own participant, labelled short: `Execution` for `PaymentExecutionActivityGroup`, `Capture` for `IdempotencyCheckActivity`, `Validation` for `PaymentValidationActivityGroup`.
- External systems are left out (clearing, Accounts Receivable, Open-To-Buy, accounting, the database, the event bus). Each is internal to the group that owns it.
- Diagrams fit their column. The wider ones carry an expand control in the top right, which opens a full-window view at window width or actual size. Escape closes it.

</details>

## 1. Immediate payment, single instruction

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
    participant ODF as CreatePayment.v3
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant WF as Immediate WF
    participant IDEMP as Capture
    participant PVAL as Validation
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>ODF: CreatePayment.v3 (date=today, single)
  ODF->>API: POST /payments
  API->>R: route(date=today, single)
  R->>WF: invoke(workflow-key)

  rect rgba(1,91,179,0.10)
    Note over WF,PVAL: Online Worker
    WF->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>WF: state → PENDING
    end
    WF->>PVAL: validate
    alt validation passes
      rect rgba(0,98,182,0.20)
        PVAL-->>WF: state → ACCEPTED
      end
    else validation fails
      rect rgba(0,98,182,0.20)
        PVAL-->>WF: state → DECLINED
      end
      WF->>PFL: notify decline
    end
  end

  Note over C,WF: 201 · ACCEPTED or DECLINED
  WF-->>API: success (payment-id, ACCEPTED or DECLINED)
  API-->>ODF: 201 Created
  ODF-->>C: payment-id, status

  rect rgba(198,146,20,0.20)
    Note over WF,PFL: Online Worker
    opt only in ACCEPTED state
      WF->>PEX: execute
      rect rgba(0,98,182,0.20)
        PEX-->>WF: state → PROCESSING
      end
      WF->>PFL: fulfill
      rect rgba(0,98,182,0.20)
        PFL-->>WF: state → PROCESSED
      end
    end
  end
```

<details>
<summary>What happens</summary>

- `CreatePayment.v3` calls `POST /payments` with today's date and a single instruction, and the Router picks `CreateImmediatePaymentWF`.
- The workflow captures the payment and checks idempotency (`IdempotencyCheckActivity`), then validates (`PaymentValidationActivityGroup`).
- On `ACCEPTED` the caller gets its 201 straight away, and execution (`PaymentExecutionActivityGroup`) and fulfillment (`PaymentFulfillmentActivityGroup`) run in the background.
- A failed validation declines instead, and fulfillment sends the decline notification.

</details>

## 2. Scheduled payment, created today and executed later

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CSP as Schedule WF
    participant IDEMP as Capture
    participant PVS as Validation
    participant PSN as Scheduled
    participant SCH as Sched. Executor
    participant ESP as Exec Scheduled WF
    participant PVX as Validate (exec)
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (date=future)
  API->>R: route(date=future)
  R->>CSP: invoke(workflow-key)

  rect rgba(1,91,179,0.10)
    Note over CSP,PVS: Online Worker
    CSP->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>CSP: state → PENDING
    end
    CSP->>PVS: validate schedule
    alt validation passes
      rect rgba(0,98,182,0.20)
        PVS-->>CSP: state → SCHEDULED
      end
      CSP->>PSN: notify scheduled
    else validation fails
      rect rgba(0,98,182,0.20)
        PVS-->>CSP: state → DECLINED
      end
      CSP->>PFL: notify decline
    end
  end

  CSP-->>API: SCHEDULED or DECLINED
  API-->>C: 201 Created (status)

  Note over SCH,ESP: On payment date · Sched. Executor fires (2,500/min), only SCHEDULED

  rect rgba(198,146,20,0.20)
    Note over SCH,PFL: Offline Worker
    SCH->>ESP: pick up SCHEDULED payments (batches of 2,500/min)
    ESP->>PVX: validate
    alt validation passes
      rect rgba(0,98,182,0.20)
        PVX-->>ESP: state → ACCEPTED
      end
      ESP->>PEX: execute
      rect rgba(0,98,182,0.20)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill
      rect rgba(0,98,182,0.20)
        PFL-->>ESP: state → PROCESSED
      end
    else validation fails
      rect rgba(0,98,182,0.20)
        PVX-->>ESP: state → DECLINED
      end
      ESP->>PFL: notify decline on execution
    end
  end
```

<details>
<summary>What happens</summary>

- `CreatePayment.v3` calls `POST /payments` with a future date, and the Router picks `CreateSchedulePaymentWF`.
- That workflow validates the schedule (`PaymentValidationActivityGroup`) and notifies on success (`PaymentScheduledNotificationActivityGroup`).
- On the payment date the Scheduled Payment Executor drains `SCHEDULED` payments into `ExecuteScheduledPaymentWF`, 2,500 a minute.
- `ExecuteScheduledPaymentWF` re-validates (`PaymentValidationOnExecutionActivityGroup`) before executing and fulfilling.
- Either validation can decline, and fulfillment (`PaymentFulfillmentActivityGroup`) sends the notification both times.
- `PROCESSED` is not the end of it. `PAID` is reached separately by the Paid Events Processor reconciliation, in [diagram #10](#10-paid-events-reconciliation).

</details>

## 3. Immediate Corporate Payment

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CIP as Immediate WF
    participant IDEMP as Capture
    participant PVAL as Validation
    participant GPA as Allocations WF
    participant ARQ as Allocating
    participant ARC as Allocated
    participant PSC as Splits
    participant ESP as Split WF
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (corporate, today)
  API->>R: route(date=today, corporate)
  R->>CIP: invoke

  rect rgba(1,91,179,0.10)
    Note over CIP,PVAL: Online Worker
    CIP->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>CIP: state → PENDING
    end
    CIP->>PVAL: validate
    alt validation passes
      rect rgba(0,98,182,0.20)
        PVAL-->>CIP: state → ACCEPTED
      end
    else validation fails
      rect rgba(0,98,182,0.20)
        PVAL-->>CIP: state → DECLINED
      end
      CIP->>PFL: notify decline
    end
  end

  Note over C,CIP: 201 · ACCEPTED or DECLINED
  CIP-->>API: success (payment-id, ACCEPTED or DECLINED)
  API-->>C: 201 Created

  rect rgba(198,146,20,0.20)
    Note over CIP,PFL: Async
    opt only in ACCEPTED state

      rect rgba(0,163,224,0.13)
        Note over GPA,PSC: Offline Worker
        CIP->>GPA: trigger allocations workflow
        GPA->>ARQ: request allocations
        rect rgba(0,98,182,0.20)
          ARQ-->>GPA: state → ALLOCATING
        end
        GPA->>ARC: process allocations payload
        rect rgba(0,98,182,0.20)
          ARC-->>GPA: state → ALLOCATED
        end
        GPA->>PSC: create payment splits
      end

      rect rgba(0,163,224,0.13)
        Note over ESP,PFL: Offline Worker
        GPA->>ESP: trigger split execution
        ESP->>PEX: execute split
        rect rgba(0,98,182,0.20)
          PEX-->>ESP: state → PROCESSING
        end
        ESP->>PFL: fulfill split
        rect rgba(0,98,182,0.20)
          PFL-->>ESP: state → PROCESSED
        end
      end
    end
  end
```

<details>
<summary>What happens</summary>

- `POST /payments` with `payment-date = today` and a corporate marker runs `CreateImmediatePaymentWF`.
- On `ACCEPTED` the parent fans out to `GetCorporatePaymentAllocationsWF`.
- That workflow requests allocations (`PaymentAllocatingActivityGroup`), receives them (`PaymentAllocatedActivityGroup`), and creates the split legs (`PaymentSplitsCreationActivity`).
- `ExecuteSplitPaymentWF` then runs once per split.
- A failed validation declines before any of that, and fulfillment (`PaymentFulfillmentActivityGroup`) sends the notification.

</details>

## 4. Scheduled Corporate Payment

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CSP as Schedule WF
    participant IDEMP as Capture
    participant PVS as Validation
    participant GPA as Allocations WF
    participant ARQ as Allocating
    participant ARC as Allocated
    participant PSC as Splits
    participant SCH as Sched. Executor
    participant ESPS as Exec Scheduled WF
    participant PVX as Validate (exec)
    participant ESP as Split WF
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (corporate, future)
  API->>R: route(date=future, corporate)
  R->>CSP: invoke

  rect rgba(1,91,179,0.10)
    Note over CSP,PVS: Online Worker
    CSP->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>CSP: state → PENDING
    end
    CSP->>PVS: validate schedule
    alt validation passes
      rect rgba(0,98,182,0.20)
        PVS-->>CSP: state → SCHEDULED
      end
    else validation fails
      rect rgba(0,98,182,0.20)
        PVS-->>CSP: state → DECLINED
      end
      CSP->>PFL: notify decline
    end
  end

  CSP-->>API: SCHEDULED or DECLINED
  API-->>C: 201 Created (status)

  rect rgba(198,146,20,0.20)
    Note over CSP,PSC: Async (today). Allocations fetched up front, ready on payment date

    rect rgba(0,163,224,0.13)
      Note over GPA,PSC: Offline Worker
      CSP->>GPA: trigger allocations workflow
      GPA->>ARQ: request allocations
      rect rgba(0,98,182,0.20)
        ARQ-->>GPA: state → ALLOCATING
      end
      GPA->>ARC: process allocations payload
      rect rgba(0,98,182,0.20)
        ARC-->>GPA: state → ALLOCATED
      end
      GPA->>PSC: create payment splits
    end
  end

  Note over SCH,ESPS: On payment date · Sched. Executor fires (2,500/min)

  rect rgba(198,146,20,0.20)
    Note over SCH,PFL: Async

    rect rgba(0,163,224,0.13)
      Note over SCH,PVX: Offline Worker
      SCH->>ESPS: pick up ALLOCATED payments
      ESPS->>PVX: validate
      alt validation passes
        rect rgba(0,98,182,0.20)
          PVX-->>ESPS: state → ACCEPTED
        end
      else validation fails
        rect rgba(0,98,182,0.20)
          PVX-->>ESPS: state → DECLINED
        end
        ESPS->>PFL: notify decline on execution
      end
    end

    rect rgba(0,163,224,0.13)
      Note over ESP,PFL: Offline Worker
      ESPS->>ESP: trigger split execution
      ESP->>PEX: execute split
      rect rgba(0,98,182,0.20)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill split
      rect rgba(0,98,182,0.20)
        PFL-->>ESP: state → PROCESSED
      end
    end
  end
```

<details>
<summary>What happens</summary>

- `POST /payments` with `payment-date = future` and a corporate marker runs `CreateSchedulePaymentWF`.
- On `SCHEDULED`, allocations are fetched up front (`GetCorporatePaymentAllocationsWF`) so they are ready on the payment date.
- When the date arrives, `ExecuteScheduledPaymentWF` re-validates, taking the payment from `ALLOCATED` to `ACCEPTED`.
- `ExecuteSplitPaymentWF` then runs once per split.
- As with the non-corporate schedule, either validation can decline, and fulfillment (`PaymentFulfillmentActivityGroup`) sends the notification.

</details>

## 5. Update a scheduled payment

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as PUT /payments/:id
    participant U as Update WF
    participant IDEMP as Capture
    participant CAN as Cancel WF
    participant PCV as Cancel Val.
    participant PCN as Cancellation
    participant CSP as Schedule WF
    participant MAP as Map ID
  end

  C->>API: PUT /payments/:id
  API->>U: invoke

  rect rgba(1,91,179,0.10)
    Note over U,MAP: Online Worker
    U->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>U: state → PENDING
    end

    rect rgba(96,165,224,0.13)
      U->>CAN: cancel original
      CAN->>PCV: validate cancel
      CAN->>PCN: cancel
      rect rgba(0,98,182,0.20)
        PCN-->>CAN: state → CANCELLED
      end
      CAN-->>U: cancelled
    end

    rect rgba(96,165,224,0.13)
      U->>CSP: create replacement
      rect rgba(0,98,182,0.20)
        CSP-->>U: new payment-id (state → SCHEDULED or DECLINED)
      end
    end

    U->>MAP: map old → new
  end

  U-->>API: success(new payment-id)
  API-->>C: 200 OK
```

<details>
<summary>What happens</summary>

- `PUT /payments/:id` runs `UpdatePaymentWF`.
- It cancels the original through `CancelPaymentWF`, which runs the eligibility check (`PaymentCancelValidationActivityGroup`) then the cancellation (`PaymentCancellationActivityGroup`).
- It creates the replacement through `CreateSchedulePaymentWF`.
- It maps the new payment id back to the original, so the audit trail survives the swap (`MapNewPaymentIdToPreviousIdActivity`).

</details>

## 6. Cancel a payment

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as DELETE /payments/:id
    participant CWF as Cancel WF
    participant IDEMP as Capture
    participant PCV as Cancel Val.
    participant PCN as Cancellation
  end

  C->>API: DELETE /payments/:id
  API->>CWF: invoke

  rect rgba(1,91,179,0.10)
    Note over CWF,PCN: Online Worker
    CWF->>IDEMP: Capture and check idempotency
    CWF->>PCV: validate cancel
    alt eligible
      CWF->>PCN: cancel
      rect rgba(0,98,182,0.20)
        PCN-->>CWF: state → CANCELLED
      end
      CWF-->>API: CANCELLED
    else not eligible
      CWF-->>API: error
    end
  end

  API-->>C: response
```

<details>
<summary>What happens</summary>

- `DELETE /payments/:id` runs `CancelPaymentWF`.
- It checks cancel eligibility (`PaymentCancelValidationActivityGroup`).
- If eligible, a `SCHEDULED` or `ACCEPTED` payment moves to `CANCELLED` (`PaymentCancellationActivityGroup`).
- If not, the caller gets an error and the payment keeps its state.

</details>

## 7. Return Processing + Representment Eligibility Check

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.06) Billpay Platform
    participant MMH as MM Handler
    participant API as POST /payments/returns
    participant PR as Returned WF
    participant IDEMP as Capture
    participant PRV as Return Val.
    participant PRX as Return Exec.
    participant PRE as Repr. Elig.
    participant PRC as Repr. Create
    participant PRP as Representment WF
  end

  Note over MMH: receives Money Movement (MR/M3) return event
  MMH->>API: POST /payments/returns
  API->>PR: invoke

  rect rgba(0,163,224,0.13)
    Note over PR,PRC: Offline Worker
    PR->>IDEMP: Capture and check idempotency
    PR->>PRV: validate return
    alt valid return
      PR->>PRX: execute return
      rect rgba(0,98,182,0.20)
        PRX-->>PR: state → RETURNED
      end
      PR->>PRE: check representment eligibility
      alt representable
        PR->>PRC: create representment
        rect rgba(0,98,182,0.20)
          PRC-->>PR: state → REPRESENTING
        end
        PR->>PRP: hand off to ProcessRepresentmentWF
      else not representable
        Note over PR: payment stays in RETURNED, representment workflow not invoked
      end
    else invalid return
      Note over PR,PRV: no state transition, payment stays in its current state
    end
  end
```

<details>
<summary>What happens</summary>

- Money Movement return events (MR/M3) trigger `ProcessReturnedPaymentWF`.
- It validates the return (`PaymentReturnValidationActivity`), then moves the payment to `RETURNED` (`PaymentReturnExecutionActivityGroup`).
- It checks representment eligibility (`PaymentRepresentmentEligibilityActivityGroup`).
- If representable, it creates the representment, moves to `REPRESENTING` (`PaymentRepresentmentCreationActivityGroup`), and hands off to `ProcessRepresentmentWF` in [diagram #8](#8-representment-workflow).
- If not representable, the payment stays `RETURNED` and the representment workflow is never invoked.
- An invalid return changes nothing. The payment keeps whatever state it had. What the workflow does next is not yet defined in the spec.

</details>

## 8. Representment Workflow

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.06) Billpay Platform
    participant PR as Returned WF
    participant PRP as Representment WF
    participant PRRV as Repr. Validate
    participant PRRX as Repr. Execute
  end

  PR->>PRP: hand off (state = REPRESENTING)

  rect rgba(0,163,224,0.13)
    Note over PRP,PRRX: Offline Worker
    PRP->>PRRV: validate representment
    alt valid representment
      PRP->>PRRX: execute representment
      rect rgba(0,98,182,0.20)
        PRRX-->>PRP: state → REPRESENTED
      end
    else invalid representment
      rect rgba(0,98,182,0.20)
        Note over PRP: state → DECLINED
      end
    end
  end
```

<details>
<summary>What happens</summary>

- `ProcessRepresentmentWF` picks up from the `REPRESENTING` state set in [diagram #7](#7-return-processing--representment-eligibility-check).
- It re-checks eligibility on the representment day (`PaymentRepresentmentValidationActivityGroup`).
- If valid, it re-clears the transaction to `REPRESENTED` (`PaymentRepresentmentExecutionActivityGroup`).
- If not, the payment falls to `DECLINED`.

</details>

## 9. Inbound payment

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.06) Billpay Platform
    participant UPH as Inbound Handler
    participant API as POST /payments/inbound
    participant IB as Inbound WF
    participant IDEMP as Capture
    participant PVP as Validation
    participant PPS as Execution
    participant PFL as Fulfillment
    participant PSC as Splits
    participant PRJ as Disallow
  end

  Note over UPH: receives third-party push payment, enriches payload
  UPH->>API: POST /payments/inbound
  API->>IB: invoke

  rect rgba(0,163,224,0.13)
    Note over IB,PRJ: Offline Worker
    IB->>IDEMP: Capture and check idempotency
    rect rgba(0,98,182,0.20)
      IDEMP-->>IB: state → PENDING
    end
    IB->>PVP: validate posting
    alt accepted (Full)
      IB->>PPS: post
      rect rgba(0,98,182,0.20)
        PPS-->>IB: state → PROCESSING
      end
      IB->>PFL: fulfill
      rect rgba(0,98,182,0.20)
        PFL-->>IB: state → PROCESSED
      end
    else accepted (Split, Consumer)
      IB->>PSC: create splits, trigger ExecuteSplitPaymentWF
    else not accepted
      IB->>PRJ: disallow
      rect rgba(0,98,182,0.20)
        PRJ-->>IB: state → DISALLOWED
      end
    end
  end
```

<details>
<summary>What happens</summary>

- An upstream third-party payment arrives through the Unstructured Payment Handler and `POST /payments/inbound`, running `ProcessInboundPaymentWF`.
- It captures the payment and checks idempotency (`IdempotencyCheckActivity`), then validates the posting (`PaymentValidationActivityGroup`).
- A full payment posts and fulfils (`PaymentExecutionActivityGroup`, then `PaymentFulfillmentActivityGroup`).
- A consumer split fans out instead, through `PaymentSplitsCreationActivity` into `ExecuteSplitPaymentWF`.
- If Amex does not accept it, the payment moves to `DISALLOWED` (`PendingToDisallowedStage`).

</details>

## 10. Paid Events reconciliation

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.06) Billpay Platform
    participant PPH as Posted Handler
    participant MMH as MM Handler
    participant TRK as Events Tracker
    participant SCH as Paid Events Sched.
    participant PEP as Paid Events WF
  end

  rect rgba(90,112,145,0.10)
    Note over PPH,TRK: Async event ingestion. AR-Posted and Settled events arrive independently
    Note over PPH: receives AR Posted event
    PPH->>TRK: insert AR-Posted row
    Note over MMH: receives Settled event
    MMH->>TRK: insert Settled row
  end

  rect rgba(0,163,224,0.13)
    Note over SCH,PEP: Offline Worker
    SCH->>PEP: tick (continuous batch)
    PEP->>TRK: find pairs (AR-Posted + Settled)
    PEP->>TRK: mark Picked-up-for-processing
    rect rgba(0,98,182,0.20)
      Note over PEP: state → PAID (insert lifecycle event, update status, publish PAID lifecycle event)
    end
  end
```

<details>
<summary>What happens</summary>

- `PaidEventsProcessingWF` is the continuous sweep that closes a payment out.
- AR-Posted and Settled events arrive independently and are recorded in the External Transaction Events Tracker.
- The workflow finds pairs, marks them picked up for processing, and once both are present the payment moves to `PAID`.

</details>

## 11. Missing Paid Events reconciliation

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.06) Billpay Platform
    participant SCH as Missing Paid Sched.
    participant MPE as Missing Paid WF
    participant TRK as Events Tracker
  end

  rect rgba(0,163,224,0.13)
    Note over SCH,TRK: Offline Worker
    SCH->>MPE: tick (hourly / configurable)
    MPE->>TRK: find payments missing AR-Posted or Settled > 48h
  end

  alt missing AR-Posted
    Note over MPE: probe Accounts Receivable for posted-event status
    alt found
      MPE->>TRK: insert AR-Posted row
    else still missing
      Note over MPE: raise alert
    end
  end
  alt missing Settlement
    Note over MPE: probe Clearing for settlement status
    alt found
      MPE->>TRK: insert Settled row
    else still missing
      Note over MPE: raise alert
    end
  end
```

<details>
<summary>What happens</summary>

- `MissingPaidEventsProcessingWF` is an hourly probe, and the interval is configurable.
- It looks for payments still missing an AR-Posted or Settled event after 48 hours.
- It queries Accounts Receivable or Clearing directly for whichever event is missing.
- If the event is found it is recorded. If it is still missing, the probe raises an alert.

</details>

## 12. Create Payment + Installments (composite)

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant C as Client
    participant ODF as CreatePaymentInstallment.v1
  end

  box rgba(1,111,208,0.06) Billpay Platform
    participant API as POST /payment-installments
    participant CWF as Installment WF
    participant CIP as Immediate WF
  end

  C->>ODF: CreatePaymentInstallment.v1
  ODF->>API: POST /payment-installments
  API->>CWF: invoke composite

  rect rgba(1,91,179,0.10)
    Note over CWF,CIP: Online Worker

    rect rgba(96,165,224,0.13)
      CWF->>CIP: invoke CreateImmediatePaymentWF
      alt inner payment ACCEPTED
        rect rgba(0,98,182,0.20)
          CIP-->>CWF: payment-id (state → ACCEPTED)
        end
        Note over CWF: call Installments API to create installment plan, receive installment-id
        opt autopay flag
          Note over CWF: call Autopay API to update autopay
        end
      else inner payment DECLINED
        rect rgba(0,98,182,0.20)
          CIP-->>CWF: payment-id (state → DECLINED)
        end
        Note over CWF: composite short-circuits, no installment plan created, no autopay
      end
    end
  end
```

<details>
<summary>What happens</summary>

- Create Payment & Installments is a composite workflow. It runs `CreateImmediatePaymentWF` first.
- On `ACCEPTED` it creates the installment plan through the Installments API, and updates autopay if the flag is set.
- On `DECLINED` it short-circuits. No installment plan is created and autopay is left alone.

</details>
