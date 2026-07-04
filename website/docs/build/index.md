---
title: Build
---

import Lead from '@site/src/components/Lead';

# Build

<Lead>How Billpay is actually put together in code — the gateway and REST contracts requests arrive on, the monorepo that hosts the platform, the workflow and activity definitions, the data it persists, and the schedules that drive the periodic work.</Lead>

Where [Design](../design/index.md) describes the model — the lifecycle states, the component layering, the per-workflow logic — this section is the engineering view of the same platform: the packages, contracts, and conventions a developer works with.

- **[Principles](./principles/index.md)** — how the platform is built on Temporal.
- **[One-Data Functions](./one-data.md)** — the API gateway functions at the edge.
- **[Billpay-core](./billpay-core/index.md)** — the monorepo that hosts the workflows, activities, and REST APIs.
- **[API Spec](./api-spec/index.md)** — the One-Data function and core REST contracts.
- **[Data Model](./data-model/index.md)** — the domain and the tables that persist a payment.
- **[Workflows](./workflows/index.md)** and **[Activities](./activities/index.md)** — how the component model is expressed in code.
- **[Schedules](./schedules.md)** — the Temporal Schedules that drive the periodic workflows.

The shipped, deployable artifacts and how each is released are covered under [Deployment](../deployment/index.md).
