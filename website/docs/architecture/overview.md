---
title: Architecture Overview
sidebar_label: Overview
---

import Lead from '@site/src/components/Lead';
import LayerStack from '@site/src/components/LayerStack';

# Architecture Overview

<Lead>Billpay is layered so each tier has **one responsibility** and can evolve independently. A request flows top-to-bottom; async events loop back in through event handlers.</Lead>

## The system map

<LayerStack
  layers={[
    {
      n: '01',
      title: 'Channels & upstream',
      role: 'Where requests and async events originate',
      accent: '#6f7c8f',
      items: ['Customer & servicing channels', 'AR platform', 'Third-party / inbound', 'Async events (RTF)'],
    },
    {
      n: '02',
      title: 'One-Data Functions',
      role: 'Versioned API gateway',
      accent: '#016fd0',
      items: [
        {label: 'CreatePayment.v3', code: true},
        {label: 'UpdatePayment.v1', code: true},
        {label: 'DeletePayment.v1', code: true},
        {label: 'CreateInboundPayment.v1', code: true},
      ],
    },
    {
      n: '03',
      title: 'Billpay Core APIs',
      role: 'REST surface · idempotency at the boundary',
      accent: '#0090cf',
      items: [
        {label: 'POST /payments', code: true},
        {label: 'PUT /payments/{id}', code: true},
        {label: 'DELETE /payments/{id}', code: true},
        {label: 'POST /refunds', code: true},
      ],
    },
    {
      n: '04',
      title: 'Billpay Router',
      role: 'Picks the workflow from date, instructions & dimensions',
      accent: '#c69214',
      items: ['date routing', 'single / multi-instruction', 'dimensions → stages'],
    },
    {
      n: '05',
      title: 'Temporal Workflows',
      role: 'Durable orchestration',
      accent: '#34519e',
      items: ['Online worker', 'Offline worker', 'Core · Composite · Periodic'],
    },
    {
      n: '06',
      title: 'Component model',
      role: 'Composed per market dimensions',
      accent: '#0e7c86',
      items: ['Stages', 'ActivityGroups', 'Activities', 'Clients'],
    },
    {
      n: '07',
      title: 'Downstream systems',
      role: 'Where the money and side-effects land',
      accent: '#6f7c8f',
      items: ['Clearing', 'Accounts Receivable', 'Authorization / OTB', 'Accounting', 'Audit', 'Risk', 'Comms', 'Allocations'],
    },
    {
      loop: true,
      title: 'Event Handlers & Schedules',
      role: 'Async outcomes and periodic sweeps loop back into workflows',
      accent: '#016fd0',
      items: ['Money movement', 'AR posting', 'OTB updates', 'Periodic sweeps'],
    },
  ]}
/>

## Layer responsibilities

**1. Channels & upstream** — where every request and async event originates: customer and servicing channels, the Accounts-Receivable platform, third-party (inbound) senders, and async systems such as RTF.

**2. One-Data Functions** — the contract-level gateway upstream integrates with. Versioned and stable (for example `CreatePayment.v3`); they delegate to the core APIs.

**3. Billpay Core APIs** — the REST surface (`POST /payments`, `PUT /payments/{payment-id}`, `POST /refunds`, …). They shape the request and enforce idempotency at the boundary.

**4. Billpay Router** — decides **which workflow to run**, from the payment date (today → immediate, future → scheduled), single- vs. multi-instruction, and the request type (create, update, cancel, return, inbound, intent). It fetches the market's dimension-specific stages and passes them to the workflow.

**5. Temporal Workflows** — the durable orchestration. Each flow runs on one of two workers:

| Worker | Trigger | Examples |
| --- | --- | --- |
| **Online** | An end user is awaiting a response | `CreateImmediatePaymentWF`, `UpdatePaymentWF`, `CancelPaymentWF`, `CreatePaymentIntentWF` |
| **Offline** | Async — events, async systems (RTF), or a scheduler | `ExecuteScheduledPaymentWF`, `ProcessInboundPaymentWF`, `ProcessReturnedPaymentWF`, the periodic workflows |

**6. Component model** — a workflow never talks to an external system directly. It composes **Stages** (state-transition decision points), **ActivityGroups** (cohesive business concerns), **Activities** (single retryable actions), and **Clients** (adapters to a downstream system), selected from the market's dimensions. The detailed call rules are covered in the Design section.

**7. Downstream systems** — where the money and side-effects land: clearing, Accounts Receivable, Authorization (Open-To-Buy), accounting, audit / balance-and-control, risk, communications, and allocations.

**Async edges — Event Handlers & Schedules** *(the dashed loop-back)* — event-driven One-Data functions bring async outcomes back in (money movement for returns/settlement, Accounts-Receivable posting, Open-To-Buy updates); **Temporal Schedules** drive the periodic Offline workflows in waves — the scheduled-payment executor, corporate-allocations processor, representment executor, the paid- and missing-paid-events processors, and the data purger.

## Persistence, briefly

Billpay keeps a payment's **current state** and an **append-only lifecycle-event log** (with split-level equivalents for allocations), guards duplicate requests with an **idempotency** record at the API boundary, tracks the **external events** — clearing-settlement and AR-posted — that close a payment out to `PAID`, and records the **outbound notifications** it owes. The full data model is covered in Design and Build.

## Why Temporal

Billpay is intentionally **Temporal-first** — the layering above leans on Temporal's guarantees:

- **Durability & replay.** Money movement must not lose state across restarts, deploys, or downstream outages. A workflow replays from its event history to a deterministic state — no hand-rolled checkpoint tables.
- **Long-running flows are first-class.** A payment scheduled months out is just a workflow waiting on a timer — no cron-plus-poll glue.
- **Native retries, timers, signals, queries.** Downstream systems flap, clearing is often batch, and a corporate payment waits on an *AllocationsReceived* signal before it continues — all Temporal primitives.
- **Determinism as discipline.** Temporal requires deterministic workflow code, which is exactly why work is factored into stages and activities: workflows orchestrate, activities do the I/O.

Continue to [Components](./components.md) for a closer look at each block.
