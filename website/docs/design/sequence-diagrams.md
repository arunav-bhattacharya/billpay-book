---
title: Sequence Diagrams
description: "Sixteen flows traced end to end, from the call or Schedule that starts each one to the stages that do the work and the commits they make."
sidebar_label: Sequence Diagrams
---

import Lead from '@site/src/components/Lead';

# Sequence Diagrams

<Lead>Sixteen flows traced end to end, from the call or Schedule that starts each one to the stages that do the work and the commits they make. Each one shows which cluster runs every step, and when RTF and Raven hear about it.</Lead>

<details>
<summary>How to read these diagrams</summary>

- Every step is numbered, in order.
- A numbered label such as **1 · Create** names each phase. Each phase's label has its own colour, so you can tell neighbouring phases apart.
- The field behind a phase says which side runs it: pale blue for the Online side (billpay-online and its cluster, where a caller is usually waiting), pale navy for the Offline side (billpay-offline and its cluster, where dispatchers pace the work). No field means the step happens outside Billpay. The key under each diagram repeats this.
- A grey note between phases is time when nothing runs, because the work is waiting in Oracle, in One-Data's inbox, or on a workflow's timer.
- A pink arrow is where something outside starts or resumes the payment: an update or a signal to its running workflow, a dispatcher or a callback starting the next workflow, or the events One-Data pairs before `PAID`. [All Journeys](./journeys/all-journeys.md) marks the same steps with pink flags.
- An arrow to `PaymentStore` is a commit: the guarded state change and its timeline entry in one transaction, with any Work Tracker rows.
- Every payment workflow starts through the Router, which admits the request and pins the resolved profile. The PAID drain and the missing-events check start from Schedules instead.
- RTF and Raven are drawn because their timing matters. Each change is announced to RTF, and to Raven where the customer is told, after the commit that makes it. Fulfil is the exception: it tells both before it commits `PROCESSED`, except for a Pay with Bank Transfer or debit card payment, whose `PROCESSED` goes to neither.
- The wider diagrams carry an expand control in the top right, which opens a full-window view. Escape closes it.

</details>

## 1. Pay today, one instruction

The caller is waiting for one answer: did the payment go through? So the workflow replies as soon as Verify commits, Temporal's early-return pattern, and only then announces the change and moves the money. Capture, Verify's calls and its commit run as local activities, inside the worker, so the answer comes out of the workflow's first task. Execute and Fulfil finish on Online after the reply, and Fulfil tells RTF and Raven before it commits `PROCESSED`, so nothing is marked processed until both know. Once Verify has decided, the workflow also calls One-Data's delete API, so the account can take its next payment (diagram 15).

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  participant OD as CreatePayment.v3
  participant R as Billpay Router
  participant WF as CreateImmediate<br/>PaymentWorkflow
  participant CAP as Capture
  participant VER as Verify
  participant EXE as Execute
  participant FUL as Fulfil
  participant PS as PaymentStore<br/>(Oracle)
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    Note over OD,RAV: 1 · Decide
    OD->>R: POST /payments
    Note over R: admit, pin profile
    R->>WF: Update-With-Start,<br/>{paymentId}-init
    WF->>CAP: run
    CAP->>PS: PENDING, if new
    WF->>VER: run
    Note over VER: Instruments, Options<br/>and Plans, in parallel
    VER->>PS: ACCEPTED or DECLINED
    WF-->>R: update result
    R-->>OD: ACCEPTED or DECLINED
  end

  rect rgba(0,111,207,0.12)
    Note over OD,RAV: 2 · After the reply
    WF->>RTF: PENDING event
    alt DECLINED
      WF->>RTF: DECLINED event
      WF->>RAV: DECLINED message
    else ACCEPTED
      WF->>RTF: ACCEPTED event
      WF->>EXE: run
      Note over EXE: clearing, AR and<br/>Instruments, then CAS
      EXE->>PS: PROCESSING
      WF->>RTF: PROCESSING event
      WF->>FUL: run
      Note over FUL: accounting, eBNC, risk, TFNE,<br/>GPHDB, B2Notifier, AMP
      FUL->>RTF: PROCESSED event
      FUL->>RAV: PROCESSED message
      FUL->>PS: PROCESSED
    end
  end
