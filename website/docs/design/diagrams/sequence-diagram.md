---
title: Sequence Diagrams
sidebar_label: Sequence Diagram
---

# Sequence Diagrams

End-to-end traces from a caller's perspective. Each diagram follows one complete Billpay flow — **caller → Core API → Billpay Router → Workflows → the ActivityGroups and Activities that do the work**.

Most diagrams show two groups at the top:

- **Caller** — the client and the request contract it calls, e.g. `CreatePayment.v3` (soft slate).
- **Billpay Platform** — everything past the contract: the Core API endpoint, the Billpay Router, the Workflows, and the ActivityGroups/Activities they invoke (light blue).

Internal reconciliation flows (event handlers + schedules) show only the Billpay Platform group.

Inside the body:

- **Blue-tinted rectangles** wrap the messages that belong to a single workflow (the workflow name is labeled at the top of the block).
- **Amber-tinted rectangles** mark async work that happens *after* the caller has been responded to.
- **Fuchsia/pink-tinted rectangles** pop out **state transitions** — moments where the payment moves from one lifecycle state to another (`PENDING → ACCEPTED`, `PROCESSING → PROCESSED`, and so on).

Each ActivityGroup or Activity appears as its **own participant**. To keep the diagrams readable the participant label is short — `Execution` stands for `PaymentExecutionActivityGroup`, `Idempotency` for `IdempotencyCheckActivity`, `Validation` for `PaymentValidationActivityGroup` — and each diagram's intro names the full classes it uses. External systems and infrastructure (clearing, Accounts Receivable, Open-To-Buy, accounting, the database, the event bus) are intentionally omitted — they're internal details of the groups that own them.

## 1. Immediate payment — single instruction

`CreatePayment.v3` → `POST /payments` (today, single instruction) →
`CreateImmediatePaymentWF`. The workflow checks idempotency
(`IdempotencyCheckActivity`) and validates (`PaymentValidationActivityGroup`),
then on `ACCEPTED` runs execution (`PaymentExecutionActivityGroup`) and
fulfillment (`PaymentFulfillmentActivityGroup`) in the background; a failed
validation declines and notifies (`PaymentDeclinedNotificationActivityGroup`).

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
    participant ODF as CreatePayment.v3
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant WF as Immediate WF
    participant IDEMP as Idempotency
    participant PVAL as Validation
    participant PDN as Decline
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>ODF: CreatePayment.v3 (date=today, single)
  ODF->>API: POST /payments
  API->>R: route(date=today, single)
  R->>WF: invoke(workflow-key)

  rect rgba(1,111,208,0.2)
    Note over WF,PDN: Online · Immediate WF — validates inline, accepts or declines
    WF->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>WF: state → PENDING
    end
    WF->>PVAL: validate
    alt validation passes
      rect rgba(150,75,232,0.28)
        PVAL-->>WF: state → ACCEPTED
      end
    else validation fails
      rect rgba(150,75,232,0.28)
        PVAL-->>WF: state → DECLINED
      end
      WF->>PDN: notify decline
    end
  end

  Note over C,WF: 201 · ACCEPTED or DECLINED — only ACCEPTED proceeds to background fulfillment
  WF-->>API: success (payment-id, ACCEPTED or DECLINED)
  API-->>ODF: 201 Created
  ODF-->>C: payment-id, status

  rect rgba(235,160,35,0.22)
    Note over WF,PFL: Online · Immediate WF — async execution and fulfillment run only on ACCEPTED
    WF->>PEX: execute
    rect rgba(150,75,232,0.28)
      PEX-->>WF: state → PROCESSING
    end
    WF->>PFL: fulfill
    rect rgba(150,75,232,0.28)
      PFL-->>WF: state → PROCESSED
    end
  end
