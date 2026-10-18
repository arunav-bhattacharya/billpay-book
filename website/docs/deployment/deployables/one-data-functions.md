---
title: One-Data Functions
description: 'One-Data is the API gateway in front of Billpay, and it runs more than functions.'
---

import Lead from '@site/src/components/Lead';

# One-Data Functions (API Gateway)

<Lead>One-Data is the API gateway in front of Billpay, and it runs more than functions. It also keeps the Redis store behind the pending check, and the inbox: the Postgres database where work nobody waits for lands until Billpay pulls it.</Lead>

## What it hosts

- The functions channels and other platforms call, each a versioned contract. Most front one billpay-core API. [Build → One-Data Functions](../../build/api-spec/one-data.md) lists every one.
- The event handlers for money movement, Accounts Receivable (AR) and authorization events. They store what arrives and never start a workflow.
- The inbox functions Billpay calls to read and update the inbox, and `UpdateUnmatchedPayments.v1`, which One-Data runs on its own schedule.
- A Redis store in each site, IPC1 and IPC2, run as one active-active database. It holds every create as Pending and each card account's pending payments, so One-Data can hold a create while billpay-core is slow ([High Availability](../../architecture/high-availability.md#front-door)).

One-Data runs active in both sites, so losing a site doesn't close the front door.

## The inbox

Bulk intake from AR, returns, inbound payments, settlements and AR postings don't reach billpay-core when they arrive. One-Data stores them, and Billpay's dispatchers pull them at the governor's pace. Oracle holds no inbox.

The inbox is one Postgres database with one primary, replicated across IPC1 and IPC2. Both sites' handlers write to that primary, so every event for a payment lands in the same database. It has three tables:

| Table | One row per | Holds |
| --- | --- | --- |
| `billpay_extnl_event` | Event, as received | The raw event, its source, type and idempotency ID: the log to audit or replay from |
| `billpay_start_rqst` | Request to start, by its idempotency key, `rqst_id` | `rqst_type` (AR payment, AR refund, return or inbound), `rqst_body`, `sta_cd`, `creat_ts`, `lst_updt_ts` |
| `billpay_paid_ready` | Payment or leg, and presentment (`pymt_id`, `prsnt_seq_no`) | `prnt_pymt_id` (the ID before any `_`), `acct_id`, `stlmt_ts`, `ar_pstd_ts`, `sta_cd`, `creat_ts`, `lst_updt_ts` |

Billpay never reads these tables directly. It sees only rows that are ready, through the inbox functions.

### Start requests

A start request is `READY` as soon as it is stored, and its dispatcher marks it `DONE` once the workflow has started. A request with the same idempotency key is stored once and answered 202 again. A request the Router can't admit, because nothing live matches its market, account type or API, is marked `REJECTED` and raises an alert for operations. The sender is not told.

### Rows for PAID

A payment turns `PAID` once both the bank's settlement and AR's posting are in. Every payment gets both, even where `requiresArPosting` is N. A split payment settles once, as a whole, while each leg posts on its own, so a leg takes its payment's settlement: the split payment's own row holds only the settlement, and each leg's row pairs its posting with it.

| `sta_cd` | Meaning |
| --- | --- |
| `WAITING` | The payment or leg is still missing an event |
| `READY` | Its posting and its settlement are in, and it waits for Billpay |
| `DONE` | Billpay has applied it; or, for a split payment's own row, a leg has taken its settlement |
| `UNMATCHED` | Billpay found nothing ready for it: no payment or leg, or one not yet `PROCESSED`. It is tried again an hour later, for up to 48 hours, and after that `UpdateUnmatchedPayments.v1` raises an alert |

### How a handler writes an event

Each event is one transaction. It takes a lock on the payment's ID, upserts the row, setting the event's timestamp only where it is still empty, then pairs across rows: a leg's posting with its payment's settlement, or a payment's settlement with every leg that has already posted.