```

## 2. Scheduled payment, created today and executed later

A scheduled payment costs Temporal nothing while it waits. Intake on Online commits `SCHEDULED` together with a `SCHED_EXEC` row, replies and ends, and the row sits in Oracle until the due date. On the due date the market's dispatcher routes the payment again, with that day's config, and starts `ExecuteScheduledPaymentWorkflow` on Offline. Reverify reads the options again through `ReadPaymentOptions.v1`: the card still owes, the option still holds, and a balance option takes its amount again. Its guarded update settles any race with a late cancel.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: dispatcher start
  autonumber

  participant OD as CreatePayment.v3
  participant R as Billpay Router
  participant CW as CreateScheduled<br/>PaymentWorkflow
  participant VER as Verify
  participant PS as PaymentStore<br/>(Oracle)
  participant SD as Scheduled-payments<br/>dispatcher
  participant XW as ExecuteScheduled<br/>PaymentWorkflow
  participant REV as Reverify
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    Note over OD,RAV: 1 · Create
    OD->>R: POST /payments, future date
    Note over R: admit, pin profile
    R->>CW: Update-With-Start,<br/>{paymentId}-init
    CW->>PS: Capture: PENDING, if new
    CW->>VER: run
    Note over VER: Instruments, Options<br/>and Plans, in parallel
    VER->>PS: SCHEDULED, with a<br/>SCHED_EXEC row
    CW-->>R: update result
    R-->>OD: SCHEDULED
    CW->>RTF: PENDING, SCHEDULED events
    CW->>RAV: SCHEDULED message
  end

  Note over OD,RAV: the SCHED_EXEC row waits in Oracle until the due date

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 2 · Execute on the due date
    SD->>PS: claim due SCHED_EXEC rows
    SD->>R: re-route, today's config
    Note over R: admit, pin profile
    R->>XW: dispatcher start,<br/>{paymentId}-execute
    SD->>PS: row DISPATCHED
    XW->>REV: run
    Note over REV: Options again
    REV->>PS: ACCEPTED or DECLINED,<br/>if still SCHEDULED
    XW->>RTF: ACCEPTED or DECLINED event
    Note over XW,REV: then Execute and Fulfil, as for pay today
  end
```

## 3. Corporate payment, pay today

A corporate payment paid today gets its answer the way any payment does: the workflow replies once Verify commits `ACCEPTED`. After that, no workflow waits for anything. Verify's commit writes an `ALLOC_REQUEST` row due at once, and each later step starts from a row in Oracle that a dispatcher picks up: the request for the allocations, the execution once they add up, and one leg per allocation. Execute clears the parent once, at payment level. There is no Reverify, since Verify passed minutes earlier, and the parent gets no Fulfil and no AR or OTB call: the legs make those. Each leg runs as its own `ExecuteSplitPaymentWorkflow` at priority 2, with the parent's ID as its fairness key: AR and OTB (OTB after the Instruments call) with no clearing, then accounting, eBNC, risk, TFNE, GPHDB and B2Notifier, the leg's RTF event and Raven message, and `PROCESSED`. A completion check every 60 seconds moves the parent to `PROCESSED` once every batch has its legs and every leg is `PROCESSED` or `PAID`.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: start RequestAllocationsWorkflow
  %% trigger: dispatcher start
  %% trigger: start each leg
  %% trigger: count the parent's
  autonumber

  participant OD as CreatePayment.v3
  participant R as Billpay Router
  participant WF as CreateImmediate<br/>PaymentWorkflow
  participant VER as Verify
  participant PS as PaymentStore<br/>(Oracle)
  participant AD as Allocation<br/>dispatchers
  participant RQ as RequestAllocations
  participant XW as ExecuteScheduled<br/>PaymentWorkflow
  participant EXE as Execute
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    Note over OD,RAV: 1 · Accept
    OD->>R: POST /payments, corporate
    Note over R: admit, pin profile
    R->>WF: Update-With-Start,<br/>{paymentId}-init
    WF->>PS: Capture: PENDING, if new
    WF->>VER: run
    VER->>PS: ACCEPTED, with an<br/>ALLOC_REQUEST row
    WF-->>R: update result
    R-->>OD: ACCEPTED
    WF->>RTF: PENDING, ACCEPTED events
  end

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 2 · Request the allocations
    AD->>PS: claim the ALLOC_REQUEST row
    AD->>R: start through the Router
    R->>RQ: start RequestAllocationsWorkflow,<br/>{paymentId}-allocations
    RQ->>PS: ALLOCATING, if still ACCEPTED
    RQ->>RTF: ALLOCATING event
    Note over RQ: asks the allocations manager
  end

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 3 · Receive them, batch by batch (diagram 13)
    Note over R,RQ: the last batch commits ALLOCATED, with an ALLOC_EXEC row
  end

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 4 · Execute the parent
    AD->>PS: claim the ALLOC_EXEC row
    AD->>R: start through the Router
    R->>XW: dispatcher start,<br/>{paymentId}-execute
    XW->>EXE: run
    Note over EXE: clears once,<br/>at payment level
    EXE->>PS: PROCESSING, row DONE
    XW->>RTF: PROCESSING event
  end

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 5 · Run the legs
    AD->>PS: write each batch's legs,<br/>1,000 rows at a time
    AD->>PS: claim due ALLOC_LEG rows
    AD->>R: start each leg through the Router
    Note over R,EXE: one ExecuteSplitPaymentWorkflow per leg, {paymentId}_{seq}-execute
  end

  rect rgba(0,23,90,0.12)
    Note over OD,RAV: 6 · Complete the parent, every 60 s
    AD->>PS: count the parent's legs by status
    Note over AD: every leg PROCESSED or PAID
    AD->>RTF: parent's PROCESSED event
    AD->>RAV: parent's PROCESSED message
    AD->>PS: parent PROCESSED
  end
