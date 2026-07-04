---
title: Design Principles
sidebar_label: Principles
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design Principles

<Lead>The platform's design rests on one idea: **separate business decision-making from transport and infrastructure**. A payment is handled by five layered components, each with a single responsibility and a strict rule about what it may call.</Lead>

## The component model

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Workflow',
      desc: 'Orchestrates a complete journey — a payment, refund, or return — sequencing the business decision points. It owns no external-system mapping.',
    },
    {
      term: 'Stage',
      desc: (
        <>
          A single state-transition decision point (e.g. <code>InitiatedToPendingStage</code>) — a Kotlin class with one function doing the validation, persistence, and publication for that transition. Consumes one state, emits the next.
        </>
      ),
    },
    {
      term: 'ActivityGroup',
      desc: 'Coordinates a cohesive set of related business actions — validation, lifecycle-event publication, balance updates. Named for the concern, not the mechanism.',
    },
    {
      term: 'Activity',
      desc: 'One retryable business action — publish an event, persist a record, read an option, update a downstream balance. Thin; delegates protocol mapping to Clients.',
    },
    {
      term: 'Client',
      desc: "Encapsulates communication with one external system; translates between Billpay's payment language and that system's contract.",
    },
  ]}
/>

## Call rules

Work flows in one direction — **Workflow → Stage → ActivityGroup → Activity → Client → external system** — and each layer may only call the layer(s) beneath it:

| Component | May call | Must **not** call |
| --- | --- | --- |
| **Workflow** | Workflows, Stages, ActivityGroups, Activities | Clients, external systems |
| **Stage** | ActivityGroups, Activities | Workflows, other Stages, Clients, external systems |
| **ActivityGroup** | Activities | Workflows, Stages, other ActivityGroups, Clients, external systems |
| **Activity** | Clients | Workflows, Stages, ActivityGroups, other Activities, external systems |
| **Client** | other Clients, external systems | Workflows, Stages, ActivityGroups, Activities |

## Component Nomenclature

| Component | Naming |
| --- | --- |
| **Workflow** | `{Market}InitiatePaymentWorkflow` |
| **Stage** | `{From}To{To}Stage` — e.g. `InitiatedToPendingStage` |
| **ActivityGroup** | `{Responsibility}ActivityGroup` |
| **Activity** | `{Action}Activity` / `{Action}ActivityImpl` |
| **Client** | `{System}Client` |

## Composition, not inheritance

- **One workflow per journey.** There are no alternate implementations of a workflow — a workflow is composed from different **Stage** and **ActivityGroup** implementations, never subclassed. Workflows and Stages are never `abstract`.
- **Dimensions select the implementation.** A market's profile — its combination of dimensions (`accountType`, `requiresArPosting`, `requiresRealtimeClearing`, `requiresMandateAuthorization`) — maps automatically at runtime to the right Stage / ActivityGroup implementation. Every Stage and ActivityGroup has a default implementation per dimension combination; a combination a market hasn't onboarded simply has no implementation, and the workflow is rejected before it starts.
- **Behaviour-driven naming.** Implementations are named for the behaviour they encode, not the market — so a rule shared across markets is written once.
- **Activities are shared and thin.** The same Activity is reused across markets; callers pass only the fields it needs — never the full `Payment` object — and set the retry and timeout options per call.
