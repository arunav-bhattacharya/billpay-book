---
title: 'Database: Oracle'
description: 'Every payment, lifecycle event, idempotency record, and tracker row lives in one Oracle schema.'
sidebar_label: 'Database: Oracle'
---

import Lead from '@site/src/components/Lead';

# Database: Oracle

<Lead>Every payment, lifecycle event, idempotency record, and tracker row lives in one Oracle schema. We chose Oracle less for the engine and more for the guarantees around it, and because a payments platform is exactly the wrong place to be your own database operations team.</Lead>

## Why Oracle

| Reason | Why it matters for Billpay |
| --- | --- |
| **Strong ACID guarantees** | Money movement cannot tolerate phantom reads, lost writes, or partial commits. Serialisable isolation and well-understood locking behavior are the table stakes everything else builds on. |
| **Operations we don't have to build** | A dedicated Amex DBO team covers HA, backup, restore, patching, and capacity. Picking a datastore nobody else at Amex runs would mean carrying that whole layer ourselves. |
| **Fits our load shape** | Billpay is mixed OLTP: short, hot transactions on `trans_dtl` and `idempotency_checker` next to append-only timelines (`trans_lfcyc_event`, `split_trans_lfcyc_event`) and a Work Tracker that grows by millions of rows. Oracle handles that shape predictably with the right indexes and partitioning. |
| **Partitioning is how we purge** | The Work Tracker is partitioned by day, and dropping a partition 15 days after it falls due retires its rows at once, with no mass `DELETE`. A partition that still holds unfinished rows waits for a later run. |
| **Idempotency at the constraint level** | First-write-wins is a unique constraint rather than application code, so there is no race to reason about. |
| **Replicas and DR are solved** | Read replicas take the reporting load and Data Guard covers disaster recovery. Both are run by the DBO team, not by us. |
| **JSON where relational is overkill** | Complex payloads, such as the allocation batches a corporate payment receives, can sit in JSON-typed columns instead of exploding into side tables. |

## What we turned down

- PostgreSQL is equally capable on paper. There is no shared operational baseline at Amex for our scale tier, though, so we would carry the ops cost alone. The engine was never the deciding factor. The operational support around it was.
- NoSQL (DynamoDB, MongoDB) does not fit, because payments are relentlessly relational: a parent payment, its splits, their lifecycle events, an original-to-replacement mapping. Joins and multi-table transactional guarantees are precisely what document stores make awkward.
- An event store with Kafka as the source of truth does not work either. A payment's *current* state must be readable in O(1), not rebuilt from a stream. Teams that go this way end up bolting on a derived relational store anyway, and we would rather have the relational store be the truth.

## How we use it

One logical schema, `BPYSCH`, with separate read-write and read-only users. The `BPYSCH` DDL shared on 2026-10-16 is current: it is what runs in production. Every table and column the design adds goes on a separate list for the DBAs ([Database](../database.md#new-tables-and-columns-for-the-dbas)), and no migration changes a production table off that list. Connection pooling is [Agroal](./datasource.md), with one pool in each app: billpay-online's for online work and billpay-offline's for offline work. Schema migrations are version-controlled and run through the standard Amex DB pipeline, never by hand and never by the ORM.

Only the stores reach Oracle, through [Exposed](./orm.md): `PaymentStore`, `WorkTrackerStore`, `AllocationBatchStore`, `ConfigStore` and `ControlStore`, each called from an activity. Workflows, stages and activities never hold a connection or write SQL. Two habits follow from the reasons above: every status change is a guarded update on the current status, and the Work Tracker rows a step creates go in the same commit as its state change. The tables themselves are on [Database](../database.md).
