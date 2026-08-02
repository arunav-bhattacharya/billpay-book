---
title: Introduction
description: "Billpay is American Express's enterprise platform for executing and orchestrating customer bill payments, mostly credit card payments."
---

import Lead from '@site/src/components/Lead';

# Welcome to the Billpay Wiki

<Lead>Billpay is **American Express's enterprise platform for executing and orchestrating customer bill payments**, mostly credit card payments. It runs the whole lifecycle: initiation, validation, money movement, posting, settlement, and the financial updates that follow. Every enterprise domain that needs a payment's state can see the same version of it.</Lead>

The site is organised around the layers a payment passes through:

| Layer | What it is | Where to read |
| --- | --- | --- |
| **One-Data Functions** | The public, contract-level entry points (e.g. `CreatePayment.v3`) | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Billpay Core APIs** | The REST endpoints behind the gateway (`POST /payments`, …) | [API Spec › Billpay Core](build/api-spec/billpay-core.md) |
| **Billpay Router** | Picks the right workflow from the request's date, instructions, and behaviors | [Design › Routing](design/routing.md) |
| **Temporal Workflows** | Long-running, durable orchestrations on the Online and Offline workers | [Design › Workflows](design/component-model/workflows/index.md) |
| **Stages** | One state transition each, the decision points a workflow sequences | [Design › Stages](design/component-model/stages.md) |
| **ActivityGroups & Activities** | The reusable I/O units: clearing calls, AR posting, DB writes, notifications | [Design › ActivityGroups & Activities](design/component-model/activities.md) |
| **Event Handlers** | Async consumers of money-movement, AR-posted, and Open-To-Buy events | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Schedules** | Temporal Schedules that drive the periodic executors | [Build › Schedules](build/schedules.md) |

## How to read these docs

Start with [Vision](vision/index.md). It covers why the platform exists and how the team thinks about it, in about ten minutes of reading.

After that, the path depends on what you need.

- If you work on the product, read the [Payment Journeys](design/journeys/index.md). They follow a payment from the channel a customer starts in to the money settling. Then read the [Architecture Overview](architecture/overview.md) for the shape of the system around it.
- If you write the code, start with the same [Payment Journeys](design/journeys/index.md), then go into the [Workflows](design/component-model/workflows/core.md) and the [Build section](build/index.md).

## Conventions

- States are written in `UPPER_SNAKE_CASE`, for example `PENDING`, `ACCEPTED`, `PROCESSED`.
- Workflow names end in `WF`: `CreateImmediatePaymentWF`.
- Stages are named `{From}To{To}Stage`; activity groups end in `ActivityGroup`; activities end in `Activity`. The `{From}` half is usually a state, but in `InitiatedToPendingStage` it is the incoming request, which has no state yet.
- The state and sequence diagrams are [Mermaid](https://mermaid.js.org/), so you can copy one straight into Confluence or another Mermaid host. The system maps, journey maps, and the legacy estate map are React components, and those only render here.

:::tip
Pages are markdown. Adding a page, a Mermaid diagram, or a table takes no React. Only the shared visual components do.
:::
