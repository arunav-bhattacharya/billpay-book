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
      desc: `The contracts: the One-Data Functions at the edge, and the core REST APIs behind them, with the router branching and the idempotency rules at the boundary.`,
    },
    {
      term: 'Data Model',
      to: '/docs/build/data-model',
      desc: `The Kotlin domain model (payments, options, instruments) and the Oracle tables underneath it, including how the code maps onto them.`,
    },
    {
      term: 'Schedules',
      to: '/docs/build/schedules',
      desc: `The Temporal Schedules that drive the periodic workflows, and why a cadence change is a versioned code change rather than a console edit.`,
    },
  ]}
/>

The artifacts we ship, meaning the worker app, the codec server, and the mocks, live under [Deployment](../deployment/index.md).
