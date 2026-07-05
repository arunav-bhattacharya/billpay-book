---
title: 'ORM: Exposed'
sidebar_label: ORM
---

import Lead from '@site/src/components/Lead';

# ORM: Exposed

<Lead>Exposed — JetBrains' Kotlin SQL framework — is the only path from application code to Oracle. No raw JDBC, no hand-written `PreparedStatement` boilerplate, and no Hibernate. The goal is simple: when a query is slow or wrong, you should be able to read it.</Lead>

## Why Exposed

| Reason | Why it matters for Billpay |
| --- | --- |
| **SQL stays first-class** | The DSL maps closely to SQL — joins, group-by, window functions read like the SQL they generate. We tune queries by reading them. Hibernate's HQL hides too much; raw JDBC hides too little. |
| **Kotlin-native** | Type-safe column references, null-safety, no reflection at the call site. billpay-core is Kotlin top-to-bottom; Exposed fits the language instead of fighting it. |
| **Two APIs, one library** | The DSL for explicit queries, a lightweight DAO layer if entity mapping ever earns its keep. In practice we stay on the DSL — payment code wants explicit reads and writes, not lazy-loaded object graphs. |
| **No hidden session magic** | Transactions are explicit `transaction { }` blocks. No auto-commit, no detached entities, no "where did this query come from" surprises. |
| **Transaction scope you can reason about** | Each activity gets one transaction. If the activity throws, the transaction rolls back, and Temporal's retry policy decides what happens next. One activity, one transaction, one retry boundary. |
| **Plays nicely with Agroal** | Exposed takes a plain `DataSource` and is otherwise indifferent to pooling — we keep the [pool we already trust](./datasource.md). |
| **Migrations stay outside the ORM** | Schema changes run through the Amex DB pipeline. Exposed's `Table` objects describe the *application's view* of the schema, kept honest by code review and CI — the ORM never mutates the database's shape. |

## What we turned down

- **Hibernate / JPA** — lazy loading, dirty checking, and first-level caching produce surprises we do not want anywhere near money movement. Also a large transitive dependency surface.
- **jOOQ** — the closest competitor, arguably stronger type safety. Exposed won because it is Kotlin-native where jOOQ is Java-first; day to day, that's the difference between the ORM disappearing and the ORM being ceremony.
- **MyBatis** — XML mapping friction we'd pay on every table.
- **Raw JDBC** — every team that goes this route ends up writing 60% of an ORM, badly.

## How we use it

One `Table` object per Oracle table — `TransDtl`, `TransLfcycEvent`, `IdempotencyChecker`, and friends — and those objects are the *only* types in the codebase that name columns. Activities open a `transaction { }` block, do their reads and writes, and return **immutable Kotlin data classes** — never live entities.

The rule that matters most: **workflow code never touches Exposed.** Workflows must be deterministic and replay-safe, so every database read or write goes through an activity. This is a hard rule, enforced in code review and by the [module layout](../core-build/code-layout.md).

:::tip
Prefer bulk operations — `batchInsert`, a single `update` with a where-clause — over `selectAll().forEach { … update … }`. The DSL makes the row-by-row version easy to write and easy to regret.
:::
