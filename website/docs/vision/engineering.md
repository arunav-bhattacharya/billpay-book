---
title: Engineering Vision
description: 'Billpay runs each payment as a durable workflow on Temporal, and keeps everything that differs by market or account type in small, swappable stages.'
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
    answers: ['Y', 'N', 'BOTH'],
  },
  {
    name: 'requiresRealtimeClearing',
    ask: 'Should clearing happen in real time?',
    answers: ['Y', 'N', 'BOTH'],
  },
  {
    name: 'requiresMandateAuthorization',
    ask: 'Should a mandate be verified?',
    answers: ['Y', 'N', 'BOTH'],
  },
  {
    name: 'requiresBankConfirmation',
    ask: 'Should the customer confirm their bank first?',
    answers: ['Y', 'N', 'BOTH'],
  },
];

export const SETTINGS = [
  'Execution time',
  'Cancellation window',
  'Cutoff',
  'Allocation fetch',
  'Bank confirmation window',
  'Representment rules',
  'Expected volumes',
];

export const STEPS = [
  {
    via: 'approved and frozen as',
    title: 'A release, vN',
    note: 'Each environment checks it against the build, sends test payments through it and waits for sign-off before activating it.',
  },
  {
    via: 'read by the Router into',
    title: 'A plan key, pinned when the payment starts',
    note: 'The journey, the behaviors resolved for it (BOTH becomes Y or N) and the config version.',
  },
  {
    via: 'picks the stages of',
    title: 'The workflow',
    note: 'One per journey, the same in every market. A running payment keeps the key it started with.',
  },
];

# Engineering Vision

<Lead>Billpay runs each payment as a **durable workflow on Temporal**, and keeps everything that differs by market or account type in small, swappable stages. One workflow describes the journey. The market's release decides how each step behaves.</Lead>

Two problems shape almost every decision on this page. The first is variety. Every market pays a little differently, and the old answer was a version of the code per market, which turned each new market into a project. The second is timing. A customer paying now expects an answer in well under a second, while a million scheduled payments can fall due at the same midnight. Billpay answers the first with stages chosen from configuration, and the second with two Temporal clusters and a pace set from live load.

## The moving parts

<Highlights
  items={[
    {
      term: 'The Gateway and Router',
      desc: `Channels call Billpay's One-Data Functions. Behind them, the Billpay Router admits each request, picks its journey and places it on the Online or the Offline cluster.`,
    },
    {
      term: 'The Workflows',
      desc: `One workflow per journey, the same in every market. It looks up its stages at runtime from the plan key the Router pinned when it started.`,
    },
    {
      term: 'Dispatchers and the governor',
      desc: `Work due on a later date waits in Oracle, and work nobody waits for waits in One-Data's inbox. Dispatchers release both into the Offline cluster at the rate the governor sets from live load.`,
    },
    {
      term: 'The Event Handlers',
      desc: (
        <>
          Settlement, Accounts Receivable posting and returns come back later as events, often in
          bursts, and One-Data holds them in its own inbox. Dispatchers pull returns, inbound payments
          and bulk intake from Accounts Receivable at the governor's pace. A periodic job marks payments
          (a split payment leg by leg) <code>PAID</code> in batches once both confirmations are in.
        </>
      ),
    },
  ]}
/>

A workflow is built from three kinds of part:

- A **stage** is one business step, such as Verify or Execute. It makes its calls in parallel, then commits the result in one transaction. Stages are the only part that changes with a market's behaviors.
- An **activity** is the set of calls to one system, such as `ClearingActivities`. Oracle has one of its own, `PaymentStore`, the only code that reads or writes the payments database.
- A **client** is the adapter that talks to one external system.

The gateway contracts are in [Build → API Spec](../build/api-spec/one-data.md), the routing rules in [Design → Routing](../design/routing.md), and the component model in [Design → Principles](../design/principles.md).

## Core principles

