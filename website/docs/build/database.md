---
title: Database
description: "One row in trans_dtl is the truth about a payment's current state."
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database

<Lead>One row in <code>trans_dtl</code> is the truth about a payment's current state. The rest of Billpay's Oracle schema records how the payment got there, guards against doing the same work twice, and holds the work that is still to start.</Lead>

Only the stores read or write these tables: `PaymentStore` for payment state, `WorkTrackerStore` for the Work Tracker, `AllocationBatchStore` for allocation batches, `ConfigStore` for the published market config and `ControlStore` for the control tables. Each operation is one transaction, and every write in it is either insert-if-absent or a conditional update on the current status, so a retried step can never apply twice. Settlement and AR posting events aren't here: they wait in One-Data's inbox, in its own Postgres database, and Billpay reaches them only through [One-Data's inbox functions](./api-spec/one-data.md#inbox-functions). There is no outbox either, because lifecycle events and customer messages are activity calls.

The `BPYSCH` DDL shared on 2026-10-16 is current: it is what runs in production. Everything marked new below goes on a [separate list for the DBAs](#new-tables-and-columns-for-the-dbas).

## Payment tables

| Table | One row per | Holds |
| --- | --- | --- |
| `trans_dtl` | Payment, per presentment | Its type in `trans_type_cd`, `PAYMENT` or `REFUND` for now, with `ADJUSTMENT` and `REVERSAL` to follow; adjustments and reversals across accounts move no money. Its total in `tot_trans_am`: the create's total, which for one instruction equals `trans_am`, while a create with several instructions writes one row per instruction, each carrying the same total (agreed 2026-11-07). Its source in `trans_srce_nm`, which mostly matches `PaymentSource`, and in `money_move_da` the response that comes back from Multitail or M3 for its money movement, which always fits in the column's 4,000 characters (agreed 2026-11-08). The payment option ID the create carried, in a new column, `pymt_optn_id` (Proposed, 2026-11-08). The instrument's enrollment ID, and in `instrmt_dtl_da` only the instrument type, its token, its fingerprint, the bank's routing number and name, and the account number's last 4 digits: Billpay fetches the rest of the instrument from Payment Instruments when a step needs it. Capture writes `acct_dtl_da` as `{productType, accountType}` and the instrument type into `instrmt_dtl_da`, since a dispatcher re-routes each row it claims with that day's config and the account type is stored nowhere else (Proposed, 2026-11-07). Its current status, which every stage moves with a guarded update. A corporate payment passes through `ALLOCATING` and `ALLOCATED`, and its parent row carries `legs_released_at`, set by its Execute. Every payment but a split parent carries `stlmt_ts` and `ar_pstd_ts`, set by Settle when it turns `PAID`. A payment waiting for bank confirmation carries Amex Pay with Bank Transfer's reference and the redirect link, and a debit card payment the card provider's reference and the challenge link. |
| `trans_lfcyc_event` | Status a payment reached, per presentment | The timeline. Each row names the cluster that ran the step, and the `PAID` rows Settle writes carry its `batch_id`. |
| `split_trans_dtl` | Leg of a split payment, consumer or corporate, per presentment | The leg's current status, with `stlmt_ts` and `ar_pstd_ts` once it turns `PAID`. |
| `split_trans_lfcyc_event` | Status a leg reached, per presentment | The leg's timeline, with the same cluster column and `batch_id` on Settle's `PAID` rows. |
| `idempotency_checker` | Request | Capture's insert-if-absent check. A duplicate means the request was seen before. Its `api_id` holds an internal value for the API, at most 30 characters. `CreateBillpayTransactionFromAccountsReceivable.v1` is 49, so for now billpay-offline writes the placeholder `CreateBillpayTxnFromAR.v1`; replace it with the value the company's environment uses once Billpay is integrated. For an inbound payment it writes `INBOUND_PAYMENT`, a placeholder that doesn't map straight to an API (agreed 2026-11-08). Its `resp_da` holds the last response sent for the request: billpay-online writes the reply's JSON as it sent it, off the request thread, and a pulled request (AR or inbound) leaves it empty. It always fits in the column's 4,000 characters; if a response ever doesn't, the column is widened (agreed 2026-11-08; Proposed: 2 writer threads and a queue of 10,000 writes per pod). |
| `ORIG_TRANS_REFER_MAP` | Replacement payment | The old and new payment IDs, when Update Payment cancels a payment and creates its replacement. |
| `allocation_batch` (new) | Allocations callback | A corporate payment's allocations, stored before `ReceiveAllocationsWorkflow` starts, and when that batch's legs were written. `alloc_da` holds the batch as a JSON array of `{accountId, accountCountry, accountDetail, amount}`, and `batch_am` the sum of its amounts (Proposed, 2026-11-08). It keeps big batches out of workflow inputs, holds every batch until the parent's Execute releases its legs, and makes sure each batch's legs are written once. |

Both timelines are append-only. A step adds a row and never updates one, so the history of a payment is exactly the rows it left behind.

## Work and config tables

| Table | One row per | Holds |
| --- | --- | --- |
| `work_tracker` (new) | Piece of dated work | A scheduled execution, an allocation request, a corporate execution, a corporate leg or a representment, and when it is due. Written in the same commit as the state change that creates it. |
| `market_config_version` (new) | Published version of a market profile | Immutable once saved. |
| `market_config_active` (new) | Market and account type | The version that is live, and `in_service_in`, N once the market is taken out of service, so the active version stays readable (Proposed). The Router reads it, and only `MarketOnboardingWorkflow` writes it. |
| `dispatch_run` (new) | Dispatcher run | The ops view: counts, current rate, paused or not. |
| `rate_allocation` (new) | Traffic class, market or corporate payment | The rate the governor sets, which dispatchers read every few seconds. Manual overrides live here too. |
| `downstream_limit` (new) | Downstream endpoint | Agreed TPS (`agreed_tps`), online margin, current offline share, Online's cap during a SEPA run and when it ends (`online_cap_tps`, `online_cap_end_ts`), last 429. billpay-online sets its queue's limit from them: the cap while it lasts, the agreed TPS otherwise. Column names Proposed (2026-11-07). |
| `governor_decision` (new) | Governor check, every 15 seconds | Its inputs and outputs, so any rate can be explained later. |
| `exception_list` (new) | Payment or leg whose retries ran out | The stage and status it stopped in, the last error, and who resolved it and when. Operations work from it. |

## The Work Tracker

| Column | Holds |
| --- | --- |
| `item_id` | Primary key: a deterministic business key such as `exec:{paymentId}`, `allocreq:{paymentId}` or `repr:{paymentId}:{seq}` (Proposed, 2026-11-07), so a retried insert can't create duplicate work |
| `item_type` | `SCHED_EXEC`, `ALLOC_REQUEST`, `ALLOC_EXEC`, `ALLOC_LEG` or `REPRESENT` |
| `ref_id` | The payment or leg ID in the payment tables |
| `group_key` | What a run claims by (agreed 2026-11-08): `{market}-{accountType}` on a `SCHED_EXEC` row, the market on a `REPRESENT` row, the parent's payment ID on an `ALLOC_LEG` row, and none on `ALLOC_REQUEST` and `ALLOC_EXEC` rows |
| `due_at` | The earliest start: the execution time, the fetch time, the time a leg is written, or the representment date |
| `priority` | Claim order inside a type: 1 for an execution or a representment, 2 for an allocation request (Proposed, 2026-11-07) |
| `status` | `SCHEDULED`, `DISPATCHING`, `DISPATCHED`, `DONE`, `FAILED` or `CANCELLED` |
| `run_id`, `claimed_at` | Which dispatcher run claimed it, and when |
| `attempts`, `last_error` | Dispatch retries, and the last failure |
| `trace_parent` | The producer's OpenTelemetry context, for span links |

Workflow IDs aren't stored, because each one is the payment ID plus its suffix. [Design → Pacing](../design/pacing.md#the-work-tracker) has what each type is due at, which dispatcher starts it and how a row's status moves.

The table grows by millions of rows, so three choices keep it fast:

- The claim index is function-based, on `CASE WHEN status = 'SCHEDULED' THEN … END` for `item_type`, `group_key`, `priority` and `due_at`. Oracle stores no entry when every key is NULL, so the index holds only rows that can be claimed and stays small beside the finished ones.
- An in-flight index uses the same trick for `DISPATCHING` and `DISPATCHED` rows, so counting work in flight is a small index scan.
- Daily interval partitions on `due_at`, with row movement on. The purge drops a partition 15 days after it falls due, so there are no mass `DELETE`s. A partition that still holds an unfinished row (`SCHEDULED`, `DISPATCHING` or `DISPATCHED`) is kept and dropped on a later run, once those rows finish (agreed 2026-11-07).

A dispatcher claims rows with a cursor opened `FOR UPDATE SKIP LOCKED`: it fetches up to N rows with `BULK COLLECT … LIMIT N`, marks those IDs `DISPATCHING` and commits. `ROWNUM <= N` doesn't work with SKIP LOCKED, because ROWNUM counts the locked rows too and can return fewer rows than asked, or none. `FETCH FIRST` doesn't work either: Oracle refuses it together with `FOR UPDATE`.

Every Oracle timestamp Billpay writes or reads is a UTC wall time. The claim, the sweep and Settle compare times against the database clock, never a time the app binds, so every pod of both apps works from one clock. In SQL that clock is `sys_extract_utc(systimestamp)`: a plain UTC timestamp, the type `due_at` and `claimed_at` have, so the indexes' case expressions compare with no conversion (agreed 2026-11-08).

## What PaymentStore does

`PaymentStore` holds payment state. Each of its operations is one transaction, and every write is insert-if-absent or a guarded update. The other stores follow the same rules.

| Operation | In one transaction |
| --- | --- |
| Capture | Insert-if-absent into `trans_dtl`, `trans_lfcyc_event` and the idempotency table |
| A stage commit | The guarded status update, the timeline row with the cluster, and any Work Tracker rows the step creates or closes |
| Writing legs | A batch's split rows in 1,000-row array inserts, each with its `ALLOC_LEG` row, together with the note on the batch that its legs are written |
| Bank confirmation or 3D Secure | The redirect or challenge link and the reference from Amex Pay with Bank Transfer or the card provider, guarded on `PENDING` |
| Cancel | The guarded update to `CANCELLED`, and cancelling the payment's Work Tracker rows |
| Giving up | The Work Tracker row to `FAILED`, and the payment or leg onto `exception_list` in the status it stopped in. A call before Execute that runs out of retries lists the payment by its workflow ID, with the stage and status it stopped at; a row a dispatcher sets `FAILED` uses the ID its workflow would have had, with the stage `DISPATCH` (Proposed, 2026-11-08) |
| Mapping a replacement | The old and new payment IDs in `ORIG_TRANS_REFER_MAP` |
| Settle | A batch of up to 500 inbox rows as JDBC batches: each a guarded update from `PROCESSED` to `PAID`, with a `PAID` timeline row tagged with the batch ID wherever the update changed a row |

Every table has one [Exposed](./tech-stack/orm.md) `Table` object, and those objects are the only place column names appear in Kotlin. Workflow code never touches any of this, because it has to [stay deterministic](./core-build/workflows.md#why-workflow-code-must-be-deterministic).

## New tables and columns for the DBAs

The production DDL stays as it is. What the design adds goes to the DBAs as one list:

- New columns on `trans_dtl`: `legs_released_at`, `stlmt_ts`, `ar_pstd_ts`, `bank_cnfrm_ref` and `bank_cnfrm_url`, plus `pymt_optn_id`, the payment option ID the create carried (Proposed, 2026-11-08). On `split_trans_dtl`: `stlmt_ts` and `ar_pstd_ts`. On both timelines: `cluster_nm` and `batch_id`.
- New indexes: the batch-ID index on each timeline, and the indexes for the corporate completion check, the late-allocations check and the 48-hour check (Proposed).
- New tables: `work_tracker`, `allocation_batch`, `exception_list`, `market_config_version`, `market_config_active` (with `in_service_in`, Proposed), `dispatch_run`, `rate_allocation`, `downstream_limit` and `governor_decision`.
- New values: `ALLOCATING` and `ALLOCATED` in `trans_sta_cd`.
- New rights: billpay-offline's database user can drop `work_tracker`'s partitions, for the purge (agreed 2026-11-07).

