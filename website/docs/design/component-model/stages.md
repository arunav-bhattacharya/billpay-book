---
title: Stages
description: 'A stage is one business step, named for the journey step it performs. It makes its calls, commits the result in one guarded Oracle transaction, and returns its outcome.'
---

import Lead from '@site/src/components/Lead';

# Stages

<Lead>A stage is one business step, named for the journey step it performs: Verify, Execute, Settle. It makes its calls, in parallel where they don't depend on each other, commits the result in one guarded Oracle transaction, and returns its outcome.</Lead>

Stages are the only layer that changes between markets. Verify in a market that checks a mandate is a different implementation from Verify in one that doesn't, and the workflow never knows the difference: it looks its stages up from its plan key, and the most specific match wins. Twelve stages cover every journey.

## What every stage does

Every stage follows the same three beats.

1. It calls its activities, in parallel where the calls don't depend on each other.
2. It commits in one guarded `PaymentStore` transaction: the new state, a timeline entry that names the cluster, and any Work Tracker rows the step creates, releases or closes.
3. After the commit, the workflow calls the stage's announcement: an RTF lifecycle event for every state change, plus a Raven message where the customer is told. The workflow waits for it before the next stage, so each payment's events reach RTF in order.

Two stages bend that order, for good reasons:

- On the Online cluster, Capture and Verify commit back to back so the caller's answer isn't held up. Both announcements follow the reply, in order.
- Fulfil sends its event and message before its commit, because `PROCESSED` means they have gone out. Comms go last, after accounting, eBNC and risk, so the customer hears only once everything else has worked.

The changes that send a Raven message are assumed, for now, to be `SCHEDULED`, `DECLINED`, `CANCELLED`, `PROCESSED` and `RETURNED`.

## The twelve stages

| Stage | Moves | Varies by |
| --- | --- | --- |
| Capture | Input → `PENDING`, with the idempotency check | Nothing |
| Verify | `PENDING` → `ACCEPTED`, `SCHEDULED` or `DECLINED`; inbound → `DISALLOWED` | All four behaviors |
| Reverify | `SCHEDULED` → `ACCEPTED` or `DECLINED` | All four |
| Execute | `ACCEPTED` → `PROCESSING` | Account type, AR posting, realtime clearing |
| Fulfil | `PROCESSING` → `PROCESSED` | Account type |
| RequestAllocations | Allocation status → `ALLOCATING` | Nothing |
| ReceiveAllocations | Legs written; allocation status → `ALLOCATED` | Nothing |
| Cancel | `SCHEDULED` → `CANCELLED` | Account type, AR posting |
| Return | `PROCESSING`, `PROCESSED`, `PAID` or `REPRESENTED` → `RETURNED` | Account type |
| QueueRepresentment | `RETURNED` → `REPRESENTING`, with its date | All four |
| Represent | `REPRESENTING` → `REPRESENTED` or `DECLINED` | All four |
| Settle | `PROCESSED` → `PAID` for each payment or leg in a batch of up to 500 ready inbox rows | Nothing |

"All four" means account type, AR posting, realtime clearing and mandate authorization.

## Which workflow runs which stages

| Workflow | Stages, in order |
| --- | --- |
| Create Immediate Payment | Capture, Verify, Execute, Fulfil. A corporate parent has no Fulfil |
| Create Scheduled Payment | Capture, Verify |
| Execute Scheduled Payment | Reverify, Execute, Fulfil. A corporate parent has no Fulfil |
| Execute Split Payment | Execute, Fulfil |
| Request Allocations | RequestAllocations |
| Receive Allocations | ReceiveAllocations |
| Update Payment | Cancel, then the child runs Capture and Verify |
| Cancel Payment | Cancel |
| Process Returned Payment | Return, QueueRepresentment |
| Process Representment | Represent |
| Process Inbound Payment | Capture, Verify, Execute, Fulfil |
| Process Paid Events | Settle, once per batch |

Create Payment Intent and Create Balance Refund follow the payment path; their detailed stages are still being defined.

## Capture