```

## 4. Corporate payment, scheduled

A scheduled corporate payment runs the same steps as one paid today, from the same kinds of row. Only the timing differs. Intake commits `SCHEDULED` with an `ALLOC_REQUEST` row due at the market's fetch time: on the due date, or a set number of hours or days before it. The request moves the payment to `ALLOCATING`, and from then on a cancel or an update gets 409. The batch that completes the amount writes the `ALLOC_EXEC` row, due at the execution time on the due date. Then Reverify checks the payment again, Execute clears it, and the legs run as they do for pay today. If Reverify fails, the payment is `DECLINED` and its legs are never written.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: start RequestAllocationsWorkflow
  %% trigger: async start ReceiveAllocationsWorkflow
  %% trigger: dispatcher start
  autonumber

  participant R as Billpay Router
  participant PS as PaymentStore<br/>(Oracle)
  participant AD as Allocation<br/>dispatchers
  participant RQ as RequestAllocations
  participant RC as ReceiveAllocations
  participant XW as ExecuteScheduled<br/>PaymentWorkflow
  participant REV as Reverify
  participant EXE as Execute
  participant RTF

  Note over R,RTF: SCHEDULED, with an ALLOC_REQUEST row, waits in Oracle until the fetch time

  rect rgba(0,23,90,0.12)
    Note over R,RTF: 1 · Request the allocations
    AD->>PS: claim the ALLOC_REQUEST row
    AD->>R: start through the Router
    R->>RQ: start RequestAllocationsWorkflow,<br/>{paymentId}-allocations
    RQ->>PS: ALLOCATING, if still SCHEDULED
    RQ->>RTF: ALLOCATING event
    Note over RQ: asks the allocations manager
  end

  rect rgba(0,23,90,0.12)
    Note over R,RTF: 2 · Receive them, batch by batch
    Note over R,PS: each batch stored in allocation_batch
    R->>RC: async start ReceiveAllocationsWorkflow,<br/>{paymentId}-allocations-{batch}, then 202
    RC->>PS: the last batch: ALLOCATED,<br/>with an ALLOC_EXEC row
    RC->>RTF: ALLOCATED event
  end

  Note over R,RTF: the batches wait in allocation_batch until the due date

  rect rgba(0,23,90,0.12)
    Note over R,RTF: 3 · Execute on the due date
    AD->>PS: claim the ALLOC_EXEC row
    AD->>R: re-route, today's config
    R->>XW: dispatcher start,<br/>{paymentId}-execute
    XW->>REV: run
    REV->>PS: ACCEPTED, if still ALLOCATED
    XW->>RTF: ACCEPTED event
    XW->>EXE: run
    EXE->>PS: PROCESSING, row DONE
    XW->>RTF: PROCESSING event
  end

  rect rgba(0,23,90,0.12)
    Note over R,RTF: 4 · Run the legs
    AD->>PS: write each batch's legs,<br/>1,000 rows at a time
    Note over AD,RTF: then the legs and the parent, as in diagram 3
  end
```

## 5. Update a scheduled payment

An update is a cancel followed by a new payment. The cancel is guarded, so it only lands while the payment is still `SCHEDULED` and inside its cancellation window. A corporate payment leaves `SCHEDULED` once its allocations are requested. A child `CreateScheduledPaymentWorkflow` then creates the replacement under a new ID, with the same confirmation number. Too late, and the caller gets 409.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  participant OD as UpdatePayment.v1
  participant R as Billpay Router
  participant UW as UpdatePayment<br/>Workflow
  participant CAN as Cancel
  participant PS as PaymentStore<br/>(Oracle)
  participant CW as CreateScheduled<br/>PaymentWorkflow
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    OD->>R: PUT /payments/{payment-id}
    Note over R: admit, pin profile
    R->>UW: Update-With-Start,<br/>{paymentId}-update
    Note over UW: checks the window, read-only
    UW->>CAN: run
    alt still SCHEDULED, inside the window
      CAN->>PS: old payment CANCELLED,<br/>with its rows
      UW->>RTF: CANCELLED event
      UW->>RAV: CANCELLED message
      UW->>CW: child, {newId}-init,<br/>same confirmation number
      Note over CW: Capture and Verify
      CW-->>UW: result
      Note over PS,CW: IDs mapped in ORIG_TRANS_REFER_MAP
      UW-->>R: new payment's result
      R-->>OD: new payment's result
    else too late
      UW-->>R: 409
      R-->>OD: 409
    end
  end
```

## 6. Cancel a payment

A cancel is one guarded update. It sets `CANCELLED` only if the payment is still `SCHEDULED`, which a corporate payment stops being once its allocations are requested. It cancels the payment's Work Tracker rows in the same commit, so no dispatcher can start a cancelled payment. Asking twice is safe: a payment that is already `CANCELLED` returns that result again. Anything else that loses the race or arrives outside the window gets 409. A customer's no to a payment that waits for bank confirmation goes elsewhere: it is an update to that payment's own `CreatePaymentIntentWorkflow`, guarded on `PENDING` and with no window check.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  participant OD as DeletePayment.v1
  participant R as Billpay Router
  participant CW as CancelPayment<br/>Workflow
  participant CAN as Cancel
  participant PS as PaymentStore<br/>(Oracle)
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    OD->>R: DELETE /payments/{payment-id}
    Note over R: admit, pin profile
    R->>CW: Update-With-Start,<br/>{paymentId}-cancel
    Note over CW: checks the window, read-only
    CW->>CAN: run
    alt still SCHEDULED
      CAN->>PS: CANCELLED, with its rows
      CW-->>R: CANCELLED
      R-->>OD: CANCELLED
      CW->>RTF: CANCELLED event
      CW->>RAV: CANCELLED message
    else already CANCELLED
      CW-->>R: CANCELLED again
      R-->>OD: CANCELLED
    else otherwise, or outside the window
      CW-->>R: 409
      R-->>OD: 409
    end
  end
```

