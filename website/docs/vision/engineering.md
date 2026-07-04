---
title: Engineering Vision
sidebar_label: Engineering
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Engineering Vision

<Lead>Billpay is a **Temporal-orchestrated, configuration-driven platform**: each payment runs as a **durable, resumable workflow**, while the behavior that differs by market or account type lives in the components a workflow composes — not in the workflow itself.</Lead>

## Core engineering principles

- **Separation of concerns.** A payment is layered — Workflow → Stage → ActivityGroup → Activity → Client — so business sequencing, state transitions, retryable actions, and external calls each live in exactly one place.
- **One workflow, many implementations.** There is a single workflow per journey; market and account-type variation comes from swappable stage and activity-group implementations, composed rather than inherited.
- **Durable execution.** Each payment is a Temporal workflow with durable state, retries, timers, and signals — it survives failures and long waits, and never loses its place.
- **Idempotent and auditable.** Every entry point is idempotency-checked, and every state transition is persisted and published as a lifecycle event.
- **Configuration-driven change.** Market behavior is resolved at runtime from dimensions and profiles, and contracts are versioned — so change lands through configuration, not edits to a live orchestration.

## How we run

Workflows execute on one of two Temporal workers:

- **Online Worker** — runs workflows triggered by an end user (customer, representative) that **await a response** — e.g. Create Immediate Payment, Update Payment, Cancel Payment, Create Payment Intent.
- **Offline Worker** — runs workflows triggered **asynchronously** by events or async systems (such as RTF, the Reliable Transaction Framework) or by a scheduler, where **no end user is waiting** — e.g. Execute Scheduled Payment, Process Inbound Payment, Process Returned Payment, and the periodic workflows.

Some workflows (e.g. Create Schedule Payment, Execute Split Payment, Create Balance Refund) can run on either worker, depending on where in the journey they're invoked.

Around the workers:

- **One-Data Functions** are the API gateway between channels and the platform; a **Billpay Router** sits between the core APIs and the workflows and, based on the instructions, date, and dimensions, routes each request to the right workflow.
- **Temporal Schedules** drive the periodic (Offline) workflows — the scheduled-payment executor, corporate-allocations processor, representment executor, paid- and missing-paid-events processors, and the data purger.
- **Event handlers** absorb downstream events — money movement (returns/settlement), Accounts-Receivable posting, and Open-To-Buy updates — recording them so the right workflow can advance.

## What we optimize for

<Highlights
  items={[
    {
      term: 'Correctness',
      desc: `Idempotency checks on entry points; deterministic, replay-safe workflows. Wrong is worse than slow.`,
    },
    {
      term: 'Traceability',
      desc: `Every state transition is persisted and published as a lifecycle event; a payment is followable from entry, through its workflow, stages, and activities, to each downstream system.`,
    },
    {
      term: 'Latency',
      desc: `Trigger clearing, AR, and OTB in parallel and run them realtime where the market and rails support it; let asynchronous outcomes arrive as events rather than blocking.`,
    },
    {
      term: 'Change safety',
      desc: `New markets and rules land through dimensions, profile mapping, and workflow versioning — never by editing a live orchestration.`,
    },
    {
      term: 'Reliability',
      desc: `Durable Temporal execution with retries and signals; periodic sweeps reconcile settlement and catch missing events.`,
    },
  ]}
/>

## What we're explicitly NOT building

Mirroring the [Product Vision's out-of-scope boundaries](./product.md#out-of-scope), the platform integrates with the systems that own these domains rather than replacing them:

- **A ledger or balance system of record.** Statement balances (Accounts Receivable) and Open-To-Buy (Authorization) are owned elsewhere; Billpay notifies and updates them.
- **A clearing or settlement network.** Billpay sends payments to the funding bank for clearing and tracks settlement; the networks move the funds.
- **A custom orchestration framework.** Billpay uses Temporal's native workflows, activities, signals, and schedules instead of a proprietary engine.
- **The downstream fulfillment domains.** Accounting, balance-and-control/audit, risk, and customer communications remain their own systems that Billpay notifies.
- **The customer-facing channels.** Channels call Billpay through One-Data Functions; the app, web, and servicing experiences are owned upstream.
