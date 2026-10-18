---
title: Stages
description: 'A stage is one business step, named for the journey step it performs. It makes its calls, commits the result in one guarded Oracle transaction, and returns its outcome.'
---

import Lead from '@site/src/components/Lead';

# Stages

<Lead>A stage is one business step, named for the journey step it performs: Verify, Execute, Settle. It makes its calls, in parallel where they don't depend on each other, commits the result in one guarded Oracle transaction, and returns its outcome.</Lead>

Stages are the only layer that changes between markets. Verify in a market that checks a mandate is a different implementation from Verify in one that doesn't, and the workflow never knows the difference: it looks its stages up from its plan key, and the most specific match wins. Thirteen stages cover every journey.

## What every stage does

Every stage follows the same three beats.

1. It calls its activities, in parallel where the calls don't depend on each other.
2. It commits in one guarded `PaymentStore` transaction: the new state, a timeline entry that names the cluster, and any Work Tracker rows the step creates or closes.
3. After the commit, the workflow calls the stage's announcement: an RTF lifecycle event for every state change, plus a Raven message where the customer is told. The workflow waits for it before the next stage, so each payment's events reach RTF in order.

Two stages bend that order, for good reasons:

- On the Online cluster, Capture and Verify commit back to back so the caller's answer isn't held up. Both announcements follow the reply, in order.
- Fulfil sends its event and message before its commit, because `PROCESSED` means they have gone out. Comms go last, after accounting, eBNC and risk, so the customer hears only once everything else has worked.

Which changes send a Raven message is a market setting. By default they are `SCHEDULED`, `DECLINED`, `CANCELLED`, `PROCESSED` and `RETURNED`. A market can change that default, and an account type can change its market's. Where both have a setting, the account type's wins. A change that is switched off sends no message, and Fulfil then waits for RTF alone.

## The thirteen stages

| Stage | Moves | Varies by |
| --- | --- | --- |
| Capture | Input → `PENDING`, with the idempotency check | Nothing |
| RequestConfirmation | `PENDING`, unchanged: gets the provider's redirect link for the caller, and stores the provider's reference on the payment with its `CONFIRM_EXPIRY` row | Nothing |
| Verify | `PENDING` → `ACCEPTED`, `SCHEDULED` or `DECLINED`; a push payment (inbound) → `ACCEPTED` or `DISALLOWED` | All four behaviors, and bank confirmation |
| Reverify | `SCHEDULED` → `ACCEPTED` or `DECLINED`; a corporate payment from `ALLOCATED` | All four |
| Execute | `ACCEPTED` → `PROCESSING`; a corporate payment paid today from `ALLOCATED`. A corporate parent only clears, once, and releases its legs, which make the AR and open-to-buy calls | Account type, AR posting, realtime clearing |
| Fulfil | `PROCESSING` → `PROCESSED` | Account type |
| RequestAllocations | `SCHEDULED`, or `ACCEPTED` for pay today, → `ALLOCATING` | Nothing |
| ReceiveAllocations | `ALLOCATING` → `ALLOCATED` once the batches add up, with the payment's `ALLOC_EXEC` row; earlier batches change no state | Nothing |
| Cancel | `SCHEDULED` → `CANCELLED`; `PENDING` → `CANCELLED` for a payment never confirmed at its bank | Account type, AR posting |
| Return | `PROCESSING`, `PROCESSED`, `PAID` or `REPRESENTED` → `RETURNED`, on the presentment that came back | Account type |
| QueueRepresentment | Writes the next presentment, a new row numbered one higher, in `REPRESENTING`, with the representment date as its clearing date; the returned row stays `RETURNED` | All four |
| Represent | `REPRESENTING` → `REPRESENTED` or `DECLINED` | All four |
| Settle | `PROCESSED` → `PAID` for each payment or leg in a batch of up to 500 ready inbox rows | Nothing |

"All four" means account type, AR posting, realtime clearing and mandate authorization. Bank confirmation is the fifth behavior: it decides whether RequestConfirmation runs, and which Verify implementation confirms the payment.

## Which workflow runs which stages

| Workflow | Stages, in order |
| --- | --- |
| Create Immediate Payment | Capture, Verify, Execute, Fulfil. A corporate payment stops after Verify; one that needs bank confirmation runs Capture and RequestConfirmation, then stops |
| Create Scheduled Payment | Capture, Verify |
| Execute Scheduled Payment | Reverify, Execute, Fulfil. A corporate parent has no Fulfil, and one paid today skips Reverify |
| Execute Split Payment | Execute, Fulfil |
| Request Allocations | RequestAllocations |
| Receive Allocations | ReceiveAllocations |
| Update Payment | Cancel, then the child runs Capture and Verify |
| Cancel Payment | Cancel, from a caller or when a confirmation window closes |
| Confirm Payment | Verify, Execute, Fulfil |
| Process Returned Payment | Return, QueueRepresentment |
| Process Representment | Represent |
| Process Inbound Payment | Capture, Verify, Execute, Fulfil |
| Process Paid Events | Settle, once per batch |

Create Balance Refund follows the payment path; its detailed stages are still being defined.

## Capture

Turns the request into a `PENDING` payment. `PaymentStore` inserts into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, all insert-if-absent. A duplicate means the request was seen before, and the caller gets the existing payment. On the Online cluster Capture gets a short deadline, so a caller facing an Oracle problem gets a quick error instead of a long wait.

## RequestConfirmation

Runs after Capture, in place of Verify, when a payment needs the customer to confirm their bank details (`requiresBankConfirmation` resolves to Y). It asks the market's provider, such as Plaid in the US or Pay with Bank Transfer in the UK, for the customer's redirect link. One commit guarded on `PENDING` stores the provider's reference and writes the payment's `CONFIRM_EXPIRY` row, due when the market's confirmation window closes. The payment stays `PENDING`, and the caller's update returns with the link. The provider only checks the customer's bank details. It never moves money: Billpay does that in Execute, once the customer has confirmed.

