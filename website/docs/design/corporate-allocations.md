---
title: Corporate Allocations
description: 'A corporate payment fetches its allocations before it moves money.'
sidebar_label: Corporate Allocations
---

import Lead from '@site/src/components/Lead';
import CorporateTracks from '@site/src/components/CorporateTracks';

# Corporate Allocations

<Lead>A corporate payment fetches its allocations before it moves money. No workflow waits for them: each step is a row in Oracle that a dispatcher picks up, and a payment made today and a scheduled one take the same path once they are `ALLOCATED`.</Lead>

A corporate payment is paid once, as one amount, and the allocations manager knows how that amount divides into allocations, up to 100,000 of them in one payment. Billpay asks for that breakdown before the money moves, and the payment's own state records how far it has got: `ALLOCATING` while the batches come in, `ALLOCATED` once they add up. A corporate payment always comes from a channel, through `CreatePayment.v3`. Accounts Receivable never raises one.

<CorporateTracks />

## Two ways in, one path

The two kinds differ only until the payment is `ALLOCATED`:

| | Pay today | Scheduled |
| --- | --- | --- |
| Verify commits | `ACCEPTED` | `SCHEDULED` |
| Allocations requested | At once | At the market's fetch time: on the due date, or a set number of hours or days before it |
| Executed | At once, once `ALLOCATED` | At the execution time on the due date, once `ALLOCATED`, after Reverify |

From `ALLOCATED` on, both run the same workflows from the same kinds of row, so there is one corporate execution path to build and test, not two.

## Asking for the allocations

Verify's commit writes an `ALLOC_REQUEST` Work Tracker row beside the payment's new state, and the intake workflow ends there. It starts nothing itself. For pay today the row is due at once. For a scheduled payment it falls due at the market's fetch time, which the release sets as `allocationFetchBefore`: an ISO duration before the execution time on the due date, `PT0S` by default (at the execution time), `P1D` for a day before or `PT6H` for six hours before (agreed 2026-11-08).

When the row falls due, the allocation-request dispatcher starts `RequestAllocationsWorkflow`. It moves the payment to `ALLOCATING` with a guarded update, asks the allocations manager for the breakdown, and ends. No workflow sits waiting for the answer, which matters at 50,000 corporate payments a day. The manager's request API isn't in the sources yet, so the call uses placeholders: the payment ID, account, market, amount and currency, with the idempotency key `{paymentId}-allocations` (agreed 2026-11-08).

The request is also the point of no return for the customer. A scheduled payment can be cancelled or updated inside the window while it is `SCHEDULED`. Once it is `ALLOCATING` it isn't, so both get 409. A cancel and the request can't both win, because both are guarded updates on `SCHEDULED`: it is the same race a cancel and Reverify run on the due date, settled the same way in Oracle.

## Receiving them

The allocations manager calls back through One-Data, once or several times, with batches numbered per payment. The function is `CreatePaymentAllocations.v1`, and it calls `POST /payments/{payment-id}/allocations`. Its body is placeholders for now: a batch number and, per allocation, its card account, country, account details and amount (agreed 2026-11-08).

1. The API stores the batch in `allocation_batch`, so a big batch never travels inside a workflow's input. It keeps the batch as a JSON array of `{accountId, accountCountry, accountDetail, amount}`, with the sum of its amounts beside it (Proposed, 2026-11-08).
2. It starts `ReceiveAllocationsWorkflow` with only the payment ID and the batch number, and replies 202. A callback over its traffic budget gets 429 with `Retry-After`, and one that arrives while the Offline cluster is down gets 503 with `Retry-After: 30`, the batch already stored (Proposed, 2026-11-08). The allocations manager retries both. A body that can't be read gets 400 (Proposed, 2026-11-08).
3. The workflow checks the batch, under the lock on the parent's row (Proposed, 2026-11-08). It writes no legs: every batch waits in `allocation_batch` until the payment executes. One ReceiveAllocations stage applies everywhere, since it varies by nothing (Proposed, 2026-11-08).
4. The batch that completes the amount moves the payment to `ALLOCATED`, in one guarded commit that also writes its `ALLOC_EXEC` row. That row is due at once for pay today, or at the execution time on the due date for a scheduled payment. Proposed (2026-11-08): the batches must add up to the amount exactly, and `ALLOCATED` goes to RTF only.

Every batch gets one of five outcomes (Proposed, 2026-11-08):

| Outcome | When | What happens |
| --- | --- | --- |
| `ALLOCATED` | The stored batches add up exactly to the amount | The payment moves to `ALLOCATED` |
| `WAITING` | They are still short | Nothing changes |
| `OVER_ALLOCATED` | They add up to more than the amount | Nothing changes; logged as an error |
| `ALREADY_ALLOCATED` | A repeat, or a retry after its own commit | `ALLOCATED` is announced again under the same key |
| `NOT_ALLOCATING` | The payment left `ALLOCATING` without this batch | Nothing changes; logged as an error |

An `OVER_ALLOCATED` or `NOT_ALLOCATING` batch also bumps `billpay_allocation_batch_rejected_total`, labelled with the reason (agreed 2026-11-08; the name is Proposed).