## 7. Return

Returns come in bursts, so none is started straight from its event. One-Data stores each return in its inbox and acknowledges it once that commit is done. The returns dispatcher pulls the oldest at the governor's rate and starts each one through the Router at priority 5. The workflow first checks the payment, full or split, and that the presentment that came back is `PROCESSING`, `PROCESSED`, `PAID`, or `REPRESENTED` if it came back again. Return then commits `RETURNED` on it. If the payment can be represented, QueueRepresentment writes the next [presentment](./payment-state-model.md#presentments) as a new row, numbered one higher, in `REPRESENTING`, with the representment date as its clearing date and a `REPRESENT` row due that day.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: dispatcher start
  autonumber

  participant MM as MR/M3

  box rgba(0,23,90,0.07) One-Data
    participant IN as One-Data inbox
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant RD as Returns<br/>dispatcher
    participant R as Billpay Router
    participant WF as ProcessReturned<br/>PaymentWorkflow
    participant RET as Return
    participant QR as Queue<br/>Representment
    participant PS as PaymentStore<br/>(Oracle)
  end

  participant RTF
  participant RAV as Raven

  Note over MM,RAV: 1 · Arrive
  MM->>IN: return event,<br/>CreateMoneyMovementEventHandler.v1
  Note over IN: stored READY
  IN-->>MM: acknowledged

  rect rgba(0,23,90,0.12)
    Note over MM,RAV: 2 · Return, every minute
    RD->>IN: ReadStartRequests.v1
    IN-->>RD: the oldest READY returns
    RD->>R: start through the Router
    Note over R: admit, pin profile,<br/>priority 5
    R->>WF: dispatcher start,<br/>{paymentId}-return-{seq}
    RD->>IN: UpdateStartRequests.v1: DONE
    Note over WF,QR: checks the payment and the presentment that came back
    WF->>RET: run
    RET->>PS: presentment RETURNED
    WF->>RTF: RETURNED event
    WF->>RAV: RETURNED message
    opt representment allowed
      Note over WF,RET: date: the return's day plus delayDays
      WF->>QR: run
      QR->>PS: next presentment REPRESENTING,<br/>with a REPRESENT row
      WF->>RTF: REPRESENTING event
    end
  end

  Note over QR,PS: the REPRESENT row waits in Oracle for its date
```

## 8. Representment

On the representment date, the market's representment dispatcher claims the row and starts the workflow at priority 4. Represent rechecks eligibility before anything goes to clearing. The workflow ID carries the new presentment's number. If the recheck passes, that presentment goes to the bank and becomes `REPRESENTED`; if it fails, nothing is sent, the presentment is `DECLINED` and the customer is told.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: dispatcher start
  autonumber

  participant RPD as Representment<br/>dispatcher
  participant R as Billpay Router
  participant WF as Process<br/>Representment<br/>Workflow
  participant REP as Represent
  participant PS as PaymentStore<br/>(Oracle)
  participant RTF
  participant RAV as Raven

  Note over RPD,RAV: the REPRESENT row waits in Oracle until the representment date

  rect rgba(0,23,90,0.12)
    RPD->>PS: claim due REPRESENT rows
    RPD->>R: start through the Router
    Note over R: admit, pin profile,<br/>priority 4
    R->>WF: dispatcher start,<br/>{paymentId}-represent-{seq}
    RPD->>PS: row DISPATCHED
    WF->>REP: run
    Note over REP: rechecks eligibility
    alt passes
      Note over REP: sends it through clearing
      REP->>PS: REPRESENTED, row DONE
      WF->>RTF: REPRESENTED event
    else fails
      REP->>PS: DECLINED, row DONE
      WF->>RTF: DECLINED event
      WF->>RAV: DECLINED message
    end
  end
```

## 9. Inbound payment

Inbound payments are push payments: a third party sends the money in. One-Data stores each one and replies 202, so the sender never waits on Billpay. The inbound dispatcher starts it on Offline at priority 3, and Verify either accepts it or marks it `DISALLOWED`. An accepted one runs Execute with no clearing call, then Fulfil. One that is split runs a leg for each card account: a consumer's request names them, and a corporate payment's come from the allocations manager, as on [Corporate Allocations](./corporate-allocations.md).

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: dispatcher start
  autonumber

  participant TP as Third party

  box rgba(0,23,90,0.07) One-Data
    participant IN as One-Data inbox
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant ID as Inbound<br/>dispatcher
    participant R as Billpay Router
    participant WF as ProcessInbound<br/>PaymentWorkflow
    participant CAP as Capture
    participant VER as Verify
    participant PS as PaymentStore<br/>(Oracle)
  end

  participant RTF

  Note over TP,RTF: 1 · Arrive
  TP->>IN: push, CreateInboundPayment.v1
  Note over IN: stored READY
  IN-->>TP: 202

  rect rgba(0,23,90,0.12)
    Note over TP,RTF: 2 · Decide, every minute
    ID->>IN: ReadStartRequests.v1
    IN-->>ID: the oldest READY payments
    ID->>R: start through the Router
    Note over R: admit, pin profile,<br/>priority 3
    R->>WF: dispatcher start,<br/>{paymentId}-init
    ID->>IN: UpdateStartRequests.v1:<br/>DONE, or REJECTED
    WF->>CAP: run
    CAP->>PS: PENDING, if new
    WF->>RTF: PENDING event
    WF->>VER: run
    alt accepted
      VER->>PS: ACCEPTED
      WF->>RTF: ACCEPTED event
      Note over WF,VER: then Execute and Fulfil
    else not accepted
      VER->>PS: DISALLOWED
      WF->>RTF: DISALLOWED event
    end
  end
