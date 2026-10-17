---
title: Sequence Diagrams
description: "Thirteen flows traced end to end, from the call or Schedule that starts each one to the stages that do the work and the commits they make."
sidebar_label: Sequence Diagrams
---

import Lead from '@site/src/components/Lead';

# Sequence Diagrams

<Lead>Thirteen flows traced end to end, from the call or Schedule that starts each one to the stages that do the work and the commits they make. Each one shows which cluster runs every step, and when RTF and Raven hear about it.</Lead>

<details>
<summary>How to read these diagrams</summary>

- The group on the left is whoever starts the flow: a One-Data contract such as `CreatePayment.v3`, or One-Data's inbox when Billpay pulls the work. The light-blue group is the Billpay Platform.
- Every payment workflow starts through the Router, and its note names the hops: admit, pin the plan key, then place the work on a cluster. The PAID drain and the missing-events check start from Schedules instead.
- A Bright Blue band is the Online cluster, where a caller is waiting. A Deep Blue band is the Offline cluster, where dispatchers pace the work. A grey, dashed band is time when nothing runs in Temporal, because the work is waiting in Oracle or in One-Data's inbox.
- The participants are the workflow and its stages, such as Capture, Verify and Execute. The systems a stage calls, such as clearing and Accounts Receivable, appear in its notes rather than as participants.
- A pale-blue chip, such as `state → ACCEPTED`, is a commit through `PaymentStore`: the guarded state change and its timeline entry in one transaction, with any Work Tracker rows.
- RTF and Raven are drawn because their timing matters. Each change is announced to RTF, and to Raven where the customer is told, after the commit that makes it. Fulfil is the exception: it tells both before it commits `PROCESSED`.
- The wider diagrams carry an expand control in the top right, which opens a full-window view. Escape closes it.

</details>

## 1. Pay today, one instruction

The caller is waiting for one answer: did the payment go through? So the workflow replies as soon as Verify commits, and only then announces the change and moves the money. Execute and Fulfil finish on Online after the reply, and Fulfil tells RTF and Raven before it commits `PROCESSED`, so nothing is marked processed until both know.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as CreatePayment.v3
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant WF as CreateImmediate<br/>PaymentWorkflow
    participant CAP as Capture
    participant VER as Verify
    participant EXE as Execute
    participant FUL as Fulfil
    participant PS as PaymentStore (Oracle)
  end

  participant RTF
  participant RAV as Raven

  OD->>R: POST /payments,<br/>today, one instruction
  Note over R: admit, pin plan key, place on Online
  R->>WF: Update-With-Start,<br/>{paymentId}-init

  rect rgba(0,111,207,0.12)
    Note over WF,PS: Online cluster. Capture and Verify commit back to back
    WF->>CAP: run
    rect rgba(102,169,226,0.40)
      CAP->>PS: state → PENDING, idempotency checked
    end
    WF->>VER: run
    rect rgba(102,169,226,0.40)
      VER->>PS: state → ACCEPTED or DECLINED
    end
  end

  WF-->>R: update result
  R-->>OD: ACCEPTED or DECLINED

  rect rgba(0,111,207,0.12)
    Note over WF,RAV: Online cluster, after the reply
    WF->>RTF: PENDING event
    alt DECLINED
      WF->>RTF: DECLINED event
      WF->>RAV: DECLINED message
    else ACCEPTED
      WF->>RTF: ACCEPTED event
      WF->>EXE: run
      Note over EXE: clearing, AR and OTB in parallel
      rect rgba(102,169,226,0.40)
        EXE->>PS: state → PROCESSING
      end
      WF->>RTF: PROCESSING event
      WF->>FUL: run
      Note over FUL: accounting, eBNC and risk in parallel
      FUL->>RTF: PROCESSED event
      FUL->>RAV: PROCESSED message
      rect rgba(102,169,226,0.40)
        FUL->>PS: state → PROCESSED
      end
    end
  end
