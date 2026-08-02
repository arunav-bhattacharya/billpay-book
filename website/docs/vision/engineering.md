---
title: Engineering Vision
sidebar_label: Engineering
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import CompositionMap from '@site/src/components/CompositionMap';
import Principles from '@site/src/components/Principles';

export const BEHAVIORS = [
  {
    name: 'requiresArPosting',
    ask: 'Should the cardmember get credit before the money settles?',
    answers: ['Y', 'N'],
  },
  {
    name: 'requiresRealtimeClearing',
    ask: 'Should clearing happen in realtime?',
    answers: ['Y', 'N'],
  },
  {
    name: 'requiresMandateAuthorization',
    ask: 'Should a mandate be verified?',
    answers: ['Y', 'N'],
  },
  {
    name: 'representableReturn',
    ask: 'Can a returned payment be re-attempted?',
    answers: ['Y', 'N'],
  },
];

export const RUN = {
  title: 'Workflows',
  note: 'Composed for the profile, then started. Each journey has one workflow, and it is the same one in every market.',
};

# Engineering Vision

<Lead>Billpay runs each payment as a **durable, resumable workflow on Temporal**, and keeps the parts that differ by market or account type in small, swappable components rather than in the workflow itself. One workflow describes the journey. The market's configuration decides how each step behaves.</Lead>

## The moving parts

<Highlights
  items={[
    {
      term: 'The Gateway',
      desc: `Amex channels call Billpay's One-Data Functions, and the Billpay Router sends each request to a workflow based on the behaviors configured for that market.`,
    },
    {
      term: 'Core Workflows',
      desc: `One workflow carries the payment from received to settled, with every step composed from the market's profile before the workflow starts.`,
    },
    {
      term: 'Event Handlers',
      desc: (
        <>
          Settlement, Accounts Receivable posting, and returns come back later as events. Event
          handlers feed them to the workflow, and the payment is <code>PAID</code> once settlement
          and posting have both confirmed.
        </>
      ),
    },
  ]}
/>

A workflow is built from four kinds of part:

- A **stage** does one state transition, pending to accepted for instance, with the validation, persistence, and events for that move.
- An **activity group** gathers the actions behind one concern, such as executing a payment.
- An **activity** is a single retryable action: one database write, one downstream call.
- A **client** is the adapter that talks to an external system.

The gateway contracts are in [Build → API Spec](../build/api-spec/one-data.md), the routing rules in [Design → Routing](../design/routing.md), and the component model in [Design → Principles](../design/principles.md).

## Core principles

<Principles
  items={[
    {
      title: 'Profile driven market onboarding',
      body: 'A market is onboarded by choosing the APIs it turns on and answering the behavior questions. Those answers become its profiles, so a new market lands as configuration rather than code.',
    },
    {
      title: 'Single workflow per journey',
      body: 'Each journey has one workflow and no alternate versions of it. Differences between markets and account types come from swapping the stages and activity groups underneath.',
    },
    {
      title: 'Behavior driven workflow composition',
      body: (
        <>
          The behaviors on the request pick the stage and activity group implementations, and the
          workflow is composed with them before it starts, so the run itself holds no market logic.
          Composition over inheritance, so workflows and stages are never <code>abstract</code>.
        </>
      ),
    },
    {
      title: 'Durable execution',
      body: 'Every payment runs as a Temporal workflow, and Temporal saves its progress as it goes. A scheduled payment can sit for weeks, survive restarts and host failures, and resume exactly where it left off.',
    },
    {
      title: 'Idempotent entry',
      body: 'Every request is checked for a duplicate before anything happens, so the same payment submitted twice becomes one payment, not two.',
    },
    {
      title: 'Deterministic workflows',
      body: 'Workflow code decides only from what Temporal has recorded, never from the clock or a random draw, so a replay follows the same path and lands the same result.',
    },
    {
      title: 'Idempotent activities',
      body: 'Temporal retries an activity until it succeeds, so each one is written to be safe to run more than once. A repeated write or downstream call lands the same result rather than a second one.',
    },
    {
      title: 'Auditable execution',
      body: "Every state transition is written to the database and published as a lifecycle event, so a payment's whole history can be reconstructed after the fact.",
    },
    {
      title: 'Multi-layer resiliency',
      body: 'One-Data parks requests in Redis and replays them when the core returns, and RTF retries anything it could not deliver. Temporal keeps every workflow history, so a run resumes where it stopped. Oracle Data Guard holds a standby copy of the data.',
    },
  ]}
/>

## Market Onboarding to Workflow Composition

Onboarding a market to Billpay is pure configuration. The UI collects two things: which One-Data APIs the market exposes, and a set of yes/no questions about payment handling. These questions are answered per supported account type, since consumer and corporate rules differ, creating a unique market profile for each combination.

At runtime, Billpay uses this profile to resolve the exact stage and activity implementations needed, composing the workflow before execution. Because all market-specific logic is handled during assembly, the runtime engine remains market-agnostic and executes the same standardized steps everywhere. See the [Product Vision](./product.md) for behavior definitions.

<CompositionMap
  apis={['CreatePayment.v3', 'UpdatePayment.v1', 'DeletePayment.v1']}
  behaviors={BEHAVIORS}
  run={RUN}
/>

:::info[When a profile is not onboarded]
If the combination on a request was never onboarded, there is nothing to compose, so the request is turned away and no workflow starts. A consumer-only market rejects a corporate payment instead of half-processing it.
:::

A new way of processing is a new implementation sitting behind one combination of behaviors. The workflow keeps its shape, and no market ever turns into an `if` inside it.

## What we optimise for

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
      desc: 'Where the market allows, clearing, AR, and Open-To-Buy are triggered together and run in realtime. Slower outcomes come back later as events instead of blocking the caller.',
    },
    {
      term: 'Change safety',
      desc: 'A new market or rule is a new set of behaviors, a profile mapping, and workflow versioning. No one edits a live orchestration to onboard it.',
    },
    {
      term: 'Reliability',
      desc: 'Durable Temporal execution with retries and signals, backed by periodic sweeps that reconcile settlement and catch events that never arrived.',
    },
  ]}
/>