```

## 2. Scheduled payment — created today, executed later

`CreatePayment.v3` → `POST /payments` (future date) →
`CreateSchedulePaymentWF`, which validates the schedule
(`PaymentValidationActivityGroup`) and notifies on success
(`PaymentScheduledNotificationActivityGroup`). On the payment date the
Scheduled Payment Executor drains `SCHEDULED` payments into
`ExecuteScheduledPaymentWF`, which re-validates on execution
(`PaymentValidationOnExecutionActivityGroup`) before executing and fulfilling.

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CSP as Schedule WF
    participant IDEMP as Idempotency
    participant PVS as Validation
    participant PSN as Scheduled
    participant PDN as Decline
    participant SCH as Sched. Executor
    participant ESP as Exec Scheduled WF
    participant PVX as Validate (exec)
    participant PDNE as Decline
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (date=future)
  API->>R: route(date=future)
  R->>CSP: invoke(workflow-key)

  rect rgba(1,111,208,0.2)
    Note over CSP,PDN: Online · Schedule WF — validates the schedule, schedules or declines
    CSP->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>CSP: state → PENDING
    end
    CSP->>PVS: validate schedule
    alt validation passes
      rect rgba(150,75,232,0.28)
        PVS-->>CSP: state → SCHEDULED
      end
      CSP->>PSN: notify scheduled
    else validation fails
      rect rgba(150,75,232,0.28)
        PVS-->>CSP: state → DECLINED
      end
      CSP->>PDN: notify decline
    end
  end

  CSP-->>API: SCHEDULED or DECLINED
  API-->>C: 201 Created (status)

  Note over SCH,ESP: On payment date · Sched. Executor fires (2,500/min) — only SCHEDULED

  rect rgba(235,160,35,0.22)
    Note over SCH,PFL: Offline · Exec Scheduled WF — re-validates, executes and fulfills or declines
    SCH->>ESP: pick up SCHEDULED payments (batches of 2,500/min)
    ESP->>PVX: validate
    alt validation passes
      rect rgba(150,75,232,0.28)
        PVX-->>ESP: state → ACCEPTED
      end
      ESP->>PEX: execute
      rect rgba(150,75,232,0.28)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill
      rect rgba(150,75,232,0.28)
        PFL-->>ESP: state → PROCESSED
      end
    else validation fails
      rect rgba(150,75,232,0.28)
        PVX-->>ESP: state → DECLINED
      end
      ESP->>PDNE: notify decline on execution
    end
  end
```