<Principles
  items={[
    {
      term: 'Release-driven market onboarding',
      desc: `Onboarding a market is picking the APIs it takes, answering its behavior questions with Y, N or BOTH, and filling in its operations settings, once per account type. The result ships as a frozen release that each environment checks, tests and signs off. A market whose answers already have implementations behind them goes live on configuration alone.`,
    },
    {
      term: 'One workflow per journey',
      desc: `A journey has one workflow, and there is no second copy kept for the awkward market. What differs between markets and account types is the stages underneath, and nothing else.`,
    },
    {
      term: 'Stages chosen from the plan key',
      desc: (
        <>
          When the Router starts a payment it pins a plan key: the journey, the behaviors resolved for
          it and the market's config version. The workflow looks up its stage implementations from that
          key, most specific match first, so no market decision is left in the workflow code. Worker
          Versioning pins the workflow to the build it started on, so neither a deploy nor a new release
          changes a payment already running. Nothing is inherited: workflows and stages are never{' '}
          <code>abstract</code>.
        </>
      ),
    },
    {
      term: 'Dated work waits in Oracle',
      desc: `A payment due next week is a row in Oracle until then, not a workflow sleeping on a timer. On the day, a dispatcher releases it, which keeps Temporal's database for work that is actually running.`,
    },
    {
      term: 'Two clusters, one hand-off',
      desc: `Journeys where a caller waits run on the Online cluster, and work that can be paced runs on the Offline cluster. Each has its own database, so offline load can never slow realtime traffic inside Temporal. Nothing calls across them: a row in Oracle, written in the same commit as the state change, is the only hand-off.`,
    },
    {
      term: 'Pace at the door',
      desc: `Billpay admits only what a cluster and the systems behind it can carry. Big bursts wait outside Temporal: dated work in Oracle, and everything nobody waits for in One-Data's inbox. A governor resets every offline rate every 15 seconds from online response times, database load and downstream health, protecting online traffic first.`,
    },
    {
      term: 'One commit per stage',
      desc: (
        <>
          A stage makes its calls first, then writes its new state and the entry in the payment's
          timeline in one Oracle transaction. Its lifecycle event and customer message go out straight
          after, and Temporal retries them until they land. Fulfil sends them before its commit
          instead: a payment counts as <code>PROCESSED</code> only once the customer has been told and
          RTF has the event.
        </>
      ),
    },
    {
      term: 'Idempotent at every step',
      desc: `Every request writes an idempotency key before any work starts, every downstream call carries one, and every Oracle write is insert-if-absent or a conditional update on the current state. A retry, a replay or a worker dying mid-step leaves the same result as the first attempt, so money never moves twice.`,
    },
    {
      term: 'Durable, deterministic execution',
      desc: `Temporal records each step as it happens, so a payment in flight survives deploys and lost hosts and carries on from the step it reached. Workflow code decides only from what Temporal recorded, never from the wall clock or a random number, so a replay takes the same path to the same state.`,
    },
    {
      term: 'Multi-layer resiliency',
      desc: `No single layer is trusted to stay up. One-Data parks requests in Redis and replays them when the core is back, and the Reliable Transaction Framework (RTF) keeps retrying an event it could not deliver. Temporal holds the workflow history, each cluster has a standby in another region, and Oracle Data Guard keeps a standby copy of the data.`,
    },
  ]}
/>

## From onboarding to a running workflow

A market reaches the platform as configuration. In the Market Onboarding UI the team picks the One-Data APIs the market takes, answers the behavior questions and fills in the operations settings, once per account type, because consumer and corporate rules differ. A second person approves it, and it becomes a frozen release.

Each environment then provisions that release on its own. It checks every combination against what the deployed build can run, saves it inactive, sends test payments through it and waits for sign-off. Once the release is active, the Router uses it for every new payment: it resolves the behaviors for the journey, so a BOTH becomes Y or N, and pins them with the config version in the plan key. The workflow picks its stages from that key. What each behavior means is on the [Product Vision](./product.md).

<CompositionMap
  apis={['CreatePayment.v3', 'UpdatePayment.v1', 'DeletePayment.v1']}
  behaviors={BEHAVIORS}
  settings={SETTINGS}
  steps={STEPS}
/>

:::info[When a combination isn't onboarded]
If a request needs a combination the market never onboarded, there are no stages to pick, so the Router turns it away with a 422 before any workflow starts. A consumer-only market rejects a corporate payment instead of half-processing it.
:::

A new way of processing a payment is a new stage implementation behind one combination of behaviors. The workflow keeps its shape, and no market ever turns into an `if` inside it.

## Optimize for

<Principles
  items={[
    {
      term: 'Correctness',
      desc: `A payment has to be right before it is fast. Duplicates are caught before any work begins, and every status change is a guarded update, so when a cancel and the payment's execution race at the edge of the cancellation window, exactly one of them wins.`,
    },
    {
      term: 'Traceability',
      desc: `Any payment can be traced from its ID alone. Every workflow ID is the payment ID plus a suffix, the payment's timeline records each step and the cluster it ran on, and each workflow's trace links back to the one that queued it.`,
    },
    {
      term: 'Latency',
      desc: `The caller waits only for the decision. The workflow answers as soon as Verify has accepted or declined the payment, then carries on with clearing, Accounts Receivable and Open-To-Buy (the amount the cardmember can still spend) in parallel. Online journeys have a cluster of their own, so a midnight batch never sits in front of them.`,
    },
    {
      term: 'Change safety',
      desc: `Onboarding a market is a reviewed, versioned release, tested in each environment before it goes live. The code that runs a live payment doesn't change when a market is added, and a payment already running keeps its build and its config until it finishes.`,
    },
    {
      term: 'Reliability',
      desc: `Hosts restart, downstream systems go quiet and Oracle gets patched, and a payment survives all three. Temporal resumes the workflow where it stopped, PaymentStore waits out a database outage instead of failing, and a periodic sweep chases any payment still short of PAID after 48 hours, asking the clearing and AR systems again before it raises an alert.`,
    },
    {
      term: 'Efficiency',
      desc: `Every write to Temporal's database is capacity the midnight run needs. A stage makes its calls in parallel and commits once, and the database calls run as local activities, so an executed payment costs an estimated 45 writes, a figure the first load test is there to confirm.`,
    },
  ]}
/>
