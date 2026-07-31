---
title: Build
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Build

<Lead>[Design](../design/index.md) describes what the platform does: the lifecycle, the workflows, the component model. This section is how we build it. It covers the stack we chose and why, how the code is organised, and how to write each kind of component.</Lead>

## Pages in this section

<Highlights
  accent="var(--amex-cat-build)"
  items={[
    {
      term: 'Principles',
      to: '/docs/build/principles',
      desc: `The load-bearing decisions: the stack we buy and why (Kotlin, Temporal, Quarkus, Oracle, OkHttp), and how you write a workflow, a stage, an activity, and a client.`,
    },
    {
      term: 'API Spec',
      to: '/docs/build/api-spec',
      desc: `The contracts: the One-Data Functions at the edge, the core REST APIs behind them, and the idempotency rules at the boundary.`,
    },
    {
      term: 'Domain Model',
      to: '/docs/build/domain-model',
      desc: `The Kotlin types behind a payment: payments, options, and instruments, built so an illegal state will not compile.`,
    },
    {
      term: 'Database',
      to: '/docs/build/database',
      desc: `The Oracle tables under the domain model, which activity writes each one, and the three Oracle habits worth knowing.`,
    },
    {
      term: 'Schedules',
      to: '/docs/build/schedules',
      desc: `The Temporal Schedules that drive the periodic workflows, and why a cadence change is a versioned code change rather than a console edit.`,
    },
  ]}
/>

The artifacts we ship, meaning the worker app, the codec server, and the mocks, live under [Deployment](../deployment/index.md).