```

## 2. Scheduled payment, created today and executed later

A scheduled payment costs Temporal nothing while it waits. Intake on Online commits `SCHEDULED` together with a `SCHED_EXEC` row, replies and ends, and the row sits in Oracle for up to 30 days. On the due date the market's dispatcher routes the payment again, with that day's config, and starts `ExecuteScheduledPaymentWorkflow` on Offline. Reverify's guarded update settles any race with a late cancel.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as CreatePayment.v3
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant CW as CreateScheduled<br/>PaymentWorkflow
    participant VER as Verify
    participant PS as PaymentStore (Oracle)
    participant SD as Scheduled-payments<br/>dispatcher
    participant XW as ExecuteScheduled<br/>PaymentWorkflow
    participant REV as Reverify
  end

  participant RTF
  participant RAV as Raven

  OD->>R: POST /payments,<br/>future date
  Note over R: admit, pin plan key, place on Online
  R->>CW: Update-With-Start,<br/>{paymentId}-init

  rect rgba(0,111,207,0.12)
    Note over CW,PS: Online cluster, the day it is created
    Note over CW: Capture first: PENDING
    CW->>VER: run
    rect rgba(102,169,226,0.40)
      VER->>PS: state → SCHEDULED,<br/>with the SCHED_EXEC row,<br/>one commit
    end
  end

  CW-->>R: update result
  R-->>OD: SCHEDULED

  rect rgba(0,111,207,0.12)
    Note over CW,RAV: Online cluster, after the reply
    CW->>RTF: PENDING event
    CW->>RTF: SCHEDULED event
    CW->>RAV: SCHEDULED message
  end

  rect rgba(83,86,90,0.14)
    Note over CW,XW: The SCHED_EXEC row waits in Oracle, up to 30 days. Nothing runs in Temporal
  end

  rect rgba(0,23,90,0.12)
    Note over SD,RAV: Offline cluster, at the market's execution time on the due date
    SD->>PS: claim due SCHED_EXEC<br/>rows: DISPATCHING
    SD->>R: re-route with today's config
    Note over R: admit, pin plan key, place on Offline
    R->>XW: dispatcher start, {paymentId}-execute
    SD->>PS: mark the row<br/>DISPATCHED
    XW->>REV: run
    rect rgba(102,169,226,0.40)
      REV->>PS: state → ACCEPTED, guarded: only if still SCHEDULED
    end
    XW->>RTF: ACCEPTED event
    Note over XW,REV: Execute, then Fulfil, as for pay today. The last commit marks the row DONE
  end
```

## 3. Corporate payment, pay today

