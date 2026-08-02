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
      term: 'The Workflows',
      desc: `One workflow carries the payment from received to settled, with every step composed from the market's profile before the workflow starts.`,
    },
    {
      term: 'The Event Handlers',
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
      body: 'Onboarding a market is picking the APIs it exposes and answering a short list of questions about how it pays, once per account type it supports. Those answers become its profiles, and a market whose answers already have implementations behind them arrives as configuration rather than code.',
    },
    {
      title: 'Single workflow per journey',
      body: 'A journey has one workflow, and there is no second copy of it kept for the awkward market. What differs between markets and account types is the stages and activity groups underneath.',
    },
    {
      title: 'Behavior driven workflow composition',
      body: (
        <>
          The behaviors on the request choose the stage and activity group implementations, and the
          workflow is handed those parts before it starts. By the time it runs there is no market
          decision left in it. Nothing is inherited: workflows and stages are never{' '}
          <code>abstract</code>.
        </>
      ),
    },
    {
      title: 'Durable execution',
      body: `Temporal records each step as it happens, so a payment does not live in a process's memory. One scheduled for a future date waits through deploys and lost hosts, then carries on from the step it had reached.`,
    },
    {
      title: 'Check Idempotency',
      body: 'Every request writes an idempotency key before any work starts. A second submit hits the duplicate and gets the first payment back, so a retry on a dropped connection never moves the money twice.',
    },
    {
      title: 'Deterministic workflows',
      body: 'Workflow code decides from what Temporal recorded, never from the wall clock or a random number. Replay it on another host a week later and it takes the same path to the same state.',
    },
    {
      title: 'Idempotent activities',
      body: 'Temporal retries an activity until it succeeds, and an activity that timed out after its work landed will run again. Each one is written for that, so a second write or a second downstream call leaves the same result as the first.',
    },
    {
      title: 'Auditable execution',
      body: `Every state transition is written to the lifecycle log and published as an event. The log is only ever appended to, so a payment's history reads back in order long after it closed.`,
    },
    {
      title: 'Multi-layer resiliency',
      body: 'No single layer is trusted to stay up. One-Data parks requests in Redis and replays them when the core is back, and the Reliable Transaction Framework (RTF) keeps retrying an event it could not deliver. Temporal holds the workflow history, so a run resumes where it stopped, and Oracle Data Guard keeps a standby copy of the data.',
    },
  ]}
/>

## Market Onboarding to Workflow Composition

A market comes onto the platform through configuration. The UI asks for two things: which One-Data APIs the market exposes, and a short list of questions about how it handles payments. Those questions are answered once per account type the market supports, because consumer and corporate rules differ. Each set of answers is one market profile.

Billpay composes the workflow from that profile before the run starts. It reads the behaviors on the request, resolves them to the stage and activity implementations onboarded for that combination, and starts the workflow with those parts already in place. Nothing about a market is decided while the workflow runs, so it executes the same business steps everywhere. What each behavior means is on the [Product Vision](./product.md).

<CompositionMap
  apis={['CreatePayment.v3', 'UpdatePayment.v1', 'DeletePayment.v1']}
  behaviors={BEHAVIORS}
  run={RUN}
/>

:::info[When a profile is not onboarded]
If the combination on a request was never onboarded, there is nothing to compose, so the request is turned away and no workflow starts. A consumer-only market rejects a corporate payment instead of half-processing it.
:::

A new way of processing a payment is a new implementation behind one combination of behaviors. The workflow keeps its shape, and no market ever turns into an `if` inside it.

## Optimize for

<Highlights
  items={[
    {
      term: 'Correctness',
      desc: 'A payment has to be right before it is fast. Duplicates are caught before any work begins, and a workflow decides only from what Temporal recorded, so re-running one lands the same result instead of a second payment.',
    },
    {
      term: 'Traceability',
      desc: 'Every state transition is written down and published as it happens. An operator asking where a payment stopped reads the trail: the states it went through, in order, and the downstream systems it had already notified.',
    },
    {
      term: 'Latency',
      desc: 'The caller does not wait for the slow parts. A payment answers as soon as it is accepted, and where the market allows it, clearing, Accounts Receivable, and Open-To-Buy (the amount the cardmember can still spend) go out together instead of one after another. Settlement comes back later as an event, and the workflow is still there to take it.',
    },
    {
      term: 'Change safety',
      desc: 'Onboarding a market is answering questions and mapping a profile. The code that runs a live payment is the same before and after, so nobody has to open a working orchestration to bring a market on.',
    },
    {
      term: 'Reliability',
      desc: 'Hosts restart and downstream systems go quiet, and a payment survives both. Temporal resumes the workflow where it stopped and retries the activity that failed. Behind that, a sweep closes out payments once settlement and posting have both arrived, and raises an alert for the events that never did.',
    },
  ]}
/>