:::note[After PROCESSED]
`PAID` is reached separately by the **Paid Events Processor reconciliation** — see [diagram #10](#10-paid-events-reconciliation).
:::

## 3. Immediate Corporate Payment

`POST /payments` with `payment-date = today` and a corporate marker →
`CreateImmediatePaymentWF`. On `ACCEPTED`, the parent fans out to
`GetCorporatePaymentAllocationsWF`, which requests allocations
(`PaymentAllocatingActivityGroup`), receives them
(`PaymentAllocatedActivityGroup`), and creates the split legs
(`PaymentSplitsCreationActivity`); then `ExecuteSplitPaymentWF` runs per split.

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CIP as Immediate WF
    participant IDEMP as Idempotency
    participant PVAL as Validation
    participant PDN as Decline
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

  rect rgba(1,111,208,0.2)
    Note over CIP,PDN: Online · Immediate WF — validates inline, accepts or declines
    CIP->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>CIP: state → PENDING
    end
    CIP->>PVAL: validate
    alt validation passes
      rect rgba(150,75,232,0.28)
        PVAL-->>CIP: state → ACCEPTED
      end
    else validation fails
      rect rgba(150,75,232,0.28)
        PVAL-->>CIP: state → DECLINED
      end
      CIP->>PDN: notify decline
    end
  end

  Note over C,CIP: 201 · ACCEPTED or DECLINED — only ACCEPTED proceeds to allocations and splits
  CIP-->>API: success (payment-id, ACCEPTED or DECLINED)
  API-->>C: 201 Created

  rect rgba(235,160,35,0.22)
    Note over CIP,PFL: Async — corporate allocations fetched, then per-split execution runs in waves

    rect rgba(1,111,208,0.2)
      Note over GPA,PSC: Offline · Allocations WF — fetches the split breakdown
      CIP->>GPA: trigger allocations workflow
      GPA->>ARQ: request allocations
      rect rgba(150,75,232,0.28)
        ARQ-->>GPA: state → ALLOCATING
      end
      GPA->>ARC: process allocations payload
      rect rgba(150,75,232,0.28)
        ARC-->>GPA: state → ALLOCATED
      end
      GPA->>PSC: create payment splits
    end

    rect rgba(1,111,208,0.2)
      Note over ESP,PFL: Offline · Split WF — drained by Allocations Sched.
      GPA->>ESP: trigger split execution
      ESP->>PEX: execute split
      rect rgba(150,75,232,0.28)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill split
      rect rgba(150,75,232,0.28)
        PFL-->>ESP: state → PROCESSED
      end
    end
  end
```

## 4. Scheduled Corporate Payment

`POST /payments` with `payment-date = future` and a corporate marker →
`CreateSchedulePaymentWF`. On `SCHEDULED`, allocations are fetched **up front**
(`GetCorporatePaymentAllocationsWF`) so they're ready on the payment date. When
the date arrives, `ExecuteScheduledPaymentWF` re-validates
(`ALLOCATED → ACCEPTED`) and `ExecuteSplitPaymentWF` runs per split.

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as POST /payments
    participant R as Billpay Router
    participant CSP as Schedule WF
    participant IDEMP as Idempotency
    participant PVS as Validation
    participant PDN as Decline
    participant GPA as Allocations WF
    participant ARQ as Allocating
    participant ARC as Allocated
    participant PSC as Splits
    participant SCH as Sched. Executor
    participant ESPS as Exec Scheduled WF
    participant PVX as Validate (exec)
    participant PDNE as Decline
    participant ESP as Split WF
    participant PEX as Execution
    participant PFL as Fulfillment
  end

  C->>API: POST /payments (corporate, future)
  API->>R: route(date=future, corporate)
  R->>CSP: invoke

  rect rgba(1,111,208,0.2)
    Note over CSP,PDN: Online · Schedule WF — validates the schedule, schedules or declines
    CSP->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>CSP: state → PENDING
    end
    CSP->>PVS: validate schedule
    alt validation passes
      rect rgba(150,75,232,0.28)
        PVS-->>CSP: state → SCHEDULED
      end
    else validation fails
      rect rgba(150,75,232,0.28)
        PVS-->>CSP: state → DECLINED
      end
      CSP->>PDN: notify decline
    end
  end

  CSP-->>API: SCHEDULED or DECLINED
  API-->>C: 201 Created (status)

  rect rgba(235,160,35,0.22)
    Note over CSP,PSC: Async (today) — allocations fetched up front, ready on payment date

    rect rgba(1,111,208,0.2)
      Note over GPA,PSC: Offline · Allocations WF — fetches the split breakdown
      CSP->>GPA: trigger allocations workflow
      GPA->>ARQ: request allocations
      rect rgba(150,75,232,0.28)
        ARQ-->>GPA: state → ALLOCATING
      end
      GPA->>ARC: process allocations payload
      rect rgba(150,75,232,0.28)
        ARC-->>GPA: state → ALLOCATED
      end
      GPA->>PSC: create payment splits
    end
  end

  Note over SCH,ESPS: On payment date · Sched. Executor fires (2,500/min)

  rect rgba(235,160,35,0.22)
    Note over SCH,PFL: Offline chain — re-validate, then execute and fulfill each split

    rect rgba(1,111,208,0.2)
      Note over SCH,PDNE: Offline · Exec Scheduled WF — re-validates, accepts or declines
      SCH->>ESPS: pick up ALLOCATED payments
      ESPS->>PVX: validate
      alt validation passes
        rect rgba(150,75,232,0.28)
          PVX-->>ESPS: state → ACCEPTED
        end
      else validation fails
        rect rgba(150,75,232,0.28)
          PVX-->>ESPS: state → DECLINED
        end
        ESPS->>PDNE: notify decline on execution
      end
    end

    rect rgba(1,111,208,0.2)
      Note over ESP,PFL: Offline · Split WF — only on ACCEPTED, drained by Allocations Sched.
      ESPS->>ESP: trigger split execution
      ESP->>PEX: execute split
      rect rgba(150,75,232,0.28)
        PEX-->>ESP: state → PROCESSING
      end
      ESP->>PFL: fulfill split
      rect rgba(150,75,232,0.28)
        PFL-->>ESP: state → PROCESSED
      end
    end
  end
```

## 5. Update a scheduled payment

`PUT /payments/:id` → `UpdatePaymentWF`. It cancels the original through
`CancelPaymentWF` — cancel-eligibility check
(`PaymentCancelValidationActivityGroup`) then cancellation
(`PaymentCancellationActivityGroup`) — creates a replacement via
`CreateSchedulePaymentWF`, and maps the new payment id back to the original for
the audit trail (`MapNewPaymentIdToPreviousIdActivity`).

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as PUT /payments/:id
    participant U as Update WF
    participant IDEMP as Idempotency
    participant CAN as Cancel WF
    participant PCV as Cancel Val.
    participant PCN as Cancellation
    participant CSP as Schedule WF
    participant MAP as Map ID
  end

  C->>API: PUT /payments/:id
  API->>U: invoke

  rect rgba(1,111,208,0.2)
    Note over U,MAP: Online · Update WF — cancels original, creates replacement, maps old → new
    U->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>U: state → PENDING
    end

    rect rgba(0,111,207,0.18)
      U->>CAN: cancel original
      CAN->>PCV: validate cancel
      CAN->>PCN: cancel
      rect rgba(150,75,232,0.28)
        PCN-->>CAN: state → CANCELLED
      end
      CAN-->>U: cancelled
    end

    rect rgba(0,111,207,0.18)
      U->>CSP: create replacement
      rect rgba(150,75,232,0.28)
        CSP-->>U: new payment-id (state → SCHEDULED or DECLINED)
      end
    end

    U->>MAP: map old → new
  end

  U-->>API: success(new payment-id)
  API-->>C: 200 OK
```

## 6. Cancel a payment

`DELETE /payments/:id` → `CancelPaymentWF`. It checks cancel eligibility
(`PaymentCancelValidationActivityGroup`) and, if eligible, transitions a
`SCHEDULED` or `ACCEPTED` payment to `CANCELLED`
(`PaymentCancellationActivityGroup`).

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as DELETE /payments/:id
    participant CWF as Cancel WF
    participant IDEMP as Idempotency
    participant PCV as Cancel Val.
    participant PCN as Cancellation
  end

  C->>API: DELETE /payments/:id
  API->>CWF: invoke

  rect rgba(1,111,208,0.2)
    Note over CWF,PCN: Online · Cancel WF — checks eligibility, transitions to CANCELLED
    CWF->>IDEMP: check idempotency
    CWF->>PCV: validate cancel
    alt eligible
      CWF->>PCN: cancel
      rect rgba(150,75,232,0.28)
        PCN-->>CWF: state → CANCELLED
      end
      CWF-->>API: CANCELLED
    else not eligible
      CWF-->>API: error
    end
  end

  API-->>C: response
```

## 7. Return Processing + Representment Eligibility Check

`ProcessReturnedPaymentWF` — triggered by Money Movement return events. It
validates the return (`PaymentReturnValidationActivity`), transitions the
payment to `RETURNED` (`PaymentReturnExecutionActivityGroup`), then checks
representment eligibility (`PaymentRepresentmentEligibilityActivityGroup`). If
representable, it creates the representment and moves to `REPRESENTING`
(`PaymentRepresentmentCreationActivityGroup`), handing off to
`ProcessRepresentmentWF` (see [diagram #8](#8-representment-workflow)); an
invalid return is notified and the payment keeps its state.

```mermaid
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.1) Billpay Platform
    participant MMH as MM Handler
    participant API as POST /payments/returns
    participant PR as Returned WF
    participant IDEMP as Idempotency
    participant PRV as Return Val.
    participant PIRN as Invalid Notify
    participant PRX as Return Exec.
    participant PRE as Repr. Elig.
    participant PRC as Repr. Create
    participant PRP as Representment WF
  end

  Note over MMH: receives Money Movement (MR/M3) return event
  MMH->>API: POST /payments/returns
  API->>PR: invoke

  rect rgba(1,111,208,0.2)
    Note over PR,PRC: Offline · Returned WF — handles return, then checks representment eligibility
    PR->>IDEMP: check idempotency
    PR->>PRV: validate return
    alt valid return
      PR->>PRX: execute return
      rect rgba(150,75,232,0.28)
        PRX-->>PR: state → RETURNED
      end
      PR->>PRE: check representment eligibility
      alt representable
        PR->>PRC: create representment
        rect rgba(150,75,232,0.28)
          PRC-->>PR: state → REPRESENTING
        end
        PR->>PRP: hand off to ProcessRepresentmentWF
      else not representable
        Note over PR: payment stays in RETURNED — representment workflow not invoked
      end
    else invalid return
      PR->>PIRN: notify invalid return
      Note over PR,PIRN: no state transition — payment stays in its current state
    end
  end
```

## 8. Representment Workflow

`ProcessRepresentmentWF` — picked up from the `REPRESENTING` state set by
[diagram #7](#7-return-processing--representment-eligibility-check). It
re-checks eligibility on the representment day
(`PaymentRepresentmentValidationActivityGroup`) and, if valid, re-clears the
transaction to `REPRESENTED` (`PaymentRepresentmentExecutionActivityGroup`);
otherwise it falls to `DECLINED`.

```mermaid
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.1) Billpay Platform
    participant PR as Returned WF
    participant PRP as Representment WF
    participant PRRV as Repr. Validate
    participant PRRX as Repr. Execute
  end

  PR->>PRP: hand off (state = REPRESENTING)

  rect rgba(1,111,208,0.2)
    Note over PRP,PRRX: Offline · Representment WF — re-clears a returned transaction on the representment day
    PRP->>PRRV: validate representment
    alt valid representment
      PRP->>PRRX: execute representment
      rect rgba(150,75,232,0.28)
        PRRX-->>PRP: state → REPRESENTED
      end
    else invalid representment
      rect rgba(150,75,232,0.28)
        Note over PRP: state → DECLINED
      end
    end
  end
```

## 9. Inbound payment

`ProcessInboundPaymentWF` — an upstream (third-party) payment enters through
the Unstructured Payment Handler and `POST /payments/inbound`. It checks
idempotency, validates the posting (`PaymentValidationActivityGroup`), then
posts and fulfils (`PaymentExecutionActivityGroup`,
`PaymentFulfillmentActivityGroup`), fans out consumer splits
(`PaymentSplitsCreationActivity`), or — if Amex doesn't accept it — moves the
payment to `DISALLOWED` (`PendingToDisallowedStage`).

```mermaid
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.1) Billpay Platform
    participant UPH as Inbound Handler
    participant API as POST /payments/inbound
    participant IB as Inbound WF
    participant IDEMP as Idempotency
    participant PVP as Validation
    participant PPS as Execution
    participant PFL as Fulfillment
    participant PSC as Splits
    participant PRJ as Disallow
  end

  Note over UPH: receives third-party push payment, enriches payload
  UPH->>API: POST /payments/inbound
  API->>IB: invoke

  rect rgba(1,111,208,0.2)
    Note over IB,PRJ: Offline · Inbound WF — posts an upstream-originated payment into Billpay
    IB->>IDEMP: check idempotency
    rect rgba(150,75,232,0.28)
      IDEMP-->>IB: state → PENDING
    end
    IB->>PVP: validate posting
    alt accepted (Full)
      IB->>PPS: post
      rect rgba(150,75,232,0.28)
        PPS-->>IB: state → PROCESSING
      end
      IB->>PFL: fulfill
      rect rgba(150,75,232,0.28)
        PFL-->>IB: state → PROCESSED
      end
    else accepted (Split, Consumer)
      IB->>PSC: create splits, trigger ExecuteSplitPaymentWF
    else not accepted
      IB->>PRJ: disallow
      rect rgba(150,75,232,0.28)
        PRJ-->>IB: state → DISALLOWED
      end
    end
  end
```

## 10. Paid Events reconciliation

`PaidEventsProcessingWF` — the continuous sweep that closes a payment out.
AR-Posted and Settled events arrive independently and are tracked in the
External Transaction Events Tracker; once both are present for a payment it
moves to `PAID`.

```mermaid
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.1) Billpay Platform
    participant PPH as Posted Handler
    participant MMH as MM Handler
    participant TRK as Events Tracker
    participant SCH as Paid Events Sched.
    participant PEP as Paid Events WF
  end

  rect rgba(148,163,184,0.08)
    Note over PPH,TRK: Async event ingestion — AR-Posted and Settled events arrive independently
    Note over PPH: receives AR Posted event
    PPH->>TRK: insert AR-Posted row
    Note over MMH: receives Settled event
    MMH->>TRK: insert Settled row
  end

  rect rgba(1,111,208,0.2)
    Note over SCH,PEP: Offline · Paid Events WF — closes the payment to PAID once both events arrive
    SCH->>PEP: tick (continuous batch)
    PEP->>TRK: find pairs (AR-Posted + Settled)
    PEP->>TRK: mark Picked-up-for-processing
    rect rgba(150,75,232,0.28)
      Note over PEP: state → PAID (insert lifecycle event, update status, publish PAID lifecycle event)
    end
  end
```

## 11. Missing Paid Events reconciliation

`MissingPaidEventsProcessingWF` — an hourly probe. For payments still missing
an AR-Posted or Settled event after 48 hours, it queries Accounts Receivable or
Clearing directly; if the event is found it is recorded, otherwise it raises an
alert.

```mermaid
sequenceDiagram
  autonumber

  box rgba(1,111,208,0.1) Billpay Platform
    participant SCH as Missing Paid Sched.
    participant MPE as Missing Paid WF
    participant TRK as Events Tracker
  end

  rect rgba(1,111,208,0.2)
    Note over SCH,TRK: Offline · Missing Paid WF — hourly probe for AR-Posted or Settled missing over 48h
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

## 12. Create Payment + Installments (composite)

`CreatePaymentInstallmentWF` — a composite. It runs `CreateImmediatePaymentWF`;
on `ACCEPTED` it creates the installment plan and, if the autopay flag is set,
updates autopay. On `DECLINED` it short-circuits — no installment plan, no
autopay.

```mermaid
sequenceDiagram
  autonumber

  box rgba(120,132,152,0.16) Caller
    participant C as Client
    participant ODF as CreatePaymentInstallment.v1
  end

  box rgba(1,111,208,0.1) Billpay Platform
    participant API as POST /paymentInstallments
    participant CWF as Installment WF
    participant CIP as Immediate WF
  end

  C->>ODF: CreatePaymentInstallment.v1
  ODF->>API: POST /paymentInstallments
  API->>CWF: invoke composite

  rect rgba(1,111,208,0.2)
    Note over CWF,CIP: Online · Installment WF — composite: payment + installment plan + optional autopay

    rect rgba(0,111,207,0.18)
      CWF->>CIP: invoke CreateImmediatePaymentWF
      alt inner payment ACCEPTED
        rect rgba(150,75,232,0.28)
          CIP-->>CWF: payment-id (state → ACCEPTED)
        end
        Note over CWF: call Installments API to create installment plan, receive installment-id
        opt autopay flag
          Note over CWF: call Autopay API to update autopay
        end
      else inner payment DECLINED
        rect rgba(150,75,232,0.28)
          CIP-->>CWF: payment-id (state → DECLINED)
        end
        Note over CWF: composite short-circuits — no installment plan created, no autopay
      end
    end
  end
```