A corporate payment runs on two tracks. The parent clears once, as one payment, while its allocations are requested from the allocations manager and arrive later by callback. Paid today, the parent is released at once, so each leg is `SCHEDULED` as soon as it is written and the leg dispatcher starts it. Every 60 seconds a completion check moves the parent to `PROCESSED` once it has cleared and every leg is `PROCESSED` or `PAID`.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as CreatePayment.v3
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant WF as CreateImmediate<br/>PaymentWorkflow
    participant VER as Verify
    participant EXE as Execute
    participant PS as PaymentStore (Oracle)
    participant AD as Allocation<br/>dispatchers
    participant RQ as RequestAllocations
  end

  participant RTF
  participant RAV as Raven

  OD->>R: POST /payments,<br/>corporate, today
  Note over R: admit, pin plan key, place on Online
  R->>WF: Update-With-Start,<br/>{paymentId}-init

  rect rgba(0,111,207,0.12)
    Note over WF,PS: Online cluster. The parent clears on its own track
    Note over WF: Capture first: PENDING
    WF->>VER: run
    rect rgba(102,169,226,0.40)
      VER->>PS: state → ACCEPTED, with the ALLOC_REQUEST row,<br/>legs released, one commit
    end
  end

  WF-->>R: update result
  R-->>OD: ACCEPTED

  rect rgba(0,111,207,0.12)
    Note over WF,RTF: Online cluster, after the reply
    WF->>RTF: PENDING event
    WF->>RTF: ACCEPTED event
    WF->>EXE: run
    Note over EXE: clears at payment level
    rect rgba(102,169,226,0.40)
      EXE->>PS: state → PROCESSING
    end
    WF->>RTF: PROCESSING event
    Note over WF,EXE: No Fulfil. The leg dispatcher completes the parent
  end

  rect rgba(0,23,90,0.12)
    Note over R,RQ: Offline cluster: the allocation-request dispatcher, at once for pay today
    AD->>PS: claim the due<br/>ALLOC_REQUEST row
    AD->>R: start through the Router
    Note over R: admit, pin plan key, place on Offline
    R->>RQ: start RequestAllocationsWorkflow, {paymentId}-allocations
    Note over RQ: asks the allocations manager, then ends
    rect rgba(102,169,226,0.40)
      RQ->>PS: allocation status → ALLOCATING
    end
  end

  rect rgba(0,23,90,0.12)
    Note over R,RQ: Offline cluster: the allocations manager calls back through One-Data
    Note over R,PS: the callback API stores the batch in allocation_batch,<br/>then admit, pin plan key, place on Offline, async start of ReceiveAllocationsWorkflow, and 202
    Note over PS,RQ: ReceiveAllocationsWorkflow writes each leg ACCEPTED with its ALLOC_LEG row, SCHEDULED at once because the parent is released. Allocation status → ALLOCATED once the legs add up
  end

  rect rgba(0,23,90,0.12)
    Note over R,RQ: Offline cluster: the leg dispatcher, every minute
    AD->>PS: claim released ALLOC_LEG<br/>rows, fair across parents
    AD->>R: start each leg through the Router
    Note over R,WF: admit, pin plan key, place on Offline: priority 2, the parent's ID as fairness key
    Note over R,PS: One ExecuteSplitPaymentWorkflow per leg, {paymentId}_{seq}-execute: AR and OTB, no clearing, then accounting, eBNC and risk, then the leg's RTF event and Raven message, then PROCESSED
  end

  rect rgba(0,23,90,0.12)
    Note over PS,RAV: Offline cluster: the completion check, every 60 s
    AD->>PS: count the parent's<br/>legs by status
    Note over AD: cleared, and every leg PROCESSED or PAID
    AD->>RTF: parent's PROCESSED event
    AD->>RAV: parent's PROCESSED message
    rect rgba(102,169,226,0.40)
      AD->>PS: parent → PROCESSED,<br/>guarded update
    end
  end
```

## 4. Corporate payment, scheduled

Scheduled, the allocations can arrive days before the parent executes, so the legs wait. Their rows are written `HELD`, which keeps them out of the claim index, until Reverify makes the parent `ACCEPTED` on its due date and sets `legs_released_at`. The leg dispatcher then moves the rows to `SCHEDULED` in chunks of 5,000 and starts the legs as it does for pay today.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant XW as ExecuteScheduled<br/>PaymentWorkflow
    participant REV as Reverify
    participant PS as PaymentStore (Oracle)
    participant SD as Scheduled-payments<br/>dispatcher
    participant AD as Allocation<br/>dispatchers
    participant RQ as RequestAllocations
    participant RC as ReceiveAllocations
  end

  participant RTF

  rect rgba(83,86,90,0.14)
    Note over R,RC: Intake commits SCHEDULED with a SCHED_EXEC row, and an ALLOC_REQUEST row due at the market's fetch time. Both wait in Oracle
  end

  rect rgba(0,23,90,0.12)
    Note over R,RC: Offline cluster: the allocation-request dispatcher, at the market's fetch time
    AD->>PS: claim the due ALLOC_REQUEST row
    AD->>R: start through the Router
    Note over R: admit, pin plan key, place on Offline
    R->>RQ: start RequestAllocationsWorkflow, {paymentId}-allocations
    Note over RQ: asks the allocations manager, then ends
    rect rgba(102,169,226,0.40)
      RQ->>PS: allocation status → ALLOCATING
    end
  end

  rect rgba(0,23,90,0.12)
    Note over R,RC: Offline cluster: the allocations manager calls back through One-Data
    Note over R,PS: the callback API stores the batch in allocation_batch,<br/>then admit, pin plan key, place on Offline
    R->>RC: async start ReceiveAllocationsWorkflow, then 202
    RC->>PS: legs ACCEPTED, each ALLOC_LEG row HELD while the parent is not yet ACCEPTED
    rect rgba(102,169,226,0.40)
      RC->>PS: allocation status → ALLOCATED, once the legs add up
    end
  end

  rect rgba(83,86,90,0.14)
    Note over PS,RC: HELD rows stay out of the claim index, so no dispatcher sees them
  end

  rect rgba(0,23,90,0.12)
    Note over R,RTF: Offline cluster: the scheduled-payments dispatcher, on the due date
    SD->>PS: claim the due<br/>SCHED_EXEC row
    SD->>R: re-route with today's config
    Note over R: admit, pin plan key, place on Offline
    R->>XW: dispatcher start,<br/>{paymentId}-execute
    XW->>REV: run
    rect rgba(102,169,226,0.40)
      REV->>PS: parent → ACCEPTED,<br/>sets legs_released_at
    end
    XW->>RTF: ACCEPTED event
    Note over XW,REV: Execute clears at payment level. No Fulfil
  end

  rect rgba(0,23,90,0.12)
    Note over PS,RC: Offline cluster: the leg dispatcher, every minute
    AD->>PS: move the parent's HELD rows<br/>to SCHEDULED, 5,000 at a time
    AD->>R: start each leg, as for pay today
  end
```

