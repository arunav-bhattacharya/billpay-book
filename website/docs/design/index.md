---
title: Design
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design

<Lead>Design turns the platform's shape into a **precise model** — the components a workflow composes, the canonical states a payment moves through, and the logic that drives every transition.</Lead>

## What Design covers

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'A layered component model',
      desc: (
        <>
          Five components — <strong>Workflow → Stage → ActivityGroup → Activity → Client</strong> — each with one responsibility and a strict rule about what it may call.
        </>
      ),
    },
    {
      term: 'One canonical state model',
      desc: 'The lifecycle states every payment moves through, whatever the market or account type.',
    },
    {
      term: 'Composition over branching',
      desc: 'One workflow per journey; market and account-type variation comes from swapping stage and activity-group implementations, selected by dimensions.',
    },
    {
      term: 'Diagrams from the spec',
      desc: 'State and sequence diagrams generated from the lifecycle states and the end-to-end flows.',
    },
  ]}
/>

## Explore

- **[Principles](./principles.md)** — the component model and its call, naming, and composition rules.
- **[Payment state model](./payment-state-model.md)** — the canonical lifecycle states and what each means.
- **[Journeys](./journeys/index.md)** — how a request or a schedule routes to a workflow.
- **[Workflows](./workflows/index.md)** — the per-workflow logic (core, composite, periodic).
- **[Stages](./stages.md)** — the state-transition steps a workflow composes.
- **[ActivityGroups & Activities](./activities.md)** — the retryable actions the stages call.
- **[Database](./database.md)** — the tables that hold payment state and its audit trail.
- **[Diagrams](./diagrams/index.md)** — the state and sequence diagrams.
