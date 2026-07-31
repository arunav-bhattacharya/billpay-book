---
title: Design Principles
sidebar_label: Principles
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design Principles

<Lead>The design keeps **business decisions separate from transport and infrastructure**. A payment is handled by five layered components, each with a single responsibility and a strict rule about what it may call.</Lead>

## The component model

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Workflow',
      desc: 'Orchestrates one complete journey: a payment, a refund, or a return. It sequences the business decision points and owns no external-system mapping.',
    },
    {
      term: 'Stage',
      desc: (
        <>
          A single state-transition decision point such as <code>InitiatedToPendingStage</code>. It is a Kotlin class with one function that does the validation, persistence, and publication for that transition. It consumes one state and emits the next.
        </>
      ),
    },
    {
      term: 'ActivityGroup',
      desc: 'Coordinates a set of related business actions: validation, lifecycle-event publication, balance updates. Named for the concern, not the mechanism.',
    },
    {
      term: 'Activity',
      desc: 'One retryable business action, such as publishing an event, persisting a record, reading an option, or updating a downstream balance. It stays thin and leaves protocol mapping to Clients.',
    },
    {
      term: 'Client',
      desc: "Encapsulates communication with one external system; translates between Billpay's payment language and that system's contract.",
    },
  ]}
/>

## Call rules

Work flows in one direction, **Workflow → Stage → ActivityGroup → Activity → Client → external system**, and each layer may only call the layers beneath it.

| Component | May call | Must not call |
| --- | --- | --- |
| **Workflow** | Workflows, Stages, ActivityGroups, Activities | Clients, external systems |
| **Stage** | ActivityGroups, Activities | Workflows, other Stages, Clients, external systems |
| **ActivityGroup** | Activities | Workflows, Stages, other ActivityGroups, Clients, external systems |
| **Activity** | Clients | Workflows, Stages, ActivityGroups, other Activities, external systems |
| **Client** | other Clients, external systems | Workflows, Stages, ActivityGroups, Activities |

## Naming conventions

| Component | Naming |
| --- | --- |
| **Workflow** | `{Market}InitiatePaymentWorkflow` |
| **Stage** | `{From}To{To}Stage`, for example `InitiatedToPendingStage` |
| **ActivityGroup** | `{Responsibility}ActivityGroup` |
| **Activity** | `{Action}Activity` / `{Action}ActivityImpl` |
| **Client** | `{System}Client` |

## Composition, not inheritance

- There is **one workflow per journey** and no alternate implementations of it. A workflow is composed from different **Stage** and **ActivityGroup** implementations, never subclassed. Workflows and Stages are never `abstract`.
- The market's dimensions select the implementation. A profile is a combination of `accountType`, `requiresArPosting`, `requiresRealtimeClearing`, and `requiresMandateAuthorization`, and at runtime that combination maps to the right Stage and ActivityGroup implementations.
- Every Stage and ActivityGroup has a default implementation per combination. A combination a market has not onboarded has no implementation at all, so the workflow is rejected before it starts.
- Implementations are **named for the behaviour they encode, not the market**, so a rule several markets share is written once.
- The same Activity is reused across markets and stays thin. Callers pass only the fields it needs, never the full `Payment` object, and set the retry and timeout options per call.
