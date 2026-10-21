---
title: Database
description: "One row in trans_dtl is the truth about a payment's current state."
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database

<Lead>One row in <code>trans_dtl</code> is the truth about a payment's current state. The rest of Billpay's Oracle schema records how the payment got there, guards against doing the same work twice, and holds the work that is still to start.</Lead>

`PaymentStore` is the only code that reads or writes these tables. Each of its operations is one transaction, and every write in it is either insert-if-absent or a conditional update on the current status, so a retried step can never apply twice. Settlement and AR posting events aren't here: they wait in One-Data's inbox, in its own Postgres database, and Billpay reaches them only through [One-Data's inbox functions](./api-spec/one-data.md#inbox-functions). There is no outbox either, because lifecycle events and customer messages are activity calls.

## Payment tables

| Table | One row per | Holds |
| --- | --- | --- |
| `trans_dtl` | Payment | Its current status, which every stage moves with a guarded update. A corporate payment passes through `ALLOCATING` and `ALLOCATED`, and its parent row carries `legs_released_at`, set by its Execute. Every payment but a split parent carries `stlmt_ts` and `ar_pstd_ts`, set by Settle when it turns `PAID`. A payment waiting for bank confirmation carries the provider's reference and the redirect link. One waiting for a go-ahead carries the IDs of the pending payments the customer was shown, which Capture writes from the request. |
| `trans_lfcyc_event` | Status a payment reached, per presentment | The timeline. Each row names the cluster that ran the step, and the `PAID` rows Settle writes carry its `batch_id`. |
| `split_trans_dtl` | Leg of a split payment, consumer or corporate | The leg's current status, with `stlmt_ts` and `ar_pstd_ts` once it turns `PAID`. |
| `split_trans_lfcyc_event` | Status a leg reached | The leg's timeline, with the same cluster column and `batch_id` on Settle's `PAID` rows. |
| Idempotency table | Request | Capture's insert-if-absent check. A duplicate means the request was seen before. |
| `ORIG_TRANS_REFER_MAP` | Replacement payment | The old and new payment IDs, when Update Payment cancels a payment and creates its rerunSite. |
| `allocation_batch` (new) | Allocations callback | A corporate payment's allocations, stored before `ReceiveAllocationsWorkflow` starts, and when that batch's legs were written. It keeps big batches out of workflow inputs, holds every batch until the parent's Execute releases its legs, and makes sure each batch's legs are written once. |

Both timelines are append-only. A step adds a row and never updates one, so the history of a payment is exactly the rows it left behind.

## Work and config tables

| Table | One row per | Holds |
| --- | --- | --- |
| `work_tracker` (new) | Piece of dated work | A scheduled execution, an allocation request, a corporate execution, a corporate leg or a representment, and when it is due. Written in the same commit as the state change that creates it. |
| `market_config_version` (new) | Published version of a market profile | Immutable once saved. |
| `market_config_active` (new) | Market and account type | The version that is live. The Router reads it, and only `MarketOnboardingWorkflow` writes it. |
| `dispatch_run` (new) | Dispatcher run | The ops view: counts, current rate, paused or not. |
| `rate_allocation` (new) | Traffic class, market or corporate payment | The rate the governor sets, which dispatchers read every few seconds. Manual overrides live here too. |
| `downstream_limit` (new) | Downstream endpoint | Agreed TPS, online margin, current offline share, Online cap and when it ends, last 429. |
| `governor_decision` (new) | Governor check, every 15 seconds | Its inputs and outputs, so any rate can be explained later. |
| `exception_list` (new) | Payment or leg whose retries ran out | The stage and status it stopped in, the last error, and who resolved it and when. Operations work from it. |

## The Work Tracker

| Column | Holds |
| --- | --- |
| `item_id` | Primary key: a deterministic business key such as `exec:{paymentId}`, so a retried insert can't create duplicate work |
| `item_type` | `SCHED_EXEC`, `ALLOC_REQUEST`, `ALLOC_EXEC`, `ALLOC_LEG` or `REPRESENT` |
| `ref_id` | The payment or leg ID in the payment tables |
| `group_key` | The market, or the parent payment ID for a leg |
| `due_at` | The earliest start: the execution time, the fetch time, the time a leg is written, or the representment date |
| `priority` | Claim order inside a type |
| `status` | `SCHEDULED`, `DISPATCHING`, `DISPATCHED`, `DONE`, `FAILED` or `CANCELLED` |
| `run_id`, `claimed_at` | Which dispatcher run claimed it, and when |
| `attempts`, `last_error` | Dispatch retries, and the last failure |
| `trace_parent` | The producer's OpenTelemetry context, for span links |

Workflow IDs aren't stored, because each one is the payment ID plus its suffix. [Design → Pacing](../design/pacing.md#the-work-tracker) has what each type is due at, which dispatcher starts it and how a row's status moves.

The table grows by millions of rows, so three choices keep it fast:

- The claim index is function-based, on `CASE WHEN status = 'SCHEDULED' THEN … END` for `item_type`, `group_key`, `priority` and `due_at`. Oracle stores no entry when every key is NULL, so the index holds only rows that can be claimed and stays small beside the finished ones.
- An in-flight index uses the same trick for `DISPATCHING` and `DISPATCHED` rows, so counting work in flight is a small index scan.
- Daily interval partitions on `due_at`, with row movement on. The purge drops a partition 15 days after it falls due, so there are no mass `DELETE`s.

A dispatcher claims rows with a cursor opened `FOR UPDATE SKIP LOCKED`: it fetches up to N rows with `BULK COLLECT … LIMIT N`, marks those IDs `DISPATCHING` and commits. `ROWNUM <= N` doesn't work with SKIP LOCKED, because ROWNUM counts the locked rows too and can return fewer rows than asked, or none. `FETCH FIRST` doesn't work either: Oracle refuses it together with `FOR UPDATE`.

## What PaymentStore does

| Operation | In one transaction |
| --- | --- |
| Capture | Insert-if-absent into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, with the pending payments' IDs when the payment waits for a go-ahead |
| A stage commit | The guarded status update, the timeline row with the cluster, and any Work Tracker rows the step creates or closes |
| Writing legs | A batch's split rows in 1,000-row array inserts, each with its `ALLOC_LEG` row, together with the note on the batch that its legs are written |
| Bank confirmation or 3D Secure | The redirect or challenge link and the provider's reference, guarded on `PENDING` |
| Cancel | The guarded update to `CANCELLED`, and cancelling the payment's Work Tracker rows |
| Giving up | The Work Tracker row to `FAILED`, and the payment or leg onto `exception_list` in the status it stopped in |
| Mapping a replacement | The old and new payment IDs in `ORIG_TRANS_REFER_MAP` |
| Settle | A batch of up to 500 inbox rows as JDBC batches: each a guarded update from `PROCESSED` to `PAID`, with a `PAID` timeline row tagged with the batch ID wherever the update changed a row |

Every table has one [Exposed](./tech-stack/orm.md) `Table` object, and those objects are the only place column names appear in Kotlin. Workflow code never touches any of this, because it has to [stay deterministic](./core-build/workflows.md#why-workflow-code-must-be-deterministic).
