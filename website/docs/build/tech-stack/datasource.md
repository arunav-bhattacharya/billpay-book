---
title: 'DataSource: AgroalDataSource'
description: 'Opening an Oracle connection is far too expensive to do per request, so everything runs through a pool.'
sidebar_label: 'DataSource: Agroal'
---

import Lead from '@site/src/components/Lead';

# DataSource: AgroalDataSource

<Lead>Opening an Oracle connection is far too expensive to do per request, so everything runs through a pool. We use Agroal, the connection pool built by the Quarkus team, and each of Billpay's two apps runs one: billpay-online's for online work and billpay-offline's for offline work.</Lead>

## Why Agroal

| Reason | Why it matters for Billpay |
| --- | --- |
| **Built for low-latency JVM workloads** | Connection acquisition is measured in microseconds. On billpay-online's path, pool overhead has nowhere to hide. |
| **Observability out of the box** | Pool size, in-use connections, acquisition time, and wait-queue depth are all exposed as metrics and fed straight into the App Health dashboards. When something is slow, one glance tells us whether the pool is the problem. |
| **Tunable validation strategy** | Validate-on-acquire, validate-on-return, or idle background validation, chosen to balance latency against safety for the workload the pool serves. |
| **A reaper for leaked connections** | An activity that dies mid-transaction must not hold a connection forever. Agroal's leak detector reclaims them past a configurable threshold. |
| **Fails fast, does not retry** | When Oracle is down, Agroal throws a typed exception immediately. That is deliberate, because Temporal's activity retry is the *only* retry layer we want. A pool that silently retries underneath it would blur who owns recovery. |
| **No transitive framework baggage** | A single focused JAR, no Spring pulled in behind it. Same philosophy as our [HTTP client](./http-client.md). |
| **Indifferent to the ORM** | It is a plain `javax.sql.DataSource`, so [Exposed](./orm.md) neither knows nor cares which pool sits underneath. |

## One pool per app

Online and offline work run in separate apps, so each pool belongs to one of them: billpay-online's serves customers' payments and billpay-offline's serves the paced work. A midnight run can only use billpay-offline's connections, so it can never leave a customer waiting for one. The two pools together still have to fit Oracle's connection limit, so they are sized side by side.

The workers' slot caps sit under the pools. Each app's workers run no more database local activities at once than its pool has connections, so a store never queues for a connection. Every store reaches Oracle through its app's pool: `PaymentStore`, `WorkTrackerStore`, `AllocationBatchStore`, `ConfigStore` and `ControlStore`. A database activity runs local on its first attempt and as a regular activity for every retry, so a retry waiting out an Oracle outage holds no workflow task.

## What we turned down

HikariCP was the runner-up. It is excellent and well proven, and the decision was close. Agroal won on richer instrumentation and cleaner integration with our metrics stack, not because Hikari is deficient. C3P0 and the DBCP family lost on age and noisy behavior under load. Running with no pool at all was never an option, given Oracle connection costs.
