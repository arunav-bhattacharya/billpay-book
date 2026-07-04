---
title: Engineering Vision
sidebar_label: Engineering
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Engineering Vision

<Lead highlight>Billpay runs each payment as a **durable, resumable workflow on Temporal**, and keeps the parts that differ by market or account type in small, swappable components rather than in the workflow itself. One workflow describes the journey; configuration decides how each step behaves.</Lead>

## The shape of the system

Three things make up the platform: the **APIs** that take requests in, the **workflows** that carry each payment from received to settled, and the **event handlers** that bring asynchronous outcomes back.

- **APIs — the way in.** Amex's channels never call Billpay directly. They call **One-Data Functions** — versioned, stable gateway contracts, one per operation, such as creating a payment, updating or cancelling one, or registering a payment intent. Each function delegates to Billpay's core REST APIs. A **Billpay Router** then reads the request — its instructions, its date, and the market's dimensions — and decides which workflow to run.
- **Workflows — the orchestration.** Each payment runs as a workflow: an ordered set of steps that takes it from received to settled, assembled from four smaller kinds of component, each with one job:
  - **Stage** — one state transition, for example pending to accepted. A stage does the validation, persistence, and event publication for that single move.
  - **ActivityGroup** — a cohesive set of actions for one concern, for example everything involved in executing a payment.
  - **Activity** — a single retryable action, such as writing a database row or calling one downstream system.
  - **Client** — the adapter that actually talks to an external system.
- **Event handlers — the way back.** Much of a payment's life happens after the caller already has an answer — the bank settles the funds, Accounts Receivable posts the payment, an Open-To-Buy update lands, or the payment is returned days later. Event handlers take those events in and record them so the owning workflow can move forward: a return event starts the return workflow, and a payment is marked `PAID` only once both its settlement and its AR-posted events have arrived.

The workflow only sequences the business steps. The difference between markets is *which implementation* of a stage or activity group runs, chosen from the market's dimensions. That is why there is one Create Immediate Payment workflow, not one per market. The Design section covers the model in full.

## Core principles

- **One workflow, many implementations.** A single workflow per journey. Market and account-type differences come from swapping stage and activity-group implementations, composed together rather than inherited.
- **Durable execution.** Every payment is a Temporal workflow, and its progress is saved as it goes. It survives process restarts, host failures, and long waits — a scheduled payment may sit for weeks — and always resumes exactly where it left off. Nothing is lost, and nothing runs twice.
- **Idempotent entry points.** Every request is checked for a duplicate before it does anything, so the same payment submitted twice becomes one payment, not two.
- **Auditable by construction.** Every state transition is persisted and published as a lifecycle event, so a payment's whole history can be reconstructed after the fact.
- **Change through configuration.** New markets and rules arrive as dimensions and profiles, and contracts are versioned. Change lands as configuration, not as edits to a running orchestration.

## How it runs

Workflows execute on one of two Temporal **workers**, divided by whether someone is waiting for the answer:

- **Online worker** — runs the workflows a person is waiting on, where the response goes straight back to the caller: Create Immediate Payment, Update Payment, Cancel Payment, Create Payment Intent.
- **Offline worker** — runs everything triggered asynchronously, where no one is blocked: Execute Scheduled Payment, Process Inbound Payment, Process Returned Payment, and the periodic sweeps. Work reaches it through events (for example from RTF, the Reliable Transaction Framework) or through a scheduler.

<div className="runs-note">

:::note

- A few workflows — Create Schedule Payment, Execute Split Payment, Create Balance Refund — run on either worker, depending on where in the journey they are called.
- The Offline worker also carries the periodic work, driven by **Temporal Schedules**: the scheduled-payment executor, the corporate-allocations processor, the representment executor, the paid- and missing-paid-events processors, and the data purger.

:::

</div>

## What we optimize for

<Highlights
  items={[
    {
      term: 'Correctness',
      desc: 'A payment must be right before it is fast. Idempotency checks stop duplicates, and Temporal workflows are deterministic and replay-safe, so re-running one reaches the same result.',
    },
    {
      term: 'Traceability',
      desc: 'Every state transition is persisted and published, so any payment can be followed from its entry point, through its workflow, stages, and activities, to each downstream system it touches.',
    },
    {
      term: 'Latency',
      desc: 'Where the market allows, clearing, AR, and Open-To-Buy are triggered together and run in realtime; slower outcomes come back later as events instead of blocking the caller.',
    },
    {
      term: 'Change safety',
      desc: 'A new market or rule is a new set of dimensions, a profile mapping, and workflow versioning. No one edits a live orchestration to onboard it.',
    },
    {
      term: 'Reliability',
      desc: 'Durable Temporal execution with retries and signals, backed by periodic sweeps that reconcile settlement and catch events that never arrived.',
    },
  ]}
/>
