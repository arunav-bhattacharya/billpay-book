---
title: Architecture Overview
sidebar_label: Overview
---

import Lead from '@site/src/components/Lead';
import LayerStack from '@site/src/components/LayerStack';

export const GROUPS = [
  {
    label: 'Entry',
    accent: 'var(--amex-blue)',
    layers: [
      {
        title: 'Channels & Upstream',
        role: 'Where requests and async events start',
        icon: 'channels',
        items: ['Customer & servicing channels', 'AR platform', 'Third-party inbound', 'Async events (RTF)'],
      },
      {
        title: 'One-Data Functions',
        role: 'Versioned API gateway',
        icon: 'gateway',
        items: [
          'CreatePayment.v3',
          'UpdatePayment.v1',
          'DeletePayment.v1',
          '...',
        ],
      },
    ],
  },
  {
    label: 'Core',
    accent: 'var(--amex-temporal)',
    layers: [
      {
        title: 'Billpay Core APIs & Router',
        role: 'The REST surface, and the choice of which workflow runs',
        icon: 'router',
        items: ['REST APIs', 'Date routing', 'Single / multi-instruction', 'Behaviors'],
      },
      {
        title: 'Workflows',
        role: 'Durable orchestration on Temporal',
        icon: 'workflow',
        items: ['Workers', 'Core', 'Composite', 'Periodic'],
      },
      {
        title: 'Components',
        role: 'Composed per market behaviors',
        icon: 'components',
        items: ['Stages', 'ActivityGroups', 'Activities', 'Clients'],
      },
    ],
  },
  {
    label: 'External',
    accent: 'var(--amex-platinum)',
    layers: [
      {
        title: 'External Systems',
        role: 'Where the money and the side effects land',
        icon: 'external',
        items: ['Clearing', 'Accounts Receivable', 'Authorization / OTB', 'Accounting', 'Audit', 'Risk', 'Comms', 'Allocations'],
      },
    ],
  },
];

export const ASIDE = {
  title: 'Async Event Handlers & Schedules',
  role: 'Async outcomes and periodic sweeps come back in',
  accent: 'var(--amex-cat-architecture)',
  icon: 'async',
  items: ['Money movement', 'AR posting', 'OTB updates', 'Periodic sweeps'],
  connectorLabel: 'async events & schedules loop back to Workflows',
};

# Architecture Overview

<Lead>Billpay sits in three tiers: what callers talk to, what Billpay runs, and what sits outside it. A request travels down the stack. Async outcomes and scheduled sweeps come back in at the workflow layer.</Lead>

## A layered architecture

<LayerStack groups={GROUPS} aside={ASIDE} />

## Layer responsibilities

### UI and API layer

- Requests start at the customer and servicing channels, the Accounts Receivable platform, and third parties pushing money in. Async systems such as RTF trigger work here too.
- One-Data Functions are the contracts upstream integrates with. They are versioned, so `CreatePayment.v3` keeps working while what sits behind it changes.
- The functions do none of the work themselves. Each one delegates to a Billpay core API. Every function and the endpoint it delegates to is listed in [Build → API Spec](../build/api-spec/one-data.md).

### Billpay Core layer

- The core REST APIs shape the request. Duplicates are caught on the way in against an idempotency record, so a retried call cannot pay twice.
- The router picks the workflow. It reads the payment date (today runs now, a future date gets scheduled), whether the request carries one instruction or several, and the request type: create, update, cancel, return, inbound, or intent. It then fetches the stages that match the market's behaviors and passes them into the workflow it starts. [Design → Routing](../design/routing.md) has the full map of trigger to workflow.
- Workflows are the durable part. Each runs on one of two Temporal worker pools, split by whether an end user is waiting for the answer. [Design → Workflows](../design/component-model/workflows/index.md) shows the two pools and what runs on each.
- A workflow never calls an external system itself. It composes components instead, in a strict order: **Workflow → Stage → ActivityGroup → Activity → Client → external system**. What each layer is responsible for, and the rules on what it may call, are in [Design → Principles](../design/principles.md).

### External systems

- Clearing moves the money out to the bank.
- Accounts Receivable reduces the statement balance and Authorization raises open-to-buy. For a generic payment these run in parallel with clearing.
- Once the payment is processed, accounting, audit and balance control, risk, and customer communications are all told. Comms goes last.
- Corporate payments fetch their allocations first, then run one split per allocation.

### Event handlers and schedules

- Event handlers take async outcomes back in: money movement for returns and settlement, Accounts Receivable posting, and open-to-buy updates. Each writes to the external-events tracker, which is what lets a payment close out to `PAID`. The handlers are listed in [Build → API Spec → One-Data Functions](../build/api-spec/one-data.md).
- Temporal Schedules drive the periodic Offline workflows in waves. Which schedule fires which workflow is in [Design → Periodic Workflows](../design/component-model/workflows/periodic.md).

## Why Temporal

We looked at several durable execution engines and picked Temporal as the best fit for long-running business processes. The layering above rests on four of its guarantees.

- Money movement must not lose state across restarts, deploys, or downstream outages. A workflow replays from its event history back to a deterministic state, so we never hand-rolled a checkpoint table.
- A payment scheduled months out is a workflow waiting on a timer. There is no cron plus poll glue around it.
- Downstream systems flap, clearing is often batch, and a corporate payment waits on an *AllocationsReceived* signal before it continues. Retries, timers, signals, and queries are all Temporal primitives, so none of that is ours to build.
- Temporal requires deterministic workflow code. That constraint is why the work is factored the way it is: workflows orchestrate, activities do the I/O.
