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

Verify's commit writes an `ALLOC_REQUEST` Work Tracker row beside the payment's new state, and the intake workflow ends there. It starts nothing itself. For pay today the row is due at once. For a scheduled payment it falls due at the market's fetch time, which an operator sets per market.

When the row falls due, the allocation-request dispatcher starts `RequestAllocationsWorkflow`. It moves the payment to `ALLOCATING` with a guarded update, asks the allocations manager for the breakdown, and ends. No workflow sits waiting for the answer, which matters at 50,000 corporate payments a day.

The request is also the point of no return for the customer. A scheduled payment can be cancelled or updated inside the window while it is `SCHEDULED`. Once it is `ALLOCATING` it isn't, so both get 409. A cancel and the request can't both win, because both are guarded updates on `SCHEDULED`: it is the same race a cancel and Reverify run on the due date, settled the same way in Oracle.

## Receiving them

The allocations manager calls back through One-Data, once or several times, with batches numbered per payment. The function is `CreatePaymentAllocations.v1`, and it calls `POST /payments/{payment-id}/allocations`.

1. The API stores the batch in `allocation_batch`, so a big batch never travels inside a workflow's input.
2. It starts `ReceiveAllocationsWorkflow` with only the payment ID and the batch number, and replies 202. A callback over its traffic budget gets 429 with `Retry-After`, and one that arrives while the Offline cluster is down gets 503. The allocations manager retries both.
3. The workflow checks the batch. It writes no legs: every batch waits in `allocation_batch` until the payment executes.
4. The batch that completes the amount moves the payment to `ALLOCATED`, in one guarded commit that also writes its `ALLOC_EXEC` row. That row is due at once for pay today, or at the execution time on the due date for a scheduled payment.

Two rules sit under this, and both are agreed: the callback contract (batches numbered per payment, complete when they add up to the amount), and that allocations never change once they have arrived. So a batch never needs replacing before its legs are written.

## Executing the payment

The allocated-payments dispatcher runs every minute. When an `ALLOC_EXEC` row falls due, it starts `ExecuteScheduledPaymentWorkflow` through the Router, for a payment made today as much as for a scheduled one.

- A scheduled payment is checked again first: Reverify moves it from `ALLOCATED` to `ACCEPTED`, or to `DECLINED`. A payment made today skips Reverify, because Verify passed it minutes earlier.
- Execute clears the parent once, at payment level, and commits `PROCESSING`. That is its only call: the legs update the AR balance and open-to-buy, and clearing never runs per allocation.
- The same commit marks the parent's legs released. A corporate parent has no Fulfil.

## Writing and running the legs

Once a parent is released, the leg dispatcher writes the legs of every stored batch, 1,000 rows at a time. Each leg is a payment of its own, `{paymentId}_{seq}`, with its allocation's card account, written in `ACCEPTED` with a `SCHEDULED` `ALLOC_LEG` row, and each batch records when its legs were written, so none is written twice. A declined parent is never released, so its batches are never written, and a cancelled one never got as far as asking.

The leg dispatcher then starts one `ExecuteSplitPaymentWorkflow` per leg on the Offline cluster, apart from the parent's clearing. A leg updates the AR balance and open-to-buy in parallel, then tells accounting, eBNC, risk, the Transaction Notification Engine (TFNE) and the legacy Payments History Database (GPHDB), then sends its RTF event and Raven message, and commits `PROCESSED`.

Legs run at priority 2 with the parent's payment ID as their fairness key, and a per-key limit caps how fast any one parent's legs can go. At 100 legs a second, a 100K payment takes about 17 minutes without starving any other payment on the same queues.

Every 60 seconds the leg dispatcher counts each parent's legs. Once every batch has its legs and every leg is `PROCESSED` or `PAID`, it sends the parent's RTF event and Raven message and moves the parent to `PROCESSED`. The parent stays there: each leg turns `PAID` on its own, through Settle, once the parent has settled and that leg's AR posting is in.

## When allocations are late, or a leg fails

- If allocations are late, the payment waits in `ALLOCATING`. Nothing clears and no leg runs until the last batch arrives, and an alert fires at the market's alert point so someone can chase the source. A scheduled payment whose batches complete after its execution time executes at once.
- A leg whose retries run out goes on the exception list, and its parent stays `PROCESSING` until operations resolve it.

## Volume

Billpay plans for up to 50K corporate payments and 500K allocations a day, with up to 100K allocations in one payment. One workflow per leg handles that comfortably, so there is no separate chunk mode for big payments. 500K legs a day average about 200 Temporal writes a second on the Offline cluster. A single 100K payment, at 100 legs a second, adds about 3,400 writes a second for those 17 minutes, which the governor budgets like any other class.

The [Payment State Model](./payment-state-model.md#corporate-payments) has the rules in brief, and the [journeys](./journeys/index.md#corporate-payments) show both corporate flows step by step.