```sql
-- the payment's lock: shared for a posting, exclusive for a settlement
select pg_advisory_xact_lock_shared(hashtext(:prnt_pymt_id));   -- a posting
select pg_advisory_xact_lock(hashtext(:prnt_pymt_id));          -- a settlement

insert into bpyevnts.billpay_paid_ready as p
  (pymt_id, prsnt_seq_no, prnt_pymt_id, acct_id, stlmt_ts, ar_pstd_ts, sta_cd)
values
  (:pymt_id, :prsnt_seq_no, :prnt_pymt_id, :acct_id, :stlmt_ts, :ar_pstd_ts, 'WAITING')   -- one of the two is null
on conflict (pymt_id, prsnt_seq_no) do update set
  stlmt_ts    = coalesce(p.stlmt_ts, excluded.stlmt_ts),
  ar_pstd_ts  = coalesce(p.ar_pstd_ts, excluded.ar_pstd_ts),
  sta_cd      = case when p.sta_cd = 'WAITING'
                      and coalesce(p.stlmt_ts, excluded.stlmt_ts) is not null
                      and coalesce(p.ar_pstd_ts, excluded.ar_pstd_ts) is not null
                     then 'READY' else p.sta_cd end,
  lst_updt_ts = now()
where (p.stlmt_ts is null and excluded.stlmt_ts is not null)
   or (p.ar_pstd_ts is null and excluded.ar_pstd_ts is not null);
```

<details>
<summary>The pairing statements that follow the upsert</summary>

```sql
-- a leg's posting: take its payment's settlement, if it is in
update bpyevnts.billpay_paid_ready l
   set stlmt_ts = p.stlmt_ts, sta_cd = 'READY', lst_updt_ts = now()
  from bpyevnts.billpay_paid_ready p
 where l.pymt_id = :pymt_id and l.prsnt_seq_no = :prsnt_seq_no
   and l.pymt_id <> l.prnt_pymt_id
   and l.sta_cd = 'WAITING' and l.ar_pstd_ts is not null and l.stlmt_ts is null
   and p.pymt_id = l.prnt_pymt_id and p.prsnt_seq_no = l.prsnt_seq_no
   and p.stlmt_ts is not null;

-- a payment's settlement (an ID without "_"): hand it to every leg that has posted
update bpyevnts.billpay_paid_ready
   set stlmt_ts = :stlmt_ts, sta_cd = 'READY', lst_updt_ts = now()
 where prnt_pymt_id = :pymt_id and pymt_id <> prnt_pymt_id
   and prsnt_seq_no = :prsnt_seq_no
   and sta_cd = 'WAITING' and ar_pstd_ts is not null and stlmt_ts is null;

-- run only when a pairing above moved a leg: the payment's own row is done
update bpyevnts.billpay_paid_ready
   set sta_cd = 'DONE', lst_updt_ts = now()
 where pymt_id = :prnt_pymt_id and prsnt_seq_no = :prsnt_seq_no;
```

</details>

Why it is safe when events arrive together, or twice:

- When both events for one row arrive at once, Postgres makes the second upsert wait for the first one's row, so it sees both and sets `READY`.
- The payment's lock does the same across rows. A settlement waits for postings already in flight, and a posting that arrives during a settlement waits for it, so a leg and its payment's settlement always meet.
- One settlement can hand off to up to 100K legs in one statement. The `PAID` drain then takes them at the governor's pace.
- Only `WAITING` moves to `READY`, and the `where` clause skips an event the row already has. A repeat changes nothing, not even `lst_updt_ts`, so a `READY` row keeps its place in the fetch order and an `UNMATCHED` row keeps its retry time.
- `billpay_extnl_event` needs no unique index on the idempotency ID: a repeated event leaves the inbox row as it was, and Settle skips a payment that is already `PAID`.

An event that carries no payment ID is matched through `ReadPayments.v1`, by its account ID. If that finds no single payment, the raw event stays in `billpay_extnl_event` and an alert names it.

### Indexes and purge

- Partial indexes keep every read small: `READY` rows by `lst_updt_ts` for the fetch, `UNMATCHED` rows by `lst_updt_ts` for the hourly retry, `WAITING` rows by `creat_ts` for the 48-hour view, `WAITING` legs that have posted by `prnt_pymt_id` for a settlement's hand-off, and `READY` start requests by type and `creat_ts` for the dispatchers.
- One-Data deletes `DONE` rows and requests 30 days after their last update, and drops `billpay_extnl_event` partitions on the same schedule. When a pairing moves a leg, the same transaction touches the payment's own row, so the purge keeps it while legs are still arriving.
