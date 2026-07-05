---
title: 'DataSource: Agroal'
sidebar_label: DataSource
---

import Lead from '@site/src/components/Lead';

# DataSource: AgroalDataSource

<Lead>Opening an Oracle connection is far too expensive to do per request, so everything runs through a pool. We use Agroal — the connection pool built by the Quarkus team — across every deployable: the worker app, the codec server, the mocks.</Lead>

## Why Agroal

| Reason | Why it matters for Billpay |
| --- | --- |
| **Built for low-latency JVM workloads** | Connection acquisition is measured in microseconds. On the Online worker, pool overhead has nowhere to hide. |
| **Observability out of the box** | Pool size, in-use connections, acquisition time, wait-queue depth — all exposed as metrics and fed straight into the App Health dashboards. When something is slow, we can see whether the pool is the problem in one glance. |
| **Tunable validation strategy** | Validate-on-acquire, validate-on-return, or idle background validation — chosen to balance latency against safety for the workload the pool serves. |
| **A reaper for leaked connections** | An activity that dies mid-transaction must not hold a connection forever. Agroal's leak detector reclaims them past a configurable threshold. |
| **Fails fast, doesn't retry** | When Oracle is down, Agroal throws a typed exception immediately. That's deliberate: Temporal's activity retry is the *only* retry layer we want. A pool that silently retries underneath it would blur who owns recovery. |
| **No transitive framework baggage** | A single focused JAR, no Spring pulled in behind it. Same philosophy as our [HTTP client](./http-client.md). |
| **Indifferent to the ORM** | It's a plain `javax.sql.DataSource`, so [Exposed](./orm.md) neither knows nor cares which pool sits underneath. |

**Runner-up:** HikariCP. Excellent, battle-tested, and it was close — Agroal won on richer instrumentation and cleaner integration with our metrics stack, not because Hikari is deficient. C3P0 and the DBCP family lost on age and noisy behaviour under load; "no pool" was never an option with Oracle connection costs.

## Sizing

The worker app runs one pool, serving both worker pools' activities and the API request path. The rule that matters: the sum of max connections across every instance must stay comfortably under the Oracle session limit — the Oracle ration is the binding constraint, not Agroal.

:::tip
An acquisition-timeout exception almost always means a slow downstream query is hogging connections — not an undersized pool. Find the query before you touch the pool size.
:::
