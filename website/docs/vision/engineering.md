---
title: Engineering Vision
sidebar_label: Engineering
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import CompositionMap from '@site/src/components/CompositionMap';
import Principles from '@site/src/components/Principles';

export const DIMENSIONS = [
  {
    name: 'accountType',
    ask: 'Whose account is being paid?',
    answers: ['CONSUMER', 'CORPORATE', 'BUSINESS_TRAVEL'],
  },
  {
    name: 'requiresArPosting',
    ask: 'Should the payment be posted to Accounts Receivable?',
    answers: ['yes', 'no'],
  },
  {
    name: 'requiresRealtimeClearing',
    ask: 'Should clearing happen in realtime?',
    answers: ['yes', 'no'],
  },
  {
    name: 'requiresMandateAuthorization',
    ask: 'Should a mandate be verified?',
    answers: ['yes', 'no'],
  },
];

export const RUN = {
  title: 'Workflows',
  note: 'Composed for the profile, then started. Each journey has one workflow, and it is the same one in every market.',
};

# Engineering Vision

<Lead highlight>Billpay runs each payment as a **durable, resumable workflow on Temporal**, and keeps the parts that differ by market or account type in small, swappable components rather than in the workflow itself. One workflow describes the journey. The market's configuration decides how each step behaves.</Lead>

## The main parts

Three things make up the platform: the APIs that take requests in, the workflows that carry each payment from received to settled, and the event handlers that bring asynchronous outcomes back.

<Highlights
  items={[
    {
      term: 'The way in',
      desc: `Amex's channels never call Billpay directly. They call One-Data Functions, the versioned gateway contracts, one per operation: create a payment, update or cancel one, register a payment intent. Each function delegates to Billpay's core REST APIs. A Billpay Router then reads the request, its instructions, its date, and the market's dimensions, and decides which workflow to run.`,
    },
    {
      term: 'The orchestration',
      desc: `Each payment runs as a workflow: an ordered set of steps that takes it from received to settled. The workflow sequences the business steps and nothing else. Which implementation of each step runs is settled from the market's dimensions before the workflow starts.`,
    },
    {
      term: 'The way back',
      desc: (
        <>
          Much of a payment's life happens after the caller already has an answer. The bank settles
          the funds, Accounts Receivable posts the payment, an Open-To-Buy update lands, or the
          payment is returned days later. Event handlers take those events in and record them so the
          owning workflow can move forward. A return event starts the return workflow, and a payment
          is marked <code>PAID</code> only once both its settlement and its AR-posted events have
          arrived.
        </>
      ),
    },
  ]}
/>

A workflow is assembled from four kinds of part. A **stage** carries out one state transition, pending to accepted for instance, and does the validation, persistence, and event publication for that single move. An **activity group** gathers the actions behind one concern, such as everything involved in executing a payment. An **activity** is a single retryable action, like writing a database row or calling one downstream system. A **client** is the adapter that talks to the external system. The Design section covers the model in full.

## Core principles

<Principles
  items={[
    {
      title: 'One workflow per journey',
      body: 'A single workflow describes each journey, and there are no alternate versions of it. Market and account-type differences come from swapping stage and activity group implementations underneath it.',
    },
    {
      title: 'Composed from the dimensions on the request',
      body: (
        <>
          Stages and activity groups are built per dimension combination. The combination on the
          request picks the implementations when the workflow is composed and started, so the run
          itself holds no market logic. Composition over inheritance, so workflows and stages are
          never <code>abstract</code>.
        </>
      ),
    },
    {
      title: 'Markets onboard by configuration',
      body: 'A new market is the APIs it turns on plus the answers it gives, which become one or more profiles. Contracts are versioned, so change lands as configuration rather than as edits to a running orchestration.',
    },
    {
      title: 'Durable execution',
      body: 'Every payment is a Temporal workflow, and Temporal saves its progress as it goes. It survives process restarts, host failures, and long waits, since a scheduled payment may sit for weeks, and it resumes exactly where it left off. No step is lost and no step runs twice.',
    },
    {
      title: 'Idempotent entry points',
      body: 'Every request is checked for a duplicate before it does anything, so the same payment submitted twice becomes one payment, not two.',
    },
    {
      title: 'Auditable by construction',
      body: "Every state transition is persisted and published as a lifecycle event, so a payment's whole history can be reconstructed after the fact.",
    },
  ]}
/>

## Composable Workflows

Markets come onto the platform through configuration. Someone picks the One-Data APIs the market will use, then answers a few questions about how it processes payments. Those selections build a profile for that market and account type, held as one combination of dimensions.

The profile is what composes the workflow. When a request arrives, Billpay reads the dimensions on it, resolves them to the implementations onboarded for that combination, and starts the workflow with those parts already in place. All of that happens before the run begins, so the workflow itself carries no market logic. It runs the same sequence of business steps everywhere.

<CompositionMap
  apis={[
    'CreatePayment.v3',
    'UpdatePayment.v1',
    'DeletePayment.v1',
    'CreateInboundPayment.v1',
    'CreatePaymentIntent.v1',
    'CreateCreditBalanceRefund.v1',
  ]}
  dims={DIMENSIONS}
  run={RUN}
  footnote={
    <>
      If the combination on a request was never onboarded, there is nothing to compose, so the
      request is turned away and no workflow starts. A consumer-only market rejects a corporate
      payment instead of half-processing it.
    </>
  }
/>

A new variant is a new implementation behind one combination. The workflow keeps its shape, and no market ends up as a branch inside it.

## Optimize for

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
      desc: 'A new market or rule is a new set of dimensions, a profile mapping, and workflow versioning. No one edits a live orchestration to onboard it.',
    },
    {
      term: 'Reliability',
      desc: 'Durable Temporal execution with retries and signals, backed by periodic sweeps that reconcile settlement and catch events that never arrived.',
    },
  ]}
/>