Turns the request into a `PENDING` payment. `PaymentStore` inserts into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, all insert-if-absent. A duplicate means the request was seen before, and the caller gets the existing payment. On the Online cluster Capture gets a short deadline, so a caller facing an Oracle problem gets a quick error instead of a long wait.

## Verify

Decides whether a pending payment can go ahead. It calls Payment Instruments, to confirm the way the customer is paying, and Payment Options, to confirm the amount.

- A business failure, such as a closed account or insufficient funds, is not retried. The payment goes to `DECLINED`.
- A future-dated payment commits `SCHEDULED` together with its `SCHED_EXEC` Work Tracker row, plus an `ALLOC_REQUEST` row for a corporate payment.
- A corporate pay-today payment commits `ACCEPTED` together with its `ALLOC_REQUEST` row, and sets `legs_released_at` so its legs can run as soon as they arrive.
- An inbound payment Amex won't take commits `DISALLOWED`.

Verify varies by all four behaviors. A market that requires mandate authorization runs `MandateVerifyStage`, which verifies the mandate as part of the decision.

## Reverify

Checks a scheduled payment again on its due date, with the same calls as Verify, and commits `ACCEPTED` or `DECLINED`. Its guard, `WHERE status = 'SCHEDULED'`, means a cancel and the execution can never both win. For a corporate parent, the `ACCEPTED` commit sets `legs_released_at`, which tells the leg dispatcher to release the held legs.

## Execute

Moves the money and commits `PROCESSING`. Three calls go out in parallel, each on its own rate-limited queue: clearing (MR/M3), the AR balance (GAR) and open-to-buy (AMP).

- A corporate parent clears once, at payment level.
- A corporate leg updates the AR balance and open-to-buy only. It never clears.
- A consumer leg also clears.

## Fulfil

Tells everyone who needs to know, then commits `PROCESSED`. Accounting, eBNC and risk run in parallel. Then the RTF event and the Raven message go out, and only then does the commit happen. For a scheduled payment, the same commit marks its `SCHED_EXEC` row `DONE`. A corporate parent has no Fulfil: the leg dispatcher's completion check moves it to `PROCESSED` once every leg is done.

## RequestAllocations

Asks the allocations manager for a corporate payment's breakdown and sets the allocation status to `ALLOCATING`. Nothing waits for the answer; the allocations manager calls back.

## ReceiveAllocations

Checks one stored callback batch, then writes each allocation as a leg in `ACCEPTED`, in 1,000-row array inserts, each with its `ALLOC_LEG` Work Tracker row. The rows are `HELD` while the parent is not yet `ACCEPTED`, and `SCHEDULED` once it has been released. The allocation status turns `ALLOCATED` once the legs add up to the payment amount.

## Cancel

Moves a `SCHEDULED` payment to `CANCELLED` with one guarded update, inside the market's cancellation window only. The same commit cancels the payment's Work Tracker rows, so no dispatcher will ever start it. If the update changes nothing, the payment has already moved on.

## Return

Moves a payment the bank sent back to `RETURNED`, from `PROCESSING`, `PROCESSED`, `PAID`, or `REPRESENTED` when it is returned again. The return's details (when it took effect, why, where it came from and what it returned) travel with the payment from here on.

## QueueRepresentment

Commits `REPRESENTING` together with a `REPRESENT` Work Tracker row, due on the date the market's rules set. The return never starts the representment itself; the representment dispatcher does, when the date comes.

## Represent

Rechecks eligibility with Payment Instruments and Payment Options before anything goes to clearing, then sends the payment for clearing again and commits `REPRESENTED`. A failed recheck commits `DECLINED`.

## Settle

Moves the payments and legs of a batch of up to 500 `READY` inbox rows to `PAID`, in one `PaymentStore` transaction sent as JDBC batches. Each row is a guarded update from `PROCESSED` to `PAID`, setting `stlmt_ts` and `ar_pstd_ts`: on `trans_dtl` for a payment, or on `split_trans_dtl` for a leg. Wherever the update changes a row, a `PAID` timeline row tagged with the batch ID goes in with it. Settle then reads back every payment and leg carrying that batch ID, which is how a retried Settle knows exactly what it moved the first time.
