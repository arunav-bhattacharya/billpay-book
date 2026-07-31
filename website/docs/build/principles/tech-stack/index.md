---
title: Tech Stack
sidebar_label: Tech Stack
---

import Lead from '@site/src/components/Lead';

# Tech Stack

<Lead>These are load-bearing choices, not defaults we drifted into. Surprises are expensive when money is moving, so every pick favours the same things: predictable failure modes, explicit control over timeouts and transactions, and a small dependency surface.</Lead>

## Project defaults

Four choices sit underneath everything and are not revisited per component:

- **Kotlin** is the platform language, top to bottom. The domain model leans hard on sealed hierarchies and null-safety, and the [Domain Model](../../domain-model/index.md) pages show why.
- **Quarkus (ArC/CDI)** does the dependency injection and app wiring. We use it lightly: `@ApplicationScoped` beans and constructor injection, and none of the rest of the framework.
- **Gradle** builds everything from one multi-module monorepo. The [code layout](../core-build/code-layout.md) page shows how the modules map to the component model.
- **Temporal** is the workflow engine. Its guarantees (durable state, replay, retries, signals, schedules) are why the [core build rules](../core-build/index.md) look the way they do.

## The decisions

| Concern | Choice | Why |
| --- | --- | --- |
| [Database](./database.md) | **Oracle** | ACID for money movement, plus an operations story we don't have to build ourselves. |
| [Connection pool](./datasource.md) | **AgroalDataSource** | Microsecond acquisition, first-class metrics, fails fast when the database is down. |
| [ORM](./orm.md) | **Exposed** | SQL stays visible, Kotlin-native, no session magic anywhere near payments. |
| [HTTP client](./http-client.md) | **OkHttpClient** | Pooling, HTTP/2, and four independent timeouts that respect the activity deadline above them. |
| [Serialization](./serialization.md) | **Jackson** (today) | Polymorphic `type` discriminators carry our sealed domain model across every boundary. |

## Under evaluation

A handful of tools show up in these pages as direction, not decision: **kotlinx.serialization** (compile-time codecs instead of reflection), **KSP** for build-time code generation, **Konsist** for architecture tests, and **Arrow's `Either`** for structured validation errors. Until any of those is adopted, what's documented here is what runs.
