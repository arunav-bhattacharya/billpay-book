---
title: Introduction
description: "Billpay is American Express's platform for running customer bill payments, mostly credit card payments."
---

import Lead from '@site/src/components/Lead';

# Welcome to the Billpay Wiki

<Lead>Billpay is **American Express's platform for running customer bill payments**, mostly credit card payments. It takes a payment from the moment a customer submits it to the moment the money settles, and every Amex system that asks where a payment stands gets the same answer.</Lead>

A payment passes through a handful of layers on its way in, and each one has a single job. Once you know which layer you're looking at, you know which page to read.

| Layer | What it does | Where to read |
| --- | --- | --- |
| **One-Data Functions** | The versioned contracts that channels and partners call, such as `CreatePayment.v3` | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Billpay Core APIs** | The REST endpoints behind the gateway, such as `POST /payments` | [API Spec › Billpay Core](build/api-spec/billpay-core.md) |
| **Billpay Router** | A library inside the core APIs and the dispatchers. It admits the request (422 when the market isn't live), picks the journey, pins a plan key and places the work on a cluster | [Design › Routing](design/routing.md) |
| **Temporal Workflows** | One durable workflow per journey: on the Online cluster when a caller is waiting, on the Offline cluster when nobody is | [Design › Workflows](design/component-model/workflows/index.md) |
| **Stages** | One business step each, such as Verify or Execute. The only layer that changes with a market's behaviors | [Design › Stages](design/component-model/stages.md) |
| **Activities** | The calls to one system, grouped as `{System}Activities`. Oracle is reached only through `PaymentStore` | [Design › Activities](design/component-model/activities.md) |
| **Clients** | The adapter for one external system's contract | [Build › Clients](build/principles/core-build/clients.md) |
| **Event Handlers** | Events from other platforms, held in One-Data's inbox. A return waits there until the returns dispatcher pulls it. Settlement and Accounts Receivable (AR) posting wait until a payment, or a leg of a split payment, has both, and Billpay then marks it `PAID` | [API Spec › One-Data](build/api-spec/one-data.md) |
| **Schedules** | Start the dispatchers, which release dated work and pull work waiting in One-Data's inbox at the rate the governor sets, and the periodic jobs | [Build › Schedules](build/schedules.md) |

## How to read these docs

Start with [Vision](vision/index.md). It covers why the platform exists and how the team thinks about it, in about ten minutes of reading.

After that, the path depends on what you need.

- If you work on the product, read the [Payment Journeys](design/journeys/index.md). They follow a payment from the channel a customer starts in to the money settling. Then read the [Architecture Overview](architecture/overview.md) for the shape of the system around it.
- If you bring new markets onto Billpay, read [Market Onboarding](onboarding/index.md). It covers how a market is described, released and switched on in each environment.
- If you write the code, start with the same [Payment Journeys](design/journeys/index.md), then go into the [Workflows](design/component-model/workflows/core.md) and the [Build section](build/index.md).
- If you run Billpay, read [Observability](observability/index.md) for what to watch, then [Operations](operations/index.md) for the tools and procedures.

## Conventions

- States are written in `UPPER_SNAKE_CASE`, for example `PENDING`, `ACCEPTED`, `PROCESSED`.
- Workflows are named `{Verb}{Object}Workflow`, such as `ExecuteScheduledPaymentWorkflow`.
- Stages are named for the step they perform: a `VerifyStage` interface, with implementations named for the behavior they handle, such as `MandateVerifyStage`.
- Activities are grouped per system as `{System}Activities`, such as `ClearingActivities`. Clients are `{System}Client`.
- A workflow ID is the payment ID plus a suffix, such as `{paymentId}-execute`, so any payment can be found from its ID alone.
- The state and sequence diagrams are [Mermaid](https://mermaid.js.org/), so you can copy one straight into Confluence or another Mermaid host. The system maps, journey maps and the legacy estate map are React components, and those only render here.

:::tip
Pages are markdown. Adding a page, a Mermaid diagram or a table takes no React. Only the shared visual components do.
:::
