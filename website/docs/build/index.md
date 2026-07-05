---
title: Build
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Build

<Lead>[Design](../design/index.md) describes what the platform does — the lifecycle, the workflows, the component model. This section is how we actually build it: the stack we bet on and why, how the code is organised, and how you write each kind of component. Read it as a guide from the people who set the conventions, not as reference trivia.</Lead>

## The stack at a glance

<Highlights
  accent="var(--amex-cat-build)"
  items={[
    {
      term: 'Kotlin on the JVM',
      desc: 'The whole platform is Kotlin — workflows, stages, activities, domain model. Sealed types and null-safety do real work for us: most illegal payment states simply don’t compile.',
    },
    {
      term: 'Temporal',
      desc: 'Every payment runs as a durable Temporal workflow on one of two workers (Online / Offline). Retries, timers, signals, and replay come from the platform, not from hand-rolled state tables.',
    },
    {
      term: 'Quarkus, kept light',
      desc: 'Quarkus (ArC/CDI) wires the services and workers. We deliberately stay framework-light at the worker layer — no Spring, no reactive stack, small focused JARs.',
    },
    {
      term: 'Oracle · Agroal · Exposed',
      desc: 'One Oracle schema holds every payment, event, and tracker row. AgroalDataSource pools the connections; the Exposed DSL is the only path from code to SQL.',
    },
    {
      term: 'OkHttp at the edges',
      desc: 'Every outbound call — clearing, AR, Open-To-Buy, validation — goes through a shared OkHttp client with timeouts tuned to the Temporal activity deadline above it.',
    },
    {
      term: 'One Gradle monorepo',
      desc: 'billpay-core is a multi-module Gradle build: shared defaults in core/lib, market overrides in market/{m}, and a build-enforced rule that keeps workflow code deterministic.',
    },
  ]}
/>

## How this section is organised

- **[Principles](./principles/index.md)** — the load-bearing decisions. [Tech Stack](./principles/tech-stack/index.md) covers what we buy and why; [Core Build](./principles/core-build/index.md) covers how you write workflows, stages, activities, and clients.
- **[API Spec](./api-spec/index.md)** — the contracts: One-Data Functions at the edge, and the core REST APIs behind them.
- **[Data Model](./data-model/index.md)** — the Kotlin domain model (payments, options, instruments) and the Oracle tables underneath it.
- **[Schedules](./schedules.md)** — the Temporal Schedules that drive the periodic workflows.

The artifacts we ship — the worker app, codec server, mocks — live under [Deployment](../deployment/index.md).