## 5. Update a scheduled payment

An update is a cancel followed by a new payment. The cancel is guarded, so it only lands while the payment is still `SCHEDULED` and inside its cancellation window. A child `CreateScheduledPaymentWorkflow` then creates the replacement under a new ID, with the same confirmation number. Too late, and the caller gets 409.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as UpdatePayment.v1
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant UW as UpdatePayment<br/>Workflow
    participant CAN as Cancel
    participant PS as PaymentStore (Oracle)
    participant CW as CreateScheduled<br/>PaymentWorkflow
  end

  participant RTF
  participant RAV as Raven

  OD->>R: PUT /payments/<br/>{payment-id}
  Note over R: admit, pin plan key, place on Online
  R->>UW: Update-With-Start,<br/>{paymentId}-update

  rect rgba(0,111,207,0.12)
    Note over UW,CW: Online cluster, the child on the same cluster
    Note over UW,CAN: checks the window and eligibility, read-only
    UW->>CAN: run
    alt still SCHEDULED, inside the window
      rect rgba(102,169,226,0.40)
        CAN->>PS: old payment → CANCELLED,<br/>guarded, with its<br/>Work Tracker rows
      end
      UW->>RTF: CANCELLED event
      UW->>RAV: CANCELLED message
      UW->>CW: child, {newId}-init, same confirmation number
      Note over CW: Capture and Verify, as for any scheduled payment
      CW-->>UW: the new payment's result
      Note over PS,CW: old and new IDs mapped in ORIG_TRANS_REFER_MAP
      UW-->>R: new payment's result
      R-->>OD: new payment's result
    else no longer SCHEDULED, or the window has closed
      UW-->>R: 409
      R-->>OD: 409
    end
  end
```

## 6. Cancel a payment

A cancel is one guarded update. It sets `CANCELLED` only if the payment is still `SCHEDULED`, and cancels the payment's Work Tracker rows in the same commit, so no dispatcher can start a cancelled payment. Asking twice is safe: a payment that is already `CANCELLED` returns that result again. Anything else that loses the race, or arrives outside the window, gets 409.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as DeletePayment.v1
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant CW as CancelPayment<br/>Workflow
    participant CAN as Cancel
    participant PS as PaymentStore (Oracle)
  end

  participant RTF
  participant RAV as Raven

  OD->>R: DELETE /payments/<br/>{payment-id}
  Note over R: admit, pin plan key, place on Online
  R->>CW: Update-With-Start,<br/>{paymentId}-cancel

  rect rgba(0,111,207,0.12)
    Note over CW,PS: Online cluster
    Note over CW,CAN: checks the window and eligibility, read-only
    CW->>CAN: run
    alt the guarded update finds it SCHEDULED
      rect rgba(102,169,226,0.40)
        CAN->>PS: state → CANCELLED,<br/>Work Tracker rows<br/>cancelled, one commit
      end
      CW-->>R: CANCELLED
      R-->>OD: CANCELLED
      CW->>RTF: CANCELLED event
      CW->>RAV: CANCELLED message
    else zero rows updated, already CANCELLED
      CW-->>R: CANCELLED again
      R-->>OD: CANCELLED
    else zero rows updated otherwise, or outside the window
      CW-->>R: 409
      R-->>OD: 409
    end
  end
```

