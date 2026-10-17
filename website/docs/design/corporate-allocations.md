---
title: Corporate Allocations
description: 'A corporate payment runs on two tracks. The parent clears once, at payment level, on its due date, while its allocations arrive by callback and post as legs.'
sidebar_label: Corporate Allocations
---

import Lead from '@site/src/components/Lead';
import CorporateTracks from '@site/src/components/CorporateTracks';

# Corporate Allocations

<Lead>A corporate payment runs on two tracks. The parent clears once, at payment level, on its due date, while its allocations arrive by callback and post as legs. Allocations never hold up the parent's clearing.</Lead>

A corporate payment is paid once, as one amount, and the allocations manager knows how that amount divides into allocations. The breakdown can arrive before the due date, on it, or after, and one payment can split into as many as 100,000 allocations. Holding the payment until every allocation is in would put the company's clearing date at the mercy of another system. So the parent clears on time regardless, and the allocations catch up on their own track.

<CorporateTracks />

## The parent's track

- The intake commit, `SCHEDULED` (or `ACCEPTED` for a pay-today payment), also writes an `ALLOC_REQUEST` Work Tracker row, due at the market's fetch time.
- Until that fetch, a scheduled corporate payment can be cancelled or updated inside the window like any other. Once its allocations are fetched, both get 409.
- On the due date the parent is accepted and clears once, at payment level. It doesn't wait for its allocations.
- A corporate parent has no Fulfil. The leg dispatcher's completion check moves it to `PROCESSED` once it has cleared, it is `ALLOCATED`, every batch has its legs, and every leg is `PROCESSED` or `PAID`, after sending the parent's RTF event and Raven message.
- The parent stays `PROCESSED` from then on. `PAID` is set on its legs, never on the parent.

Progress on the breakdown is tracked in a field of its own on the parent, the allocation status, rather than in the payment's state:

| `allocation_status` | Meaning |
| --- | --- |
| `NONE` | No allocations requested yet |
| `ALLOCATING` | Requested from the allocations manager; batches may be arriving |
| `ALLOCATED` | The batches received add up to the payment amount |

## Asking for the allocations

When to ask is a market setting, the fetch timing: at scheduling, a set lead time before the due date, or on the due date itself. A pay-today payment asks at once.

At the fetch time the allocation-request dispatcher starts `RequestAllocationsWorkflow`. It sets the allocation status to `ALLOCATING`, asks the allocations manager for the breakdown, and ends. No workflow sits waiting for the answer, which matters at 50,000 corporate payments a day.

The fetch is also the point of no return for the customer. From then on a cancel or an update gets 409, so a corporate payment fetched at scheduling can't be withdrawn at all, while one fetched on its due date stays open until the window closes. A cancel and the request can't both win: the cancel's guarded update requires allocation status `NONE`, and the request's requires a payment that isn't `CANCELLED`. It is the same race a cancel and Reverify run on the due date, settled the same way in Oracle.

## Receiving them

The allocations manager calls back through One-Data, once or several times, with batches numbered per payment. The function is `CreatePaymentAllocations.v1`, a placeholder name until the real one is known, and it calls `POST /payments/{payment-id}/allocations`.

1. The API stores the batch in `allocation_batch`, so a big batch never travels inside a workflow's input.
2. It starts `ReceiveAllocationsWorkflow` with only the payment ID and the batch number, and replies 202. A callback over its traffic budget gets 429 with `Retry-After`, and one that arrives while the Offline cluster is down gets 503. The allocations manager retries both.
3. The workflow checks the batch. If the parent is already `ACCEPTED`, or further on, it writes each allocation as a leg, `{paymentId}_{seq}`, in `ACCEPTED`, in 1,000-row array inserts, each leg with its own `ALLOC_LEG` Work Tracker row. If the parent is still `SCHEDULED`, the batch waits in `allocation_batch` and nothing is written yet.
4. Once the batches add up to the payment amount, the allocation status turns `ALLOCATED`, whether their legs are written yet or not.

Two assumptions sit under this, and both are open: the callback contract (batches numbered per payment, complete when they add up to the amount), and that allocations don't change once they have arrived. If they could change, a batch would need replacing before its legs are written.

## Writing the legs

No leg exists before its parent is accepted. A leg couldn't run before then anyway, and writing it later leaves nothing to hold back, and nothing to cancel if the parent never gets there. It is also what the [domain model](./domain-model.md) allows: a leg is made only from an `ACCEPTED` or `PROCESSING` payment, and a leg is never cancelled.

The commit that makes the parent `ACCEPTED` (Reverify on the due date, or Verify for pay today) sets its `legs_released_at`. The leg dispatcher sees that and writes the legs of every batch that has been waiting, 1,000 rows at a time, each leg with a `SCHEDULED` `ALLOC_LEG` row. A batch that arrives after the release is written by its own `ReceiveAllocationsWorkflow` straight away. Both writers check under a lock on the parent's row whether a batch already has its legs, so none is written twice.

A declined parent never gets legs: its batches stay stored and are never written. A cancelled parent has none either, because a payment can only be cancelled before its allocations are fetched.

## Running the legs

The leg dispatcher starts one `ExecuteSplitPaymentWorkflow` per leg, on the Offline cluster. A leg updates the AR balance and open-to-buy in parallel, then tells accounting, eBNC and risk, then sends its RTF event and Raven message, and commits `PROCESSED`. Clearing never runs per allocation; the parent already cleared the whole amount.

Legs run at priority 2 with the parent's payment ID as their fairness key, and a per-key limit caps how fast any one parent's legs can go. At 100 legs a second, a 100K payment takes about 17 minutes without starving any other payment on the same queues.

Each leg turns `PAID` on its own, through Settle, once the parent has settled and that leg's AR posting is in.

## When allocations are late, or a leg fails

- If allocations are late, the parent still clears on time, and there are simply no legs to run yet. The parent stays `PROCESSING` with allocation status `ALLOCATING`, and an alert fires at the market's alert point so someone can chase the source.
- A leg whose retries run out goes on the exception list, and its parent stays `PROCESSING` until operations resolve it.

## Volume

Billpay plans for up to 50K corporate payments and 500K allocations a day, with up to 100K allocations in one payment. One workflow per leg handles that comfortably, so there is no separate chunk mode for big payments. 500K legs a day average about 180 Temporal writes a second on the Offline cluster. A single 100K payment, at 100 legs a second, adds about 3,000 writes a second for those 17 minutes, which the governor budgets like any other class.

The [Payment State Model](./payment-state-model.md#corporate-payments) has the rules in brief, and the [journeys](./journeys/index.md#corporate-payments) show both corporate flows step by step.
