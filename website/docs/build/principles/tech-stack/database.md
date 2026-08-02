---
title: 'Database: Oracle'
description: 'Every payment, lifecycle event, idempotency record, and tracker row lives in one Oracle schema.'
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database: Oracle

<Lead>Every payment, lifecycle event, idempotency record, and tracker row lives in one Oracle schema. We chose Oracle less for the engine and more for the guarantees around it, and because a payments platform is exactly the wrong place to be your own database operations team.</Lead>

## Why Oracle

| Reason | Why it matters for Billpay |
| --- | --- |
| **Strong ACID guarantees** | Money movement cannot tolerate phantom reads, lost writes, or partial commits. Serialisable isolation and well-understood locking behavior are the table stakes everything else builds on. |
| **Operations we don't have to build** | A dedicated Amex DBO team covers HA, backup, restore, patching, and capacity. Picking a datastore nobody else at Amex runs would mean carrying that whole layer ourselves. |
| **Fits our load shape** | Billpay is mixed OLTP: short, hot transactions on `trans_dtl` and `idempotency_checker` next to append-heavy logs (`trans_lfcyc_event`, the notification tracker). Oracle handles that shape predictably with the right indexes and partitioning. |
| **Partitioning is how we purge** | The event logs grow without bound, and dropping a date partition retires a month of them instantly. |
| **Idempotency at the constraint level** | First-write-wins is a unique constraint rather than application code, so there is no race to reason about. |
| **Replicas and DR are solved** | Read replicas take the reporting load and Data Guard covers disaster recovery. Both are run by the DBO team, not by us. |
| **JSON where relational is overkill** | Complex payloads such as allocation breakdowns and notification bodies can sit in JSON-typed columns instead of exploding into side tables. |

## What we turned down

- **PostgreSQL** is equally capable on paper. There is no shared operational baseline at Amex for our scale tier, though, so we would carry the ops cost alone. The engine was never the deciding factor. The operational support around it was.
- **NoSQL (DynamoDB, MongoDB)** does not fit, because payments are relentlessly relational: a parent payment, its splits, their lifecycle events, an original-to-replacement mapping. Joins and multi-table transactional guarantees are precisely what document stores make awkward.
- **An event store with Kafka as the source of truth** does not work either. A payment's *current* state must be readable in O(1), not rebuilt from a stream. Teams that go this way end up bolting on a derived relational store anyway, and we would rather have the relational store be the truth.

## How we use it

One logical schema for billpay-core, with separate read-write and read-only users. Connection pooling is [Agroal](./datasource.md). Schema migrations are version-controlled and run through the standard Amex DB pipeline, never by hand and never by the ORM. Application code reaches Oracle exclusively through [Exposed](./orm.md), and there is no raw JDBC in stages, activities, or anywhere else.

The tables themselves, and the three Oracle habits that follow from the reasons above, are in [Database](../../database.md).