## 7. Return

Returns come in bursts, so none is started straight from its event. One-Data stores each return in its inbox and acknowledges it once that commit is done. The returns dispatcher pulls the oldest at the governor's rate and starts each one through the Router at priority 5. Return commits `RETURNED`, and if the payment can be represented, QueueRepresentment commits `REPRESENTING` with a `REPRESENT` row due on the representment date.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
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
    participant PS as PaymentStore (Oracle)
  end

  participant RTF
  participant RAV as Raven

  MM->>IN: return event:<br/>MoneyMovementEventHandler.v1
  rect rgba(83,86,90,0.14)
    Note over IN: stored as a READY start request
  end
  IN-->>MM: acknowledged<br/>after the commit

  rect rgba(0,23,90,0.12)
    Note over RD,RAV: Offline cluster: the returns dispatcher, every minute
    RD->>IN: ReadStartRequests.v1
    IN-->>RD: the oldest<br/>READY returns
    RD->>R: start through<br/>the Router
    Note over R: admit, pin plan key, place on Offline: priority 5
    R->>WF: dispatcher start,<br/>{paymentId}-return-{seq}
    RD->>IN: UpdateStartRequests.v1:<br/>DONE
    Note over WF,QR: checks the payment, full or split, and its status: PROCESSING, PROCESSED, PAID, or REPRESENTED if returned again
    WF->>RET: run
    rect rgba(102,169,226,0.40)
      RET->>PS: state → RETURNED
    end
    WF->>RTF: RETURNED event
    WF->>RAV: RETURNED message
    opt it can be represented
      Note over WF,RET: date from market rules, today or later
      WF->>QR: run
      rect rgba(102,169,226,0.40)
        QR->>PS: state → REPRESENTING,<br/>with a REPRESENT row<br/>due on that date
      end
      WF->>RTF: REPRESENTING event
    end
  end

  rect rgba(83,86,90,0.14)
    Note over QR,PS: The REPRESENT row waits in Oracle for its date. No direct hand-off
  end
```

## 8. Representment

On the representment date, the market's representment dispatcher claims the row and starts the workflow at priority 4. Represent rechecks eligibility before anything goes to clearing. If the recheck passes, the payment is presented again and becomes `REPRESENTED`; if it fails, the payment is `DECLINED` and the customer is told.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,111,207,0.05) Billpay Platform
    participant RPD as Representment<br/>dispatcher
    participant R as Billpay Router
    participant WF as Process<br/>Representment<br/>Workflow
    participant REP as Represent
    participant PS as PaymentStore (Oracle)
  end

  participant RTF
  participant RAV as Raven

  rect rgba(83,86,90,0.14)
    Note over RPD,PS: The REPRESENT row waits in Oracle until the representment date
  end

  rect rgba(0,23,90,0.12)
    Note over RPD,RAV: Offline cluster: the market's representment dispatcher, every few minutes
    RPD->>PS: claim due REPRESENT rows: DISPATCHING
    RPD->>R: start through<br/>the Router
    Note over R: admit, pin plan key, place on Offline: priority 4
    R->>WF: dispatcher start,<br/>{paymentId}-represent-{seq}
    RPD->>PS: mark the row DISPATCHED
    WF->>REP: run
    Note over REP: rechecks eligibility before anything goes to clearing
    alt the recheck passes
      Note over REP: presents it again through clearing
      rect rgba(102,169,226,0.40)
        REP->>PS: state → REPRESENTED,<br/>row DONE
      end
      WF->>RTF: REPRESENTED event
    else the recheck fails
      rect rgba(102,169,226,0.40)
        REP->>PS: state → DECLINED,<br/>row DONE
      end
      WF->>RTF: DECLINED event
      WF->>RAV: DECLINED message
    end
  end
```

