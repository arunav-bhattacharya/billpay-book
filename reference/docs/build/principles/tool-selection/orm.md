---
title: ORM — Exposed
sidebar_position: 4
---

# Choice of ORM — Exposed

Billpay-core uses **[Exposed](https://jetbrains.github.io/Exposed/)** — JetBrains' Kotlin SQL framework — as the *only* path from application code to the [Oracle](./database.md) database. No raw JDBC, no hand-written `PreparedStatement` boilerplate, no Hibernate.

## Why Exposed

| Reason | Why it matters for Billpay |
| --- | --- |
| **SQL stays first-class** | Exposed's DSL maps closely to SQL — joins, group-by, window functions all read like SQL. We can tune queries by reading them. Hibernate's HQL hides too much; raw JDBC hides too little. |
| **Kotlin-native** | Type-safe column references, null-safety, and zero reflection at the call site. Billpay-core is Kotlin top-to-bottom — Exposed fits the language instead of fighting it. |
| **Two APIs, same library** | The **DSL** for one-off queries; the **DAO** layer when we want lightweight entity mapping. We mostly use the DSL — workflows and services want explicit reads/writes, not lazy-loaded graphs. |
| **No hidden session magic** | Transactions are explicit blocks (`transaction { … }`). There is no auto-commit, no detached entity, no Hibernate-style "where did this query come from" surprise. |
| **Predictable transaction scope** | Each activity gets a single transaction. If it throws, the transaction rolls back. The workflow then decides — via Temporal's activity retry policy — whether to retry. |
| **Plays nicely with [AgroalDataSource](./datasource.md)** | Exposed takes a `DataSource` and is otherwise indifferent to pooling — we keep the pool we already trust. |
| **Migration-friendly** | Schema migrations live outside Exposed (in our DB pipeline). Exposed's `Table` objects describe the schema for the application's view of it, kept in sync via code review and CI. |

## Why not the alternatives

- **Hibernate / JPA** — well-understood at Amex, but lazy-loading, dirty-checking, and L1 caching cause surprises that we do not want anywhere near money movement. Hibernate also pulls in a large transitive surface.
- **jOOQ** — closest competitor; arguably stronger type safety. We picked Exposed because it is Kotlin-native (jOOQ is Java-first), and because the JetBrains-Kotlin alignment is a smoother ergonomic fit in our codebase.
- **MyBatis** — XML mapping is friction we do not need; query-in-XML separates type info from the call site.
- **Raw JDBC** — every team that goes this route ends up writing 60% of an ORM badly. We would rather use one that exists.

## How we use it

- **One `Table` object per Oracle table** (`TransDtl`, `TransLfcycEvent`, `IdempotencyChecker`, …) — these are the only types that name columns.
- **Activities open a `transaction { … }` block** and run their reads / writes inside it. If the activity throws, the transaction rolls back; Temporal retries the activity.
- **Workflows never call Exposed directly.** Workflow code is deterministic — any DB I/O must go through an activity. This is a hard rule, enforced by code review.
- **No detached entities, no DAO graphs.** Reads return immutable Kotlin data classes that travel safely across coroutine / activity boundaries.

:::tip
If you find yourself wanting `selectAll().forEach { row -> updateSomething() }` inside Exposed, stop and think — that pattern almost always means you should be doing a bulk update statement instead. Exposed's DSL supports `update`, `updateReturning`, and `batchInsert`; use them.
:::