```

## 10. Paid events

A payment is paid once two events are in: the settlement from MR/M3 and the AR posting from GAR. A debit card payment has no clearing, so MR/M3 sends no settlement for it. Billpay creates that event itself: Execute hands it to the same handler MR/M3 uses, dated when the money moved, so its row pairs the same way. A Pay with Bank Transfer payment has no clearing either, but M3 reports its settlement, and that notice is the settlement. M3 sends it to One-Data's `CreateBillpaySettlementEvent.v1`, which records it for the pairing (Proposed). MR Points and inbound payments have no clearing either, and Billpay creates their settlement events as it does a debit card's (agreed 2026-11-23). One-Data's inbox keeps one row per payment or leg, and whichever event arrives second sets the row `READY`. A corporate leg's posting takes its payment's settlement, and a consumer split's leg has its own. Every 30 seconds a Schedule starts `ProcessPaidEventsWorkflow`, with no routing, which settles up to 500 rows in one transaction, tells RTF, and marks each row `DONE` if it turned `PAID`, or `UNMATCHED` if it didn't.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: settlement
  %% trigger: AR posting
  autonumber

  participant MM as MR/M3
  participant GAR

  box rgba(0,23,90,0.07) One-Data
    participant IN as One-Data inbox
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant SCH as Temporal<br/>Schedule
    participant WF as ProcessPaidEvents<br/>Workflow
    participant SET as Settle
    participant PS as PaymentStore<br/>(Oracle)
  end

  participant RTF

  Note over MM,RTF: 1 · Pair the two events, one inbox row per payment or leg
  MM->>IN: settlement,<br/>CreateMoneyMovementEventHandler.v1
  Note over MM,IN: debit card and Pay with Bank Transfer:<br/>Billpay's Execute sends it instead
  GAR->>IN: AR posting, CreateAccounts<br/>ReceivableTransactionEventHandler.v1
  Note over GAR,IN: the second one sets the row READY

  rect rgba(0,23,90,0.12)
    Note over MM,RTF: 2 · Settle, every 30 s
    SCH->>WF: start, overlap SKIP
    loop until a fetch returns fewer than 500 rows
      WF->>IN: ReadPaidReadyPayments.v1
      IN-->>WF: up to 500 READY rows
      WF->>SET: run, with a batch ID
      SET->>PS: PAID, one transaction
      WF->>RTF: PAID events, one call
      WF->>IN: UpdatePaidReadyPayments.v1:<br/>DONE or UNMATCHED
      Note over WF: paced by the governor
    end
  end
```

## 11. Missing paid events

Sometimes one of the two events never arrives. `ProcessMissingPaidEventsWorkflow` looks for payments and legs still `PROCESSED` after 48 hours, asks MR/M3 and GAR for what is missing (for a corporate leg, the settlement is its payment's; the posting is the leg's own), and sends anything it finds through the usual One-Data handler, so the event reaches the inbox the one way events do. MR/M3 never settles a debit card payment, so for one the check asks GAR alone, and always hands over Billpay's own settlement event again, since Billpay can't read the inbox to see whether it has it (Proposed). M3 does report a Pay with Bank Transfer payment's settlement, so whether the check asks it about one waits on how M3's notice reaches the pairing (open). Whatever it can't find raises an alert, and the inbox row shows which event is missing.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  participant MM as MR/M3
  participant GAR

  box rgba(0,23,90,0.07) One-Data
    participant IN as One-Data inbox
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant SCH as Temporal<br/>Schedule
    participant WF as ProcessMissing<br/>PaidEventsWorkflow
  end

  rect rgba(0,23,90,0.12)
    SCH->>WF: start, hourly (Proposed)
    Note over SCH,WF: still PROCESSED after 48 hours,<br/>split parents skipped
    loop each one found
      opt not a debit card
        WF->>MM: ask for the settlement
        MM-->>WF: current state
      end
      WF->>GAR: ask for the AR posting
      GAR-->>WF: current state
      opt a debit card
        WF->>IN: Billpay's own settlement again<br/>(Proposed)
      end
      alt found
        WF->>IN: hands it to its One-Data handler
      else still missing
        Note over SCH,WF: alert
      end
    end
  end

  Note over IN,WF: a row UNMATCHED for 48 hours alerts through UpdateUnmatchedPayments.v1