## 9. Inbound payment

Inbound payments come from third parties. One-Data stores each one and replies 202, so the sender never waits on Billpay. The inbound dispatcher starts it on Offline at priority 3, and Verify either accepts it or marks it `DISALLOWED`.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
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
    participant PS as PaymentStore (Oracle)
  end

  participant RTF

  TP->>IN: push:<br/>CreateInboundPayment.v1
  rect rgba(83,86,90,0.14)
    Note over IN: stored as a READY start request
  end
  IN-->>TP: 202

  rect rgba(0,23,90,0.12)
    Note over ID,RTF: Offline cluster: the inbound dispatcher, every minute
    ID->>IN: ReadStartRequests.v1
    IN-->>ID: the oldest READY<br/>inbound payments
    ID->>R: start through<br/>the Router
    Note over R: admit, pin plan key, place on Offline: priority 3
    R->>WF: dispatcher start,<br/>{paymentId}-init
    ID->>IN: UpdateStartRequests.v1: DONE,<br/>or REJECTED if not admitted
    WF->>CAP: run
    rect rgba(102,169,226,0.40)
      CAP->>PS: state → PENDING
    end
    WF->>RTF: PENDING event
    WF->>VER: run
    alt accepted
      rect rgba(102,169,226,0.40)
        VER->>PS: state → ACCEPTED
      end
      WF->>RTF: ACCEPTED event
      Note over WF,VER: then Execute, then Fulfil
    else not accepted
      rect rgba(102,169,226,0.40)
        VER->>PS: state → DISALLOWED
      end
      WF->>RTF: DISALLOWED event
    end
  end
```

## 10. Paid events

A payment is paid once two events are in: the settlement from MR/M3 and the AR posting from GAR. One-Data's inbox keeps one row per payment or leg, and whichever event arrives second sets the row `READY`. Every 30 seconds a Schedule starts `ProcessPaidEventsWorkflow`, which settles up to 500 rows in one transaction, tells RTF, and marks each row `DONE` if it turned `PAID`, or `UNMATCHED` if it didn't.

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
    participant WF as ProcessPaidEvents<br/>Workflow
    participant SET as Settle
    participant PS as PaymentStore (Oracle)
  end

  participant RTF

  rect rgba(83,86,90,0.14)
    Note over MM,IN: One-Data's inbox keeps one row per payment or leg
    MM->>IN: settlement, MoneyMovementEventHandler.v1
    GAR->>IN: AR posting, AccountsReceivable<br/>TransactionEventHandler.v1
    Note over GAR,IN: whichever arrives second sets the row READY. A leg's posting takes its payment's settlement
  end

  rect rgba(0,23,90,0.12)
    Note over SCH,RTF: Offline cluster. Not routed: a Schedule starts it
    SCH->>WF: start every 30 s,<br/>overlap SKIP
    loop each batch, until a fetch returns fewer than 500 rows
      WF->>IN: ReadPaidReadyPayments.v1
      IN-->>WF: up to 500 of the oldest READY rows
      WF->>SET: run, with a batch ID from<br/>Workflow.randomUUID()
      rect rgba(102,169,226,0.40)
        SET->>PS: state → PAID for each row,<br/>one transaction,<br/>tagged with the batch ID
      end
      WF->>RTF: PAID events for the batch ID's payments and legs, one call
      WF->>IN: UpdatePaidReadyPayments.v1:<br/>DONE if PAID, otherwise UNMATCHED
      Note over WF: waits as the governor's PAID rate asks
    end
  end
```

## 11. Missing paid events

