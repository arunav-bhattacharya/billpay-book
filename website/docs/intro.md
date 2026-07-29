---
title: Introduction
---

import Lead from '@site/src/components/Lead';

# Welcome to the Billpay Wiki

<Lead>Billpay is **American Express's enterprise platform for executing and orchestrating customer bill payments** — primarily credit-card payments. It manages the end-to-end payment lifecycle: initiation, validation, money movement, posting, settlement, and the downstream financial updates, keeping payment state synchronized and visible across enterprise domains.</Lead>

This site captures every moving part of that journey:

| Layer | What it is | Where to read |
| --- | --- | --- |
| **One-Data Functions** | The public, contract-level entry points (e.g. `CreatePayment.v3`) | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Billpay Core APIs** | The REST endpoints behind the gateway (`POST /payments`, …) | [API Spec › Billpay Core](build/api-spec/billpay-core.md) |
| **Billpay Router** | Picks the right workflow from the request's date, instructions, and dimensions | [Architecture › A Closer Look](architecture/components.md) |
| **Temporal Workflows** | Long-running, durable orchestrations on the Online and Offline workers | [Design › Workflows](design/workflows/index.md) |
| **Stages** | One state transition each — the decision points a workflow sequences | [Design › Stages](design/stages.md) |
| **ActivityGroups & Activities** | The reusable I/O units — clearing calls, AR posting, DB writes, notifications | [Design › ActivityGroups & Activities](design/activities.md) |
| **Event Handlers** | Async consumers of money-movement, AR-posted, and Open-To-Buy events | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Schedules** | Temporal Schedules that drive the periodic executors | [Build › Schedules](build/schedules.md) |

## How to read these docs

- **Start with [Vision](vision/index.md)** — the *why* (product) and *how we think about it* (engineering) in under ten minutes.
- **For product.** The [Payment Journeys](design/journeys/index.md) show what happens to a payment end to end, from the channel a customer starts in to the money settling. Pair them with the [Architecture Overview](architecture/overview.md) for the full mental model.
- **For engineers.** Start with the same [Payment Journeys](design/journeys/index.md) for the end-to-end view, then drill into the [Workflows](design/workflows/core.md) and the [Build section](build/index.md) for how it's all put together.

## Conventions

- States are written in `UPPER_SNAKE_CASE` — e.g. `PENDING`, `ACCEPTED`, `PROCESSED`.
- Workflow names end in `WF`: `CreateImmediatePaymentWF`.
- Stages are named `{From}To{To}Stage`; activity groups end in `ActivityGroup`; activities end in `Activity`.
- All diagrams on this site are written in [Mermaid](https://mermaid.js.org/) and render natively — you can copy them straight into Confluence or another Mermaid host.

:::tip
Every page on this site is markdown + Mermaid (plus a few small shared components). You can add pages, diagrams, and flows via PR without touching React.
:::