```

## 12. Pay & Plan

Pay & Plan is a composite. It starts on Online as `{paymentId}-plan` and captures and verifies the payment itself, because a child that decided would be heard only when it ended (agreed 2026-11-07). For an `ACCEPTED` payment it calls the Installments API and, when asked, updates Autopay, and the reply waits for all three: the decision, the plan and the Autopay update (agreed 2026-11-07). A child on the same cluster, `CreateImmediatePaymentWorkflow` started with the decision, runs Execute and Fulfil as `{paymentId}-init`, and the composite calls One-Data's delete. A declined payment gets no plan (Proposed). One-Data runs the same pending check first, as in diagram 15, so a request on an account with a payment already `PENDING` never gets here.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  participant OD as CreatePayment<br/>Installment.v1
  participant R as Billpay Router
  participant PP as Pay #amp; Plan<br/>composite
  participant CH as Execute and<br/>Fulfil child

  rect rgba(0,111,207,0.12)
    OD->>R: POST /payment-installments
    Note over R: admit, pin profile
    R->>PP: Update-With-Start,<br/>{paymentId}-plan
    Note over PP: Capture and Verify
    Note over PP: ACCEPTED: Installments,<br/>and Autopay if asked
    PP-->>R: decision, plan, Autopay
    R-->>OD: the reply, or<br/>PENDING at 2.5 s
    PP->>CH: child, {paymentId}-init
    Note over CH: Execute and Fulfil
  end
```

## 13. Allocations callback

The allocations manager sends a corporate payment's allocations in numbered batches. Billpay stores each batch in `allocation_batch`, starts `ReceiveAllocationsWorkflow` with only the payment ID and batch number, and replies 202 once the workflow exists. It is the only async start in Billpay, and the only start that can get 429, because an async start must stay inside its traffic class's budget. The workflow writes no legs. The batch that completes the amount moves the payment to `ALLOCATED` and writes its `ALLOC_EXEC` row in the same commit, and the allocated-payments dispatcher takes it from there.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: async start
  autonumber

  participant AM as Allocations<br/>manager
  participant OD as CreatePayment<br/>Allocations.v1
  participant R as Core API<br/>and Router
  participant PS as PaymentStore<br/>(Oracle)
  participant RW as ReceiveAllocations<br/>Workflow
  participant RC as ReceiveAllocations

  participant RTF

  AM->>OD: one numbered batch
  rect rgba(0,23,90,0.12)
    OD->>R: POST /payments/<br/>{payment-id}/allocations
    Note over R: admit: live, and<br/>inside the budget
    alt over budget
      R-->>OD: 429, Retry-After
      OD-->>AM: 429, retried
    else Offline cluster down
      R-->>OD: 503, Retry-After
      OD-->>AM: 503, retried
    else admitted
      R->>PS: store the batch in<br/>allocation_batch
      R->>RW: async start,<br/>{paymentId}-allocations-{batch}
      R-->>OD: 202
      OD-->>AM: 202
      RW->>RC: run
      Note over RC: checks the batch,<br/>writes no legs
      alt the batch completes the amount
        RC->>PS: ALLOCATED, with an<br/>ALLOC_EXEC row
        RW->>RTF: ALLOCATED event
      else more to come
        Note over RC,PS: stays ALLOCATING
      end
    end
  end
