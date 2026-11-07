---
title: Build
description: 'Design describes what the platform does: the lifecycle, the workflows, the component model.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Build

<Lead>[Design](../design/index.md) describes what the platform does: the lifecycle, the workflows, the component model. This section is how we build it. It covers the stack we chose and why, how the code is organised, and how to write each kind of component.</Lead>

Everything here goes into one codebase, billpay-core, which builds two apps from two Gradle app modules, each its own Quarkus artifact: billpay-online, with the core APIs channels call and the Online cluster's workers, and billpay-offline, with the dispatchers, the governor and the Offline cluster's workers. The build runs on JDK 25, with the latest stable Kotlin, Quarkus and Temporal Java SDK.

The full request and response contracts aren't provided yet. The code uses placeholders behind a mapping layer, shaped by sample payloads, and request validations get a framework now, with their rules filled in later. The structure is built outside the organization's network; the field-level details, from client integrations to API requests, responses and validations, are finished later against the existing Billpay app.

## In this section

<SectionIndex
  items={[
    {
      term: 'Tech Stack',
      to: '/docs/build/tech-stack',
      desc: `What we buy: the libraries and infrastructure we standardise on (Kotlin, Temporal, Quarkus, Oracle, OkHttp, Jackson), each with the alternatives we weighed and why the winner won.`,
    },
    {
      term: 'Core Build',
      to: '/docs/build/core-build',
      desc: `What we write: the Router, and how our own code is organised into workflows, stages, activities and clients, with the rules that keep those layers honest.`,
    },
    {
      term: 'API Spec',
      to: '/docs/build/api-spec',
      desc: `The contracts: One-Data's functions at the edge, the two apps' REST APIs behind them, what the Router refuses, and the Market Onboarding API.`,
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

## Coding agents

Much of billpay-core will be written with coding agents, so the codebase ships skills that teach an agent the same guardrails a person works within:

- The layer rules: a workflow sees stages, a stage sees activity interfaces, and only an activity reaches a client. The module graph enforces them, so a breach doesn't compile.
- Workflow and stage code stays deterministic: no clock, no I/O and no unstable ordering, so a payment replays the same way on any worker.
- Oracle is reached only through the stores, such as `PaymentStore` for payment state, with every write insert-if-absent or guarded on the current state.
- Classes are named for their jobs, and a market's own class carries its market code at the front.
- A change brings its tests, and updates the checked-in reports, such as the stage report, in the same pull request.

Temporal code, from workflows and activities to workers and Schedules, is written and reviewed with the `temporal-developer` skill from the Temporal plugin. Whatever an agent writes still goes through the same [CI checks](../deployment/ci-checks.md) and [code review](../deployment/code-merge-strategy.md) as anyone else's.

How billpay-core ships is under [Deployment](../deployment/index.md).