## Verify

Decides whether a pending payment can go ahead. It calls Payment Instruments, to confirm the way the customer is paying, and Payment Options, to confirm the amount.

- A business failure, such as a closed account or insufficient funds, is not retried. The payment goes to `DECLINED`.
- A future-dated payment commits `SCHEDULED` together with its `SCHED_EXEC` Work Tracker row. A corporate payment gets an `ALLOC_REQUEST` row instead, due at the market's fetch time.
- A corporate payment made today commits `ACCEPTED` together with an `ALLOC_REQUEST` row due at once, and its workflow ends there.
- A push payment (inbound, sent by a third party) that Amex won't take commits `DISALLOWED`. No other kind of payment can end there.
- A payment that waited for bank confirmation is verified in Confirm Payment, guarded on `PENDING`, and the same commit cancels its `CONFIRM_EXPIRY` row. The provider has already verified the customer's bank details, so Verify checks the verification token Payment Instruments holds for the instrument, to guard against fraud. A payment without a valid token is `DECLINED`.

Verify varies by all four behaviors and by bank confirmation. A market that requires mandate authorization runs `MandateVerifyStage`, which verifies the mandate as part of the decision.

## Reverify

Checks a scheduled payment again on its due date, with the same calls as Verify, and commits `ACCEPTED` or `DECLINED`. Its guard, `WHERE status = 'SCHEDULED'`, means a cancel and the execution can never both win. A scheduled corporate payment is reverified from `ALLOCATED`, once its allocations are in. One paid today skips Reverify, because Verify passed it minutes earlier.

## Execute

Moves the money and commits `PROCESSING`. Three calls go out in parallel, each on its own rate-limited queue: clearing (MR/M3), the AR balance (GAR) and open-to-buy (AMP).

- A corporate parent clears once, at payment level, and makes no AR or open-to-buy call. The same commit sets `legs_released_at`, which tells the leg dispatcher to write and start its legs, and each leg makes those two calls.
- A corporate leg updates the AR balance and open-to-buy only. It never clears.
- A consumer leg also clears.

## Fulfil

Tells everyone who needs to know, then commits `PROCESSED`. Accounting, eBNC and risk run in parallel. Then the RTF event and the Raven message go out, and only then does the commit happen. For a scheduled payment, the same commit marks its `SCHED_EXEC` row `DONE`. A corporate parent has no Fulfil: Execute's commit marks its `ALLOC_EXEC` row `DONE`, and the leg dispatcher's completion check moves it to `PROCESSED` once every leg is done.

## RequestAllocations

Moves a corporate payment to `ALLOCATING` with a guarded update, from `SCHEDULED` or, for pay today, `ACCEPTED`, then asks the allocations manager for the breakdown. Nothing waits for the answer; the allocations manager calls back. A cancel is guarded on `SCHEDULED` too, so the request and a cancel never both win, and from this commit on a cancel or an update gets 409.

## ReceiveAllocations

Checks one stored callback batch and writes no legs: every batch waits in `allocation_batch` until the parent's Execute releases them. Once the batches add up to the payment amount, one guarded commit moves the payment to `ALLOCATED` and writes its `ALLOC_EXEC` row, due at once for pay today, or at the execution time on the due date for a scheduled payment (at once, if that time has passed). Earlier batches change no state.

## Cancel

Moves a `SCHEDULED` payment to `CANCELLED` with one guarded update, inside the market's cancellation window only. A corporate payment leaves `SCHEDULED` once its allocations are requested, so from `ALLOCATING` on there is nothing to cancel. The same commit cancels the payment's Work Tracker rows, so no dispatcher will ever start it. If the update changes nothing, the payment has already moved on.

Cancel also ends a payment the customer never confirmed at their bank. When its `CONFIRM_EXPIRY` row falls due, the confirmation-expiry dispatcher starts Cancel Payment on the Offline cluster, and Cancel moves the payment from `PENDING` to `CANCELLED`, guarded on `PENDING`, so a confirm that got there first wins.

## Return

Moves the [presentment](../payment-state-model.md#presentments) the bank sent back to `RETURNED`, from `PROCESSING`, `PROCESSED`, `PAID`, or `REPRESENTED` when a later presentment is returned. The return's details (when it took effect, why, where it came from and what it returned) go on that presentment's row, which stays `RETURNED`. A payment returned twice keeps both returns' details, one on each presentment.

## QueueRepresentment

Writes the next presentment as a new row, with the same payment ID and a `presentmentSequence` one higher, in `REPRESENTING`. Its clearing date is the representment date, which the market's rules set. The same commit writes its `REPRESENT` Work Tracker row, due on that date. The return never starts the representment itself; the representment dispatcher does, when the date comes.

## Represent

Rechecks eligibility with Payment Instruments and Payment Options before anything goes to clearing, then sends the new presentment for clearing and commits `REPRESENTED`. A failed recheck commits `DECLINED`, and nothing is sent.

## Settle

Moves the payments and legs of a batch of up to 500 `READY` inbox rows to `PAID`, in one `PaymentStore` transaction sent as JDBC batches. Each row is a guarded update from `PROCESSED` to `PAID`, setting `stlmt_ts` and `ar_pstd_ts`: on `trans_dtl` for a payment, or on `split_trans_dtl` for a leg. Wherever the update changes a row, a `PAID` timeline row tagged with the batch ID goes in with it. Settle then reads back every payment and leg carrying that batch ID, which is how a retried Settle knows exactly what it moved the first time.