```

## 14. Pay by bank: create, submission, confirmation and settlement

Some payments wait for the customer to approve the payment at their bank. Billpay talks to one service for that, Amex Pay with Bank Transfer, which works with each market's provider, Plaid in the US among them. One workflow, `CreatePaymentIntentWorkflow`, holds the payment from the create to its end, in three phases. The first two are sync: the channel waits for the reply.

1. **Create a payment intent.** Capture writes the payment to the PaymentStore as `PENDING`, only if its ID is new, which is the idempotency check. Amex's own check runs next, Payment Options for the option the customer picked, then RequestConfirmation calls Amex Pay with Bank Transfer's `initiatePayment` for the redirect link and stores it on the payment. The channel gets `PENDING` with the link.
2. **Channel submission.** Once the payer's bank routes the customer back, the channel calls `POST /payments/{payment-id}/submission`, the Channel Submission Event. Billpay submits the payment through Amex Pay with Bank Transfer's `PaymentSubmission` once, and replies with its answer: `PENDING`, `ACCEPTED` or `DECLINED`. The channel shows the customer that status, and its part ends there.
3. **Async process.** Nobody waits from here on. If the channel never called, Amex Pay with Bank Transfer sends its own answer, the PwBT Confirmation Event: it calls One-Data's `UpdatePaymentConfirmation.v1`, and One-Data passes it on to billpay-online's `POST /payments/{payment-id}/confirmation`. While neither answer has come, Billpay asks `GET /payment-status` itself as the fallback, with a gap that starts at 2 minutes and doubles up to 30, until the answer is success or failure. Once the market's wait of 24 to 48 hours has passed since the create, a payment still pending is `DECLINED` with `CONFIRMATION_NOT_RECEIVED`. Then M3's notice that the bank has settled the money, the Bank Settled Event via M3, lets Execute and Fulfil run, with no clearing call. Fulfil tells accounting, TFNE, GPHDB and AMP, and sends nothing to RTF or Raven for `PROCESSED`. M3 sends it to One-Data's `CreateBillpaySettlementEvent.v1`, and One-Data passes it on to billpay-online's `POST /payments/{payment-id}/settlement`.

Pink arrows are the events and Temporal messages that reach the waiting workflow from outside.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber
  %% Pink arrows: something outside resumes the payment.
  %% trigger: Channel Submission Event
  %% trigger: update submit
  %% trigger: PwBT Confirmation Event
  %% trigger: signal confirmed
  %% trigger: Bank Settled Event via M3
  %% trigger: signal settled

  participant CH as Channel,<br/>through One-Data
  participant R as Billpay Router
  participant WF as CreatePaymentIntent<br/>Workflow
  participant PW as Amex Pay with<br/>Bank Transfer
  participant M3
  participant OD as One-Data
  participant PS as PaymentStore<br/>(Oracle)

  rect rgba(0,111,207,0.12)
    Note over CH,PS: 1 · Create a payment intent
    CH->>R: POST /payments
    R->>WF: Update-With-Start
    WF->>PS: Capture: PENDING, if new
    Note over WF: own checks
    WF->>PW: initiatePayment
    PW-->>WF: redirect link
    WF->>PS: the link
    WF-->>R: PENDING, with the link
    R-->>CH: PENDING, with the link
  end

  rect rgba(0,111,207,0.12)
    Note over CH,PS: 2 · Channel submission
    Note over CH,PW: the customer approves at their bank
    CH->>R: Channel Submission Event
    R->>WF: update submit
    WF->>PW: PaymentSubmission
    PW-->>WF: confirmed, declined or pending
    WF->>PS: ACCEPTED or DECLINED, if final
    WF-->>R: status
    R-->>CH: 200, the status
  end

  rect rgba(0,111,207,0.12)
    Note over CH,PS: 3 · Async process
    alt the channel never called
      PW->>OD: PwBT Confirmation Event
      OD->>R: POST /confirmation
      R->>WF: signal confirmed
      R-->>OD: 202
    else no answer yet: the fallback
      loop gap 2 to 30 min
        WF->>PW: GET /payment-status
        PW-->>WF: status
      end
    end
    WF->>PS: ACCEPTED or DECLINED
    M3->>OD: Bank Settled Event via M3
    OD->>R: POST /settlement
    R->>WF: signal settled
    R-->>OD: 202
    Note over WF: Execute, Fulfil
    WF->>PS: PROCESSING, then PROCESSED
  end
```

What the picture leaves out, so it stays readable:

- **Declines at the create.** A failed own check, or no link from Amex Pay with Bank Transfer, makes the payment `DECLINED` in one commit guarded on `PENDING`, and the channel gets `DECLINED` with no link.
- **A failed submission.** If `PaymentSubmission` times out or gets a 5xx, the reply is `PENDING`, and Amex Pay with Bank Transfer's confirmation or the fallback status calls decide the payment later.
- **After the reply.** The customer sees the payment's final state later in their list of payments, which the channel reads through `ReadPayments.v1`. RTF gets every state change as an event but `PROCESSED`, and Raven sends the customer the market's messages, none for `PROCESSED`.
- **A late confirmation.** Amex Pay with Bank Transfer sends its answer whether or not the channel called, so a payment already `ACCEPTED` ignores it. A confirmed answer on a payment already `DECLINED` or `CANCELLED` goes on the exception list with an alert (Proposed).
- **No answer at all.** The fallback status calls start 2 minutes after the create. The 2 minutes is still TBD, and so are the timeouts of `PaymentSubmission` and the status call.
- **The market's wait ends.** If the answer is still pending 24 to 48 hours after the create, the payment is `DECLINED` with `CONFIRMATION_NOT_RECEIVED`, and the asking stops.
- **A repeated submission.** It attaches to the same update and gets the same answer.
- **M3 first.** If M3's notice comes while the payment is still `PENDING`, it accepts the payment on its own, the calls stop, Billpay logs it, and Execute moves it to `PROCESSING`.
- **No notice.** An `ACCEPTED` payment whose notice never comes goes on the exception list, with an alert. How long it waits is still TBD.
- **A failed settlement.** M3's notice can say Amex never received the money from the payer's bank. The payment stays `ACCEPTED`, nothing executes, and a manual exception process moves it later.
- **The customer's no.** It cancels the payment at any point until it is decided, as in [Cancel a payment](./journeys/all-journeys.md#cancel-a-payment).
- **The delete.** Once the payment is decided, the workflow calls One-Data's delete API, so the account can take its next payment (diagram 15).

M3's notice that arrives after the payment was declined means money moved on a `DECLINED` payment. Billpay puts it on the exception list and raises an alert.

## 15. A new payment while another is pending

