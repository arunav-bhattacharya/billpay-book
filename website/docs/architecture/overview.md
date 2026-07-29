---
title: Architecture Overview
sidebar_label: Overview
---

import Lead from '@site/src/components/Lead';
import LayerStack from '@site/src/components/LayerStack';

export const GROUPS = [
  {
    label: 'UI & API Layer',
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
          'ReadPayments.v1',
          'ReadPaymentEventsById.v1',
          'CreateCreditBalanceRefund.v1',
          'CreateInboundPayment.v1',
        ],
      },
    ],
  },
  {
    label: 'Billpay Core Layer',
    accent: 'var(--amex-temporal)',
    layers: [
      {
        title: 'Billpay Core APIs & Router',
        role: 'The REST surface, and the choice of which workflow runs',
        icon: 'router',
        items: ['REST APIs', 'Date routing', 'Single / multi-instruction', 'Dimensions'],
      },
      {
        title: 'Workflows',
        role: 'Durable orchestration on Temporal',
        icon: 'workflow',
        items: ['Workers', 'Core', 'Composite', 'Periodic'],
      },
      {
        title: 'Components',
        role: 'Composed per market dimensions',
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

### UI & API Layer

- Requests start at the customer and servicing channels, the Accounts Receivable platform, and third parties pushing money in. Async systems such as RTF trigger work here too.
- One-Data Functions are the contracts upstream integrates with. They are versioned, so `CreatePayment.v3` keeps working while what sits behind it changes.
- The functions do none of the work themselves. Each one delegates to a Billpay core API.

### Billpay Core Layer

- The core REST APIs shape the request. Duplicates are caught on the way in against an idempotency record, so a retried call cannot pay twice.
- The router picks the workflow. It reads the payment date (today runs now, a future date gets scheduled), whether the request carries one instruction or several, and the request type: create, update, cancel, return, inbound, or intent.
- It also fetches the stages that match the market's dimensions and passes them into the workflow it starts.
- Workflows are the durable part. Each one runs on one of two Temporal workers:

  <div className="workerTable">

  | Worker | Trigger | Examples |
  | --- | --- | --- |
  | Online | An end user is awaiting a response | `CreateImmediatePaymentWF`, `UpdatePaymentWF`, `CancelPaymentWF`, `CreatePaymentIntentWF` |
  | Offline | Async: events, async systems (RTF), or a scheduler | `ExecuteScheduledPaymentWF`, `ProcessInboundPaymentWF`, `ProcessReturnedPaymentWF`, the periodic workflows |

  </div>

- A workflow never calls an external system itself. It composes components instead: Stages take the payment from one state to the next, ActivityGroups hold a set of related business actions, Activities are single retryable actions, and Clients adapt to one external system each.
- Which implementations a workflow gets comes from the market's dimensions. The call rules are covered in the Design section.

### External

- Clearing moves the money out to the bank.
- Accounts Receivable reduces the statement balance and Authorization raises open-to-buy. For a generic payment these run in parallel with clearing.
- Once the payment is processed, accounting, audit and balance control, risk, and customer communications are all told. Comms goes last.
- Corporate payments fetch their allocations first, then run one split per allocation.

### Async edges

- Event handlers take async outcomes back in: money movement for returns and settlement, Accounts Receivable posting, and open-to-buy updates. Each writes to the external-events tracker, which is what lets a payment close out to `PAID`.
- Temporal Schedules drive the periodic Offline workflows in waves: the scheduled-payment executor, the corporate-allocations processor, the paid and missing-paid event processors, and the data purger.

## Why Temporal

Billpay is built on Temporal. We looked at several of the durable execution engines on the market and picked Temporal: for orchestrating long-running business processes it is among the best available. The layering above leans on its guarantees:

- **Durability & replay.** Money movement must not lose state across restarts, deploys, or downstream outages. A workflow replays from its event history to a deterministic state, so there are no hand-rolled checkpoint tables.
- **Long-running flows are first-class.** A payment scheduled months out is just a workflow waiting on a timer, with no cron-plus-poll glue around it.
- **Native retries, timers, signals, queries.** Downstream systems flap, clearing is often batch, and a corporate payment waits on an *AllocationsReceived* signal before it continues. All of that is a Temporal primitive.
- **Determinism as discipline.** Temporal requires deterministic workflow code, which is exactly why work is factored into stages and activities: workflows orchestrate, activities do the I/O.

Continue to [A Closer Look](./components.md) for each block in turn.
