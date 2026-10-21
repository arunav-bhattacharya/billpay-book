---
title: Architecture Overview
description: 'Billpay sits in three tiers: what callers talk to, what Billpay runs, and what sits outside it.'
sidebar_label: Overview
---

import Lead from '@site/src/components/Lead';
import LayerStack from '@site/src/components/LayerStack';
import ClusterMap from '@site/src/components/ClusterMap';

export const GROUPS = [
  {
    label: 'Gateway',
    accent: 'var(--amex-blue)',
    layers: [
      {
        title: 'Channels & Upstream',
        role: 'Where requests and events start',
        icon: 'channels',
        items: ['Customer & servicing channels', 'AR platform', 'Third-party inbound', 'Allocations manager', 'Platform events'],
      },
      {
        title: 'One-Data Functions',
        role: 'Versioned API gateway, and the inbox that holds work nobody waits for',
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
        role: 'The REST surface, and the Router that admits, routes and places every payment',
        icon: 'router',
        items: ['REST APIs', 'Admission: 422 / 429', 'Journey & resolved profile', 'Run site & start'],
      },
      {
        title: 'Temporal Clusters',
        role: 'Online for callers who wait, Offline for work that can be paced',
        icon: 'workflow',
        items: ['Online cluster', 'Offline cluster', 'Dispatchers', 'Governor'],
      },
      {
        title: 'Components',
        role: 'One workflow per journey, built from stages',
        icon: 'components',
        items: ['Workflows', 'Stages', 'Activities', 'Clients'],
      },
      {
        title: 'Oracle',
        role: 'The source of truth, and the only hand-off between the clusters',
        icon: 'database',
        items: ['Payments', 'Work Tracker'],
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
        items: ['Clearing', 'Accounts Receivable', 'Authorization / OTB', 'Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'Comms (Raven)', 'Events (RTF)', 'Allocations manager', 'Bank provider'],
      },
    ],
  },
];

export const ASIDE = {
  title: 'Inbox & Schedules',
  role: 'Work nobody waits for is held in the inbox; Schedules start the dispatchers that pull it',
  accent: 'var(--amex-cat-architecture)',
  icon: 'async',
  items: ['Returns', 'Inbound', 'AR intake', 'Settlement', 'AR posting', 'Dispatchers', 'Periodic jobs'],
  connectorLabel: 'pulled work and due work come back in at the clusters',
};

# Architecture Overview

<Lead>Billpay sits in three tiers: what callers talk to, what Billpay runs, and what sits outside it. A request travels down the stack. Outcomes that arrive later, and work that falls due on a date, come back in at the clusters.</Lead>

## A layered architecture

<LayerStack groups={GROUPS} aside={ASIDE} />

## Layer responsibilities

### UI and API layer

- Requests start at the customer and servicing channels, the Accounts Receivable platform, third parties pushing money in, and the allocations manager sending a corporate payment's breakdown. Events from other platforms arrive here too.
- One-Data Functions are the contracts upstream integrates with. They are versioned, so `CreatePayment.v3` keeps working while what sits behind it changes.
- Most functions do no work of their own: each delegates to a Billpay core API. Functions for work nobody waits for are the exception. Bulk intake from Accounts Receivable, inbound payments, returns, settlement and Accounts Receivable posting are kept in One-Data's inbox, a Postgres database of its own, separate from Temporal's, and Billpay pulls them from there. Every function and the endpoint it calls is listed in [Build → API Spec](../build/api-spec/one-data.md).

### Billpay Core layer

The core REST APIs shape the request, and the payment's first step checks it against an idempotency record, so a retried call can never pay twice. Then every payment, whether a channel sent it or a dispatcher released it, starts through the **Billpay Router**. The Router is a library inside the core APIs and the dispatchers, and it runs the same six steps every time:

1. Admit the request. The market, account type and API must be live in this environment, or the answer is 422. A request a dispatcher pulled is marked `REJECTED` instead, and only operations hear of it. An allocation callback over its budget gets 429 with `Retry-After`.
2. Pick the journey from the routing table.
3. Resolve the behaviors from the market's active release. A behavior set to BOTH becomes Y or N for this journey.
4. Pin the resolved profile: the market, the journey, the resolved behaviors and the config version (the market is there so a market's own classes, such as GB's funds check, can apply).
5. Choose the run site: cluster, task queue, priority and workflow ID.
6. Start it. When a caller is waiting that means Update-With-Start: the caller gets the payment's state back, the decision once Verify has made it or `PENDING` until then, while the workflow carries on. When nobody is waiting, a dispatcher starts it at the governor's pace, as dated work falls due in Oracle or as it pulls requests from One-Data's inbox. Only an allocation callback is an async start, answered 202 once the workflow exists.

[Design → Routing](../design/routing.md) has the full map of trigger to workflow. Below the Router:

- Workflows run on one of two Temporal clusters. Online takes the journeys where someone is waiting for an answer, and Offline takes everything that can be paced. [The next section](#two-clusters-one-hand-off) shows what runs where.
- A workflow never calls an external system itself. It is built from components in a strict order, **Workflow → Stage → Activity → Client → external system**, and stages are the only layer that changes with a market's behaviors. The rules are in [Design → Principles](../design/principles.md).
- Oracle is the source of truth. Every status change is a guarded update that applies only if the status is still what the writer expected, and each stage commits its state and its timeline entry in one transaction. Oracle is also the only hand-off between the two clusters.

### External systems

- Clearing moves the money out to the customer's bank. Accounts Receivable reduces the statement balance, and Authorization raises open-to-buy. These three run in parallel in the Execute stage. Authorization needs the payment instrument's details in clear text, so its call waits for Payment Instruments to supply them.
- Accounting, balance and control (eBNC) and risk follow in the Fulfil stage, together with three notification systems that need to know a payment is done: two legacy ones, the Transaction Notification Engine (TFNE) and the legacy Payments History Database (GPHDB), and B2Notifier, which passes the news on to other downstream systems. Last of all come the customer's message (Raven) and the lifecycle event other systems consume (RTF). All eleven must succeed before the payment is `PROCESSED`.
- Every other state change sends its lifecycle event, and a customer message where one is due, straight after its commit. A workflow waits for them before its next step, so each payment's events arrive in order.
- A corporate payment asks the allocations manager for its breakdown first, and the allocations arrive by callback. Once they are all in, the payment clears once, at payment level, and each allocation then posts as a leg of its own.
- A payment the customer confirms at their bank asks the market's provider, such as Plaid in the US or Pay with Bank Transfer in the UK, for a redirect link first. The payment waits at `PENDING` until the caller confirms it, and only then is it verified and executed. The money moves at the bank, so Execute makes no clearing call.
- A debit card payment starts 3D Secure with the market's card provider first, and gives it Billpay's callback URL. The payment waits at `PENDING` until the provider calls back, then Verify authorizes it, which takes the money from the customer's account, or the card's bank declines it. Execute makes no clearing call for it either.

### Event handlers and schedules

- Event handlers take late outcomes back in, and none of them starts a workflow. A return waits in One-Data's inbox, as an inbound payment or a request from Accounts Receivable does, until its dispatcher pulls it at the governor's pace. Settlement and Accounts Receivable posting can arrive at a thousand a second, and they wait there too until a payment has both. `ProcessPaidEventsWorkflow` is started every 30 seconds unless a run is still going. It pulls up to 500 ready payments or legs at a time, at the pace the governor allows, marks each batch `PAID` in one transaction and sends their lifecycle events. A split payment turns `PAID` leg by leg: each leg once it has posted and its payment has settled. The handlers are listed in [Build → API Spec → One-Data Functions](../build/api-spec/one-data.md).
- Work that falls due on a date waits in Oracle as a Work Tracker row, and work nobody waits for waits in One-Data's inbox. One dispatcher per kind of work releases it, each with its own Schedule and budget, at rates the governor resets every 15 seconds. Three periodic jobs, for paid events, missing paid events and the purge, run on Schedules too. [Design → Periodic Workflows](../design/component-model/workflows/periodic.md) has the list.

## Two clusters, one hand-off

The split comes from one question: is anyone waiting? A cardmember paying their bill needs an answer in under a second. A million payments due at midnight need to be done by morning, and nobody is watching each one.

<ClusterMap />

- The Online cluster runs the journeys where a caller is waiting: paying today, scheduling, updating or cancelling from a channel, refunds a customer asks for, and the composite flows. A payment that waits for its customer to confirm runs there too, in one workflow from the create to the customer's answer. At its busiest the cluster handles about 100 payments a second.
- The Offline cluster runs everything that can be paced: scheduled execution, bulk intake from Accounts Receivable, corporate allocations, returns, inbound payments, representments, the periodic jobs, and the control workflows that do the pacing.
- Each cluster has its own Aurora database, so no amount of midnight work on Offline can slow a payment on Online inside Temporal. What the two share is Oracle, the downstream systems and the app that runs their workers. The governor watches online response times as well as Oracle and the downstreams, so when any of them comes under pressure, offline work slows down and online traffic doesn't.
- Nothing calls across. A payment scheduled on Online reaches Offline as a Work Tracker row, written in the same Oracle commit as its `SCHEDULED` state. On the due date a dispatcher on Offline claims the row and starts the execution there.
- One app hosts it all: the core APIs, the Router, the dispatchers, the governor and the workers for both clusters, with a Temporal client for each. Offline work gets its own Oracle connection pool and a cap on how much runs at once, so it can't crowd out online work. Where it physically runs is on [High Availability](./high-availability.md).

## Why Temporal

We looked at several durable execution engines and picked Temporal as the best fit for long-running business processes. The layering above rests on what it guarantees.

- Money movement must not lose state across restarts, deploys or downstream outages. A workflow replays from its event history back to a deterministic state, so we never hand-rolled a checkpoint table.
- A caller who is waiting gets the answer at the decision point. Update-With-Start starts the workflow and waits on one update in a single call, so a channel hears `ACCEPTED` or `DECLINED` while the workflow carries on with clearing. On the Online cluster, the calls behind that decision run as local activities, which the worker makes directly instead of queueing them through the cluster, so the answer comes out of the workflow's first step.
- Downstream systems flap and push back with 429s. Retries with backoff, a retry delay taken from `Retry-After`, rate-limited task queues, priority and fairness all come with Temporal, so none of that is ours to build.
- Schedules start the dispatchers and the periodic jobs, and Worker Versioning pins a running payment to the build it started on.
- Temporal requires deterministic workflow code. That constraint is why the work is factored the way it is: workflows orchestrate, activities do the I/O.

Waiting for a date is the one thing we keep out of Temporal. Sleeping on a timer for days costs its database real work, so a payment due next month waits in Oracle as a row, and a dispatcher starts its workflow on the day. A wait of minutes is different: a payment waiting for its customer to confirm stays in its own workflow, on a timer, so the whole wait shows in one place.