Two rules sit under this, and both are agreed: the callback contract (batches numbered per payment, complete when they add up to the amount), and that allocations never change once they have arrived. So a batch never needs replacing before its legs are written.

## Executing the payment

The allocated-payments dispatcher runs every minute. When an `ALLOC_EXEC` row falls due, it starts `ExecuteScheduledPaymentWorkflow` through the Router, for a payment made today as much as for a scheduled one.

- A scheduled payment is checked again first: Reverify moves it from `ALLOCATED` to `ACCEPTED`, or to `DECLINED`. A payment made today skips Reverify, because Verify passed it minutes earlier.
- Execute clears the parent once, at payment level, and commits `PROCESSING`. That is its only call: the legs update the AR balance and open-to-buy, and clearing never runs per allocation.
- The same commit sets the parent's `LEGS_RELEASED_AT`, closes its `ALLOC_EXEC` row and marks it a split payment. A corporate parent has no Fulfil.
- A corporate payment counts as scheduled when its payment date is after its submit date. That decides whether Reverify runs and which status Execute moves it from (Proposed, 2026-11-08).
- The parent and its legs share one Execute stage, `PaymentExecuteStageWithCorporateAccount`: the parent only clears, and a leg makes the AR call where AR posting is Y and the open-to-buy call, and never clears. Reverify's corporate stage is `PaymentReverifyStageWithCorporateAccount` (Proposed, 2026-11-08).

## Writing and running the legs

Once a parent is released, the leg dispatcher writes the legs of every stored batch, 1,000 rows at a time. Each leg is a payment of its own, `{paymentId}_{seq}`, with its allocation's card account, written in `ACCEPTED` with a `SCHEDULED` `ALLOC_LEG` row, and each batch records when its legs were written, so none is written twice. Proposed (2026-11-08): the legs are numbered across batches, in batch order, up to 100 parents a pass; a leg's request is its parent's with the leg's ID, amount and card account, and the instrument stays the parent's, so the open-to-buy call reads the same clear-text data; a batch that would take the legs past the payment amount was never counted toward `ALLOCATED`, so it is left unwritten and logged. A declined parent is never released, so its batches are never written, and a cancelled one never got as far as asking.

The leg dispatcher then starts one `ExecuteSplitPaymentWorkflow` per leg on the Offline cluster, apart from the parent's clearing. Each leg runs four steps:

1. Updates the AR balance and open-to-buy in parallel (open-to-buy once Payment Instruments has returned the instrument's clear-text details).
2. Tells accounting, eBNC, risk, the Transaction Notification Engine (TFNE), the legacy Payments History Database (GPHDB) and B2Notifier.
3. Sends its RTF event and Raven message.
4. Commits `PROCESSED`.

Legs run at priority 2 with the parent's payment ID as their fairness key, and a per-key limit caps how fast any one parent's legs can go. At 100 legs a second, a 100K payment takes about 17 minutes without starving any other payment on the same queues. The fairness key only shares the queue between legs that have started, so the claim is fair as well: each leg's Work Tracker row carries its parent's ID as its group key, and the leg dispatcher takes rows from each parent in turn. A small payment's legs never wait behind all of a large one's (agreed 2026-11-08).

Every 60 seconds the leg dispatcher counts each parent's legs. Once every batch has its legs and every leg is `PROCESSED` or `PAID`, it sends the parent's RTF event and Raven message and moves the parent to `PROCESSED`. Proposed (2026-11-08): the dispatcher's workflow sends them through their own activities, as `{paymentId}-PROCESSED-rtf` and `-raven`, then commits; it releases before each claim, and runs this check when its run starts, every 60 seconds and before it ends, up to 1,000 parents a pass. The parent stays there: each leg turns `PAID` on its own, through Settle, once the parent has settled and that leg's AR posting is in.

## When allocations are late, or a leg fails

- If allocations are late, the payment waits in `ALLOCATING`. Nothing clears and no leg runs until the last batch arrives, and an alert fires at the market's alert point so someone can chase the source. The release sets that point as `allocationAlertAfter`, an ISO duration counted from when the payment turned `ALLOCATING`; a release without it raises no late alert. On each run, the allocation-request dispatcher bumps `billpay_allocations_late_total` for each payment still `ALLOCATING` past it, and logs their IDs (agreed 2026-11-08). A scheduled payment whose batches complete after its execution time executes at once.
- A leg whose retries run out goes on the exception list, and its parent stays `PROCESSING` until operations resolve it.

## Volume

Billpay plans for up to 50K corporate payments and 500K allocations a day, with up to 100K allocations in one payment. One workflow per leg handles that comfortably, so there is no separate chunk mode for big payments. 500K legs a day average about 230 Temporal writes a second on the Offline cluster. A single 100K payment, at 100 legs a second, adds about 4,000 writes a second for those 17 minutes, which the governor budgets like any other class.

The [Payment State Model](./payment-state-model.md#corporate-payments) has the rules in brief, and the [journeys](./journeys/all-journeys.md#corporate-payments) show both corporate flows step by step.