One-Data checks every create from a channel before billpay-online sees it. In one atomic call to Redis, a Lua script (Proposed), it reads the card account's pending payments and, if there are none, adds the new payment and stores the create. A Pay with Bank Transfer, Plaid or debit card create is checked, added and stored the same way (agreed 2026-11-08). If the account already has a payment in `PENDING`, One-Data answers 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the name is Proposed), and never calls billpay-online, so no payment exists in Billpay for the attempt. When Redis is down, One-Data asks `ReadPayments.v1` instead, which then reads billpay-online alone, so a create billpay-online hasn't captured yet can be missed. A payment keeps its entry only until it is decided: then its workflow calls One-Data's delete API, after the reply, and the account can take its next payment. Payments AR raises, push payments from third parties and refunds skip the check.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) One-Data
    participant OD as CreatePayment.v3
    participant RD as One-Data's<br/>Redis
    participant RP as ReadPayments.v1
  end

  participant R as Billpay Router
  participant WF as CreateImmediate<br/>PaymentWorkflow
  participant PS as PaymentStore<br/>(Oracle)

  Note over OD,PS: 1 · Pending check
  alt Redis up
    OD->>RD: one atomic call (Proposed):<br/>pending? if not, add and store
    RD-->>OD: PENDING found,<br/>or added and stored
  else Redis down
    OD->>RP: the account's payments
    RP-->>OD: a PENDING payment, or none
  end

  alt a payment is PENDING
    Note over OD,RD: 200 DECLINED,<br/>ANOTHER_PAYMENT_PENDING (Proposed)
  else none
    rect rgba(0,111,207,0.12)
      Note over OD,PS: 2 · Create, as in diagram 1
      OD->>R: POST /payments
      R->>WF: Update-With-Start,<br/>{paymentId}-init
      WF->>PS: Capture, Verify:<br/>ACCEPTED or DECLINED
      WF-->>R: update result
      R-->>OD: ACCEPTED or DECLINED
      WF->>RD: DeletePendingPayment.v1
    end
  end

  Note over OD,PS: the entry stays only while the payment is PENDING
```

## 16. Pay by Debit card: create, 3D Secure and authorization

A debit card payment needs 3D Secure, the card schemes' check that the customer is the cardholder, and then an authorization that takes the money. One workflow, `CreatePaymentIntentWorkflow`, holds the payment throughout. Amex's own checks run first, on the instrument and the payment option, and a payment that fails them is `DECLINED` before 3D Secure starts. RequestConfirmation then asks the market's card provider (Checkout.com in the UK) to start 3D Secure and gives it Billpay's callback URL. The create's update ends at `PENDING` with the challenge link, or with no link when the card's bank needs no challenge. The provider then calls billpay-online directly, not through One-Data, and the callback is an update to the same workflow. Verify then only authorizes the payment: the authorization debits the customer's account if it holds enough money, and the card's bank declines it if not. The callback's reply carries the decision, and the callback itself is authenticated by mutual TLS. Execute makes no clearing call, because the money has already moved, and hands One-Data the settlement event Billpay creates, dated when the money moved. Once the payment is decided, the workflow calls One-Data's delete API, as in diagram 14. If no callback comes within 2 minutes and the grace, the timer cancels the payment, and nothing was taken.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  %% Pink arrows: something outside starts or resumes the payment.
  %% trigger: update authenticated
  autonumber

  participant OD as CreatePayment.v3
  participant R as Billpay Router
  participant WF as CreatePaymentIntent<br/>Workflow
  participant RQC as Request<br/>Confirmation
  participant VER as Verify
  participant CAN as Cancel
  participant PS as PaymentStore<br/>(Oracle)

  participant CP as Card provider<br/>(3D Secure)
  participant RTF
  participant RAV as Raven

  rect rgba(0,111,207,0.12)
    Note over OD,RAV: 1 · Create
    OD->>R: POST /payments, debit card
    Note over R: admit, card authentication Y,<br/>pin profile
    R->>WF: Update-With-Start,<br/>{paymentId}-init
    WF->>PS: Capture: PENDING, if new
    WF->>VER: own checks
    alt a check fails
      VER->>PS: DECLINED
    else they pass
      WF->>RQC: run
      RQC->>CP: start 3D Secure, one try
      alt the provider answers
        RQC->>PS: challenge link or none
      else no answer
        RQC->>PS: DECLINED
      end
    end
    WF-->>R: update result
    R-->>OD: PENDING with the link<br/>or none, or DECLINED
  end

  Note over WF,CP: the customer completes the challenge: 2 minutes and a 10 s grace

  alt callback in time
    rect rgba(0,111,207,0.12)
      Note over OD,RAV: 2 · Authorize
      CP->>R: POST /payments/{payment-id}/<br/>authentication (Proposed)
      R->>WF: update authenticated,<br/>{paymentId}-authentication
      WF->>VER: run, with the result
      opt 3D Secure passed
        VER->>CP: authorize, payment ID as<br/>idempotency key (Proposed)
        CP-->>VER: approved or declined
      end
      VER->>PS: ACCEPTED or DECLINED
      WF-->>R: update result
      R-->>CP: ACCEPTED or DECLINED,<br/>409 once too late
      WF->>RTF: ACCEPTED or DECLINED event
      Note over WF,VER: ACCEPTED: Execute, no clearing call, then<br/>Fulfil, with no RTF or Raven. DECLINED: Raven message
    end
  else no callback
    rect rgba(0,111,207,0.12)
      Note over OD,RAV: 2 · Time out
      WF->>CAN: run
      CAN->>PS: CANCELLED
      WF->>RTF: CANCELLED event
      WF->>RAV: CANCELLED message
    end
  end
```
