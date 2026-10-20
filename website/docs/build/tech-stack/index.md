---
title: Tech Stack
description: 'These are load-bearing choices, not defaults we drifted into.'
sidebar_label: Tech Stack
---

import Lead from '@site/src/components/Lead';

# Tech Stack

<Lead>These are load-bearing choices, not defaults we drifted into. Surprises are expensive when money is moving, so every pick favours the same things: predictable failure modes, explicit control over timeouts and transactions, and a small dependency surface.</Lead>

## Project defaults

Four choices sit underneath everything and are not revisited per component:

- Kotlin is the platform language, top to bottom. The domain model leans hard on sealed hierarchies and null-safety, and the [Domain Model](../domain-model/index.md) pages show why.
- Quarkus (ArC/CDI) does the dependency injection and app wiring. We use it lightly: `@ApplicationScoped` and `@Singleton` beans, constructor injection, and `@All List<T>` to hand the stage registries every class of a kind, and none of the rest of the framework.
- Gradle builds everything from one multi-module monorepo. The [code layout](../core-build/code-layout.md) page shows how the modules map to the component model.
- Temporal is the workflow engine: two self-hosted clusters, Online and Offline, each with its own Aurora PostgreSQL database and OpenSearch 2 for visibility, on server 1.30.1 or later. Billpay leans on Update-With-Start, Schedules, Worker Versioning, and task queue priority and fairness, and its guarantees (durable state, replay, retries) are why the [core build rules](../core-build/index.md) look the way they do.

## The decisions

| Concern | Choice | Why |
| --- | --- | --- |
| [Database](./database.md) | **Oracle** | ACID for money movement, plus an operations story we don't have to build ourselves. |
| [Connection pool](./datasource.md) | **AgroalDataSource** | Microsecond acquisition, first-class metrics, fails fast when the database is down. |
| [ORM](./orm.md) | **Exposed** | SQL stays visible, Kotlin-native, no session magic anywhere near payments. |
| [HTTP client](./http-client.md) | **OkHttp** | Pooling, HTTP/2, and four independent timeouts that respect the activity deadline above them. |
| [Serialization](./serialization.md) | **Jackson** | Polymorphic `type` discriminators carry our sealed domain model across every boundary, and Temporal's own converter already speaks it. |
| [Stage lookup](../core-build/stage-resolver.md) | **Quarkus CDI (ArC)** | Finds every stage, check and method at build time and hands them to the stage registries, so a market's own variation is one new class, with no mapping code and no code generator. |

## Under evaluation

Two tools show up in these pages as direction, not decision: **Konsist** for architecture tests and **Arrow's `Either`** for structured validation errors. Until either is adopted, what's documented here is what runs. kotlinx.serialization was weighed against Jackson and turned down, and the [Serialization](./serialization.md#why-not-kotlinxserialization) page says why.
