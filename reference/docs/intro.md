---
id: intro
title: Introduction
sidebar_position: 1
slug: /intro
---

# Welcome to Billpay Wiki

BillPay is **Amex's enterprise platform for executing and orchestrating customer bill payments** across products and services, primarily credit card payments. It manages the end-to-end payment lifecycle — including initiation, validation, money movement, posting, settlement, and downstream financial updates. The platform ensures reliable fund transfer from customer bank accounts while maintaining synchronized payment state and operational visibility across enterprise domains.

This site captures every moving part of that journey:

| Layer | What it is | Where to read |
| --- | --- | --- |
| **One-Data Functions** | The public, contract-level entry-points (e.g. `CreatePayment.v3`) | [One-Data Functions](build/api-spec/one-data.md) |
| **Billpay Core APIs** | REST endpoints exposed by Billpay-core (`POST /payments`, …) | [Billpay APIs](build/api-spec/billpay-core.md) |
| **Billpay Router** | Lightweight routing layer that picks the right workflow | [Architecture › Components](architecture/components.md) |
| **Temporal Workflows** | Long-running, durable orchestrations (realtime + batch) | [Workflows › Core](design/workflows/core.md) |
| **Payment Services** | Business-rule units that compose activities; the place where market / account variance lives | [Payment Services](design/services.md) |
| **Temporal Activities** | The reusable I/O units invoked by services — calls to clearing, AR, OTB, DB writes, notifications | [Build › Core Build › Activities](build/principles/core-build/temporal-activities.md) |
| **Event Handlers** | Async consumers of money-movement / posted / OTB events | [Event Handlers](design/workflows/event-handlers.md) |
| **Schedules** | Temporal Schedules that drive cron-style batch executors | [Scheduled Workflows](design/workflows/scheduled.md) |

## How to read these docs

- **Start with [Vision](vision/index.md)** — the *why* (product) and *how we think about it* (engineering) in under 10 minutes.
- **For product.** Read the [Architecture Overview](architecture/overview.md)
  and the [State Diagram](design/diagrams/state-diagram.md). Together they give you a
  full mental model.
- **For engineers.** Start with the [API → Workflow journey](design/journeys/apis.md)
  for an end-to-end view, then drill into individual
  [Workflows](design/workflows/core.md) and the
  [Payment Services](design/services.md) reference.

## Conventions

- States are written in `UPPER_SNAKE_CASE` — e.g. `PENDING`, `ACCEPTED`, `PROCESSED`.
- Workflow names use the `#NameWF` hashtag style: `#CreateImmediatePaymentWF`.
- Service names end in `Service`: `PaymentRepresentmentEligibilityService`.
- All diagrams on this site are written in [Mermaid](https://mermaid.js.org/) and
  render natively — you can copy them straight into Confluence or another Mermaid host.

:::tip
Every page on this site is markdown + Mermaid only. You can drop new diagrams,
flows or services in via PR without touching React.
:::