Sometimes one of the two events never arrives. `ProcessMissingPaidEventsWorkflow` looks for payments and legs still `PROCESSED` after 48 hours, asks MR/M3 and GAR for what is missing, and sends anything it finds through the usual One-Data handler, so the event reaches the inbox the one way events do. Whatever it can't find raises an alert.

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
    Note over IN,WF: Offline cluster
    SCH->>WF: start, periodically
    Note over SCH,WF: finds payments and legs still PROCESSED after 48 hours. Split parents are skipped
    loop each one found
      WF->>MM: asks for the settlement: its own, or for a leg, its payment's
      MM-->>WF: current state
      WF->>GAR: asks for the AR posting: the payment's, or the leg's own
      GAR-->>WF: current state
      alt an event is found
        WF->>IN: hands it to its One-Data handler
        Note over IN: it reaches the inbox the one way events do
      else still missing
        Note over SCH,WF: alert. The inbox row shows which event is missing
      end
    end
    Note over IN,WF: A row UNMATCHED for 48 hours is left for a person. The alert names it
  end
```

## 12. Pay & Plan

Pay & Plan is a composite. It starts on Online, runs the payment as a child `CreateImmediatePaymentWorkflow` on the same cluster, then calls the Installments API and, when asked, updates Autopay.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant OD as CreatePayment<br/>Installment.v1
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Billpay Router
    participant PP as Pay #amp; Plan<br/>composite
    participant CIW as CreateImmediate<br/>PaymentWorkflow
  end

  OD->>R: POST<br/>/payment-installments
  Note over R: admit, pin plan key, place on Online
  R->>PP: Update-With-Start,<br/>{paymentId}-init

  rect rgba(0,111,207,0.12)
    Note over PP,CIW: Online cluster. The child runs on the same cluster
    PP->>CIW: child workflow
    Note over CIW: Capture, Verify, Execute and Fulfil, as for pay today
    CIW-->>PP: the child's result
    Note over PP,CIW: then the Installments API, then an optional Autopay update
  end
```

## 13. Allocations callback

The allocations manager sends a corporate payment's allocations in numbered batches. Billpay stores each batch in `allocation_batch`, starts `ReceiveAllocationsWorkflow` with only the payment ID and batch number, and replies 202 once the workflow exists. It is the only async start in Billpay, and the only start that can get 429, because an async start must stay inside its traffic class's budget.

```mermaid
---
config:
  fontFamily: "BentonSansUI, Helvetica, Arial, sans-serif"
  fontSize: 15
---
sequenceDiagram
  autonumber

  box rgba(0,23,90,0.07) Caller
    participant AM as Allocations<br/>manager
    participant OD as CreatePayment<br/>Allocations.v1
  end

  box rgba(0,111,207,0.05) Billpay Platform
    participant R as Core API<br/>and Router
    participant PS as PaymentStore (Oracle)
    participant RW as ReceiveAllocations<br/>Workflow
    participant RC as ReceiveAllocations
  end

  AM->>OD: one batch,<br/>numbered per payment
  OD->>R: POST /payments/<br/>{payment-id}/allocations
  Note over R: admit: live, and inside the class's budget
  alt over budget
    R-->>OD: 429 with Retry-After
    OD-->>AM: 429, and the allocations<br/>manager retries
  else the Offline cluster is down
    R-->>OD: 503 with Retry-After
    OD-->>AM: 503, and it is retried
  else admitted
    R->>PS: store the batch in<br/>allocation_batch
    Note over R: pin plan key, place on Offline
    R->>RW: async start, {paymentId}-allocations-{batch},<br/>with only the payment ID and batch number
    R-->>OD: 202, once the<br/>workflow exists
    OD-->>AM: 202
    rect rgba(0,23,90,0.12)
      Note over RW,RC: Offline cluster
      RW->>RC: run
      Note over RC: checks the stored batch
      RC->>PS: legs {paymentId}_{seq} in ACCEPTED,<br/>each with its ALLOC_LEG row,<br/>in 1,000-row inserts
      Note over PS,RW: rows HELD while the parent is not yet ACCEPTED, SCHEDULED once it is released
      rect rgba(102,169,226,0.40)
        RC->>PS: allocation status → ALLOCATED, once the legs add up
      end
    end
  end
```
