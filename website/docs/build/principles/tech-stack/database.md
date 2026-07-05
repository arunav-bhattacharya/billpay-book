---
title: 'Database: Oracle'
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database: Oracle

<Lead>Every payment, lifecycle event, idempotency record, and tracker row lives in one Oracle schema. We chose Oracle less for the engine and more for the guarantees around it — and because a payments platform is exactly the wrong place to be your own database operations team.</Lead>

## Why Oracle

| Reason | Why it matters for Billpay |
| --- | --- |
| **Strong ACID guarantees** | Money movement cannot tolerate phantom reads, lost writes, or partial commits. Serialisable isolation and well-understood locking behaviour are the table stakes everything else builds on. |
| **Operations we don't have to build** | A dedicated Amex DBO team covers HA, backup, restore, patching, and capacity. Picking a datastore nobody else at Amex runs would mean carrying that whole layer ourselves. |
| **Fits our load shape** | Billpay is mixed OLTP: short, hot transactions on `trans_dtl` and `idempotency_checker` next to append-heavy logs (`trans_lfcyc_event`, the notification tracker). Oracle handles that shape predictably with the right indexes and partitioning. |
| **Partitioning is how we purge** | The event logs grow without bound. Range-partitioning on event date lets `DataPurgingWF` drop whole partitions instead of deleting row by row. |
| **Idempotency at the constraint level** | The `idempotency_checker` first-write-wins contract is a unique constraint. A duplicate request fails its insert (`ORA-00001`) and we return the original outcome — no application-level race to reason about. |
| **Replicas and DR are solved** | Read replicas take the reporting load; Data Guard covers disaster recovery. Both run by the DBO team, not by us. |
| **JSON where relational is overkill** | Complex payloads — allocation breakdowns, notification bodies — can sit in JSON-typed columns instead of exploding into side tables. |

## What we turned down

- **PostgreSQL** — equally capable on paper. But there's no shared operational baseline at Amex for our scale tier, so we would carry the ops cost alone. The engine isn't the decision; the ecosystem is.
- **NoSQL (DynamoDB, MongoDB)** — payments are relentlessly relational: a parent payment, its splits, their lifecycle events, an original-to-replacement mapping. Joins and multi-table transactional guarantees are precisely what document stores make awkward.
- **Event store (Kafka as source of truth)** — a payment's *current* state must be readable in O(1), not rebuilt from a stream. Teams that go this way end up bolting on a derived relational store anyway; we'd rather have the relational store be the truth.

## How we use it

One logical schema for billpay-core, with separate read-write and read-only users. Connection pooling is [Agroal](./datasource.md), tuned differently for the Online and Offline workers. Schema migrations are version-controlled and run through the standard Amex DB pipeline — never by hand, never by the ORM. And application code reaches Oracle exclusively through [Exposed](./orm.md); there is no raw JDBC in stages, activities, or anywhere else.

:::tip
Reporting and analytics belong on a read replica or a downstream warehouse. If a dashboard query is hitting the primary, that's a bug — file it.
:::
