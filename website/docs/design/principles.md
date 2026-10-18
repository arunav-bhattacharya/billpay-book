---
title: Design Principles
description: 'Billpay keeps business decisions apart from transport. Four layers handle every journey, each with one job and a strict rule about what it may call.'
sidebar_label: Principles
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design Principles

<Lead>Billpay keeps business decisions apart from transport. Four layers handle every journey, each with one job and a strict rule about what it may call.</Lead>

The layers exist so that a difference between markets lives in exactly one place. If one market verifies a mandate before it processes a payment and another doesn't, that difference is a stage implementation, `MandateVerifyStage`. The workflow above it and the activities below it stay the same in both markets.

## Eight rules behind every choice

When a design choice is unclear, these rules decide it.

1. Oracle is the source of truth. Every status change is a conditional update that applies only if the status is still what the writer expects. Whoever loses backs off.
2. Work that waits for a date waits in Oracle, as a Work Tracker row. It never waits in a sleeping workflow or on a Temporal timer.
3. Nothing calls across clusters. Oracle is the only hand-off between the Online and Offline clusters.
4. Every payment workflow starts through the Router. No API or dispatcher starts one on its own. Control workflows (the dispatchers, the governor and provisioning) start from Schedules or their own APIs.
5. Pace at the door. Admit only what a cluster and its downstream systems can carry. Big bursts wait in Oracle or in One-Data's inbox, not in Temporal.
6. One workflow per journey. Stages are the only thing that varies by market behavior, so there are no market-specific workflows.
7. One Oracle commit per stage. A stage makes its calls first, in parallel where they don't depend on each other, then commits the state change and its timeline entry together. Its lifecycle event (RTF) and, where the customer is told, its message (Raven) go out right after the commit. Fulfil is the exception: `PROCESSED` waits for both.
8. Pin the plan and the build at start. A running workflow never has its code or its config changed under it.

## The four layers

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Workflow',
      desc: `Runs one journey, such as paying today or executing a scheduled payment. It decides the order of the steps and holds no market logic.`,
    },
    {
      term: 'Stage',
      desc: `One business step: its calls in parallel, then one Oracle commit. It returns its outcome, and it is the only layer that varies by behavior.`,
    },
    {
      term: 'Activity',
      desc: (
        <>
          The calls to one system, on that system's task queue. Every Oracle read and write goes through one of them, <code>PaymentStore</code>.
        </>
      ),
    },
    {
      term: 'Client',
      desc: `Talks to one external system and maps its contract onto Billpay's own language.`,
    },
  ]}
/>

A stage returns its outcome, so the workflow never has to pick between stages for different outcomes. Verify, for example, returns `ACCEPTED`, `SCHEDULED` or `DECLINED`, and the workflow carries on or stops.

## Call rules

Work flows one way: workflow, stage, activity, client, external system. Nothing calls up or sideways, so a stage never calls another stage, an activity never calls another activity, and a client never calls another client.

| Layer | May call | Must not call |
| --- | --- | --- |
| Workflow | Stages; child workflows on its own cluster | Activities, clients, external systems, anything on the other cluster |
| Stage | Activities; plain helper functions | Workflows, other stages, clients, external systems |
| Activity | Clients | Workflows, stages, other activities, external systems |
| Client | Its one system | Other clients, workflows, stages, activities |

## Naming

| Layer | Name | Lives in |
| --- | --- | --- |
| Workflow | `{Verb}{Object}Workflow`, such as `ExecuteScheduledPaymentWorkflow` | `core/lib/workflows/impl/` |
| Stage | A `{Step}Stage` interface, named for the journey step. Implementations are named for the behavior they encode, such as `MandateVerifyStage` | `core/lib/stages/impl/`; a market override in `market/{m}/stages/` |
| Activity | `{System}Activities`, such as `ClearingActivities`. Oracle reads and writes are in `PaymentStore` | `core/lib/activities/` and `impl/` |
| Client | `{System}Client` | `core/lib/clients/` |

Naming an implementation for its behavior rather than its market means a rule that several markets share is written once.

## Composition, not inheritance

- There is one implementation of each workflow. A workflow is composed from stage implementations and never copied per market.
- Workflows and stages are never `abstract`.
- Activities are shared across markets. Callers pass IDs, not payment objects, and an activity loads what it needs. Data from Payment Options and Payment Instruments is the exception: what a stage gets there, clear text included, travels in the workflow to the later calls that need it, and workflow history keeps it encrypted by the payload codec.

## How a workflow finds its stages

A workflow is never handed its stages. When the Router starts it, the Router pins a **plan key**: the market, the journey, the market's behaviors resolved for that journey, and the version of the market's config. The market is in the key so a market override can match (Proposed). The workflow reads its plan key and looks up its stage implementations at runtime.

The lookup uses an index built at compile time with KSP (Kotlin Symbol Processing). It maps each combination of behaviors to its stage implementations, and the most specific match wins, so a market override beats the default for that market. [Routing](./routing.md#from-profile-to-stages) follows one profile through to the stages it runs.

- Every combination has a default implementation. A combination with no implementation can't be onboarded, and a request for a combination a market hasn't onboarded gets 422 before any workflow starts.
- The same index produces the build's **capability manifest**, the list of every combination the build can run. Provisioning checks each market release against it (see [Market Profile](../onboarding/market-profile.md)).
- Payment workflows are pinned to their build with Worker Versioning, and the plan key carries the config version. A deploy never changes the code under a running payment, and a new market release never changes its config.

## Writing a step that is safe to repeat

Temporal retries work that fails, and sometimes work that didn't. A local activity runs again if its worker dies mid-task, and any activity can be retried after a timeout even when its call went through. So every step is written to be safe twice:

- Every HTTP call carries an idempotency key, such as `{paymentId}-{step}`.
- Every Oracle write is insert-if-absent, or a conditional update on the current state.
- Search attributes are set once, at start. There are no signals or queries on the hot path.

The [Component Model](./component-model/index.md) lists what exists at each layer. The [Payment State Model](./payment-state-model.md) shows the states those stages move a payment between.
