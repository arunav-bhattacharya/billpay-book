---
title: Database — Oracle
sidebar_position: 2
---

# Choice of Database — Oracle

Billpay-core persists every payment, lifecycle event, idempotency record, scheduler queue entry and notification tracker row in **Oracle**. The choice is not just "what's available at Amex" — Oracle's guarantees line up with what Billpay needs at the database layer.

## Why Oracle

| Reason | Why it matters for Billpay |
| --- | --- |
| **Strong ACID guarantees** | Money movement cannot tolerate phantom reads, lost writes, or partial commits. Oracle's serialisable isolation and well-understood MVCC behaviour are the table-stakes we build on top of. |
| **First-class operational tooling at Amex** | A dedicated DBO team (`#oracle-dbo-support`) covers HA, backup, restore, patching, and capacity. We do not need to reinvent the operations layer of a new datastore. |
| **Battle-tested under our load profile** | Mixed OLTP — short transactions on hot tables (`trans_dtl`, `idempotency_checker`) alongside append-heavy logs (`trans_lfcyc_event`, `notification_tracker`). Oracle handles this shape predictably with the right indexes and partitioning. |
| **Partitioning + retention** | Lifecycle event and notification logs grow unbounded. Range-partitioning on event date lets `#DataPurgingWF` drop partitions instead of issuing row-by-row deletes. |
| **Idempotency at the constraint level** | `idempotency_checker`'s first-write-wins contract is enforced by a unique constraint. We rely on Oracle's exception semantics (`ORA-00001`) to detect duplicates — no application-level race. |
| **Mature read-replica + DR story** | Read replicas for analytical workloads; Data Guard for disaster recovery. Both are run by the DBO team, not by us. |
| **JSON support where we want it** | Newer Oracle versions let us store complex payloads (allocation breakdowns, notification payloads) as JSON-typed columns when relational columns would be overkill. |

## Why not the alternatives

- **PostgreSQL** — equally capable on paper, but no shared operational baseline at Amex for our scale tier; we would carry the ops cost alone.
- **A NoSQL store (DynamoDB, MongoDB)** — payments are highly relational (parent / splits / lifecycle / mappings). The joins we need are awkward without secondary indexes, and the transactional guarantees we need (multi-row, multi-table writes per payment) are not the strong suit of these stores.
- **An event store (Kafka-as-source-of-truth)** — appealing for the lifecycle log, but the *current state* of a payment must be queryable in O(1), not via stream rebuilds. We end up with a derived RDBMS anyway.

## How we use it

- **One logical schema per service** (Billpay-core), with separate users for read-write and read-only.
- **Connection pooling** through [AgroalDataSource](./datasource.md), tuned per worker pool (realtime vs. batch).
- **Schema migrations** version-controlled, applied via the standard Amex DB-migration pipeline.
- **Application-level access** exclusively through the [Exposed](./orm.md) ORM — no raw JDBC in services or workflows.

:::tip
Heavy reporting and analytics queries belong on a **read replica or a downstream warehouse**, never on the primary. The primary's job is the hot payment path.
:::
