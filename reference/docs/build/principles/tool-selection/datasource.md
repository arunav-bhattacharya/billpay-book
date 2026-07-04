---
title: DataSource — AgroalDataSource
sidebar_position: 3
---

# Choice of DataSource — AgroalDataSource

Every JDBC connection Billpay-core makes to [Oracle](./database.md) is borrowed from an **[AgroalDataSource](https://agroal.github.io/)** pool. Agroal is the connection pool we standardise on across all Billpay deployables (realtime worker, batch worker, codec server, mocks).

## Why Agroal

| Reason | Why it matters for Billpay |
| --- | --- |
| **Designed for low-latency JVM workloads** | Agroal was built by the Quarkus team specifically for fast startup and tight latency budgets. Connection acquisition is measured in microseconds, not milliseconds. |
| **First-class observability** | Pool size, in-use connections, acquisition time, wait queue depth — all exposed as metrics out of the box. We feed these directly into our App Health dashboards. |
| **Tunable validation strategy** | We can choose between "validate-on-acquire", "validate-on-return", and idle background validation. Realtime worker uses background validation (lowest latency); batch worker validates on acquire (safer under long pauses). |
| **Reaper for leaked connections** | A workflow that crashes mid-transaction must not permanently hold a connection. Agroal's leak detector reclaims them with a configurable threshold. |
| **Predictable failure semantics** | When the database is down, Agroal fails fast with a typed exception. We do **not** want a pool that silently retries — Temporal's activity retries should be the only retry layer. |
| **No transitive Spring dependency** | Like our [HTTP client choice](./http-client.md), we deliberately stay framework-light at the worker layer. Agroal is a single, focused JAR. |
| **Compatible with Hibernate, Exposed, raw JDBC** | We use [Exposed](./orm.md) — Agroal is a drop-in `javax.sql.DataSource`, so the ORM neither knows nor cares which pool we use. |

## Why not the alternatives

- **HikariCP** — the popular default. Excellent and well-tested, but Agroal's observability hooks are richer and it integrates more cleanly with our metrics stack. Both are good choices; Agroal won on instrumentation.
- **C3P0** — historical default in older JVM apps; slower and noisier under load.
- **Apache DBCP / Tomcat DBCP** — older designs, heavier, and the failure modes are less predictable than either Hikari or Agroal.
- **No pool (raw JDBC)** — not viable. Connection setup to Oracle (auth, session params, etc.) is far too expensive to do per request.

## How we tune it

Two distinct pool configurations live side-by-side in the same JVM when needed:

| Pool | Used by | Shape |
| --- | --- | --- |
| **Realtime pool** | Realtime worker activities; API request path | Small to medium size, background validation, short acquire timeout, eager evict |
| **Batch pool** | Batch worker activities; scheduler-driven flows | Larger size, validate-on-acquire, longer acquire timeout, more tolerant of slow queries |

The pools are sized so that the **sum of max connections** across all workers stays well under the Oracle session limit — Oracle ration is the binding constraint, not Agroal.

:::tip
If you see `AgroalSQLException` with "acquisition timeout" in the realtime worker, it almost always means a downstream query has slowed down — **not** that the pool is too small. Investigate the slow query first.
:::
