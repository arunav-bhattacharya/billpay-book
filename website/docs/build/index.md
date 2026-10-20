---
title: Build
description: 'Design describes what the platform does: the lifecycle, the workflows, the component model.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Build

<Lead>[Design](../design/index.md) describes what the platform does: the lifecycle, the workflows, the component model. This section is how we build it. It covers the stack we chose and why, how the code is organised, and how to write each kind of component.</Lead>

Everything here goes into one app, billpay-core. It runs the core APIs, the Router, the dispatchers, the governor and the workers for both Temporal clusters, so more capacity means more pods of the same app, not a second app.

## In this section

<SectionIndex
  items={[
    {
      term: 'Principles',
      to: '/docs/build/principles',
      desc: `The stack we chose and why (Kotlin, Temporal, Quarkus, Oracle, OkHttp, Jackson), and how to write each layer: the Router, a workflow, a stage, an activity and a client.`,
    },
    {
      term: 'API Spec',
      to: '/docs/build/api-spec',
      desc: `The contracts: One-Data's functions at the edge, billpay-core's REST APIs behind them, what the Router refuses, and the Market Onboarding API.`,
    },
    {
      term: 'Domain Model',
      to: '/docs/build/domain-model',
      desc: `The Kotlin types behind a payment, one class per state, built so an illegal state will not compile, and the types the model leans on.`,
    },
    {
      term: 'Database',
      to: '/docs/build/database',
      desc: `The Oracle tables under the domain model, the Work Tracker that holds dated work, and what each PaymentStore transaction writes.`,
    },
    {
      term: 'Dispatchers and the Governor',
      to: '/docs/build/dispatchers',
      desc: `The small workflows that turn due work into starts at the governor's rate: claiming rows, the heartbeat, the inbox dispatchers, overrides, and the governor's check every 15 seconds.`,
    },
    {
      term: 'Schedules',
      to: '/docs/build/schedules',
      desc: `The Temporal Schedules that start the dispatchers, the governor and the periodic jobs, and the market Schedules that arrive in a release.`,
    },
  ]}
/>

How billpay-core ships is under [Deployment](../deployment/index.md).
