---
title: One-Data Functions
description: 'One-Data is the API gateway in front of Billpay, and it runs more than functions.'
---

import Lead from '@site/src/components/Lead';

# One-Data Functions (API Gateway)

<Lead>One-Data is the API gateway in front of Billpay, and it runs more than functions. It also keeps the Redis store behind the pending check, and the inbox: the Postgres database where work nobody waits for lands until Billpay pulls it.</Lead>

## What it hosts

- The functions channels and other platforms call, each a versioned contract. Most front one billpay-online API. [Build → One-Data Functions](../../build/api-spec/one-data.md) lists every one.
- The event handlers for money movement, Accounts Receivable (AR) and authorization events. The first two store what arrives, and the authorization handler only acknowledges its events. None of them starts a workflow.
- The inbox's two tables, which billpay-offline reads and updates itself over JDBC. One-Data runs no inbox function for Billpay any more (agreed 2026-11-24).
- The hourly sweep of pending entries, which One-Data also runs on its own schedule. It removes entries older than their market's sweep age, 2 hours unless the market sets it, whose payments billpay-online has decided, or never got ([Stored creates and the pending check](../../build/api-spec/one-data.md#stored-creates-and-the-pending-check)).
- A Redis store in each site, IPC1 and IPC2, run as one active-active database. It holds every create as Pending and each card account's pending payments, so One-Data can hold a create while billpay-online is slow ([High Availability](../../architecture/high-availability.md#gateway)).

One-Data runs active in both sites, so losing a site doesn't close the front door.

## The inbox

Bulk intake from AR, returns, inbound payments, settlements and AR postings don't reach billpay-online when they arrive. One-Data stores them, and billpay-offline reads them at the governor's pace. Oracle holds no inbox.

The inbox is one Postgres database with one primary, replicated across IPC1 and IPC2. Both sites' handlers write to that primary, so every event for a payment lands in the same database. It has three tables:

| Table | One row per | Holds |
| --- | --- | --- |
| `billpay_extnl_event` | Event, as received | The raw event, its source, type and idempotency ID: the log to audit or replay from |
| `billpay_start_rqst` | Request to start, by its idempotency key, `rqst_id` | `rqst_type` (AR payment, AR refund, return or inbound), `rqst_body`, `sta_cd`, `creat_ts`, `lst_updt_ts` |
| `billpay_paid_ready` | Payment or leg, and presentment (`pymt_id`, `prsnt_seq_no`) | `prnt_pymt_id` (the ID before any `_`), `acct_id`, `stlmt_ts`, `ar_pstd_ts`, `sta_cd`, `creat_ts`, `lst_updt_ts` |

billpay-offline reads and updates `billpay_paid_ready` and `billpay_start_rqst` itself, with plain JDBC through its own pool of 8 connections. It reads new rows at fixed intervals: no One-Data function sits in between, and One-Data sends no push (agreed 2026-11-24). Its database user may read both tables and update only `sta_cd` and `lst_updt_ts`, and the two tables become a contract between the teams. One-Data still has to agree to both.

### Start requests

A start request is `READY` as soon as it is stored, and its dispatcher marks it `DONE` once the workflow has started. A request with the same idempotency key is stored once and answered 202 again. A request the Router can't admit, because nothing live matches its market, account type or API, is marked `REJECTED` and raises an alert for operations. It stays `REJECTED`, and the sender is not told ([A rejected request](../../operations/sops.md#a-rejected-request)).

### Rows for PAID

One-Data only stores; Billpay decides `PAID` (agreed 2026-11-24). A handler fills the event's timestamp on the payment's, or leg's, row and marks it `READY`, which now means an event came in for Billpay to look at. Billpay's PAID drain reads the `READY` rows and pairs the events:

- The posting and a settlement make a payment or leg paid. A corporate leg reads its payment's settlement from the payment's own row, because a corporate payment settles once, as a whole, while each leg posts on its own. A consumer split's legs clear on their own, so each settles on its own (agreed 2026-11-07).
- The posting alone is enough where the settlement is known: a debit card, MR Points or inbound payment, and its legs. Their money moved at the card authorization, the points redemption or the third party's push, so no settlement comes from MR/M3 and Billpay sends no settlement event of its own. The payment's settlement time is when it turned `PROCESSING`.
- A Pay with Bank Transfer payment's settlement is M3's notice, which M3 sends to `CreateBillpaySettlementEvent.v1`. One-Data stores it as the payment's settlement, and the payment is paid once GAR's posting is in too.
- Every other payment needs MR/M3's settlement and the posting, even where `requiresArPosting` is N.

| `sta_cd` | Meaning |
| --- | --- |
| `READY` | An event came in, for Billpay to look at |
| `WAITING` | Billpay read it and found an event still missing. The next event makes it `READY` again |
| `DONE` | Billpay has applied it; or, for a corporate payment's own row, Billpay has read it |
| `UNMATCHED` | Payable, but with no `PROCESSED` payment or leg: none, or not `PROCESSED` yet. Billpay tries it again an hour later, for up to 48 hours, and after that its gauge, `billpay_paid_unmatched_stale`, raises an alert |

### How a handler writes an event

Each event is one transaction with its raw event: one upsert that fills the event's timestamp only where it is still empty, and marks the row `READY`. There is no lock per payment and no pairing across rows any more.

```sql
insert into bpyevnts.billpay_paid_ready as p
  (pymt_id, prsnt_seq_no, prnt_pymt_id, acct_id, stlmt_ts, ar_pstd_ts, sta_cd)
values
  (:pymt_id, :prsnt_seq_no, :prnt_pymt_id, :acct_id, :stlmt_ts, :ar_pstd_ts, 'READY')   -- one of the two is null
on conflict (pymt_id, prsnt_seq_no) do update set
  stlmt_ts    = coalesce(p.stlmt_ts, excluded.stlmt_ts),
  ar_pstd_ts  = coalesce(p.ar_pstd_ts, excluded.ar_pstd_ts),
  sta_cd      = 'READY',
  lst_updt_ts = now()
where (p.stlmt_ts is null and excluded.stlmt_ts is not null)
   or (p.ar_pstd_ts is null and excluded.ar_pstd_ts is not null);
```

Why it is safe when events arrive together, or twice:

- When both events for one row arrive at once, Postgres makes the second upsert wait for the first one's row, so both timestamps land.
- The `where` clause skips an event the row already has. A repeat changes nothing, not even `lst_updt_ts`, so a `READY` row keeps its place in the fetch order and an `UNMATCHED` row keeps its retry time.
- Billpay's updates are guarded on `READY` and on the timestamps it read, so an event that arrives while Billpay holds a row leaves it `READY` for the next batch.
- `billpay_extnl_event` needs no unique index on the idempotency ID: a repeated event leaves the inbox row as it was, and Settle skips a payment that is already `PAID`.

An event that carries no payment ID is matched through `ReadPayments.v1`, by its account ID. If that finds no single payment, the raw event stays in `billpay_extnl_event` and an alert names it.

### Indexes and purge

- Partial indexes keep every read small: `READY` rows by `lst_updt_ts` for the fetch, `UNMATCHED` rows by `lst_updt_ts` for the hourly retry, `WAITING` rows by `creat_ts` for the 48-hour view, `WAITING` legs that have posted by `prnt_pymt_id`, which Billpay wakes once their payment's settlement is in, and `READY` start requests by type and `creat_ts` for the dispatchers.
- One-Data deletes `DONE` rows and requests 30 days after their last update, and drops `billpay_extnl_event` partitions on the same schedule.
