---
title: Design
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design

<Lead>Design sets out the **precise model** behind the platform: the components a workflow composes, the canonical states a payment moves through, and the logic behind every transition.</Lead>

## What this section covers

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'A layered component model',
      desc: (
        <>
          Five components (<strong>Workflow → Stage → ActivityGroup → Activity → Client</strong>), each with one responsibility and a strict rule about what it may call.
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

## Pages in this section

- [Principles](./principles.md) sets out the component model and its call, naming, and composition rules.
- [Payment state model](./payment-state-model.md) lists the canonical lifecycle states and what each one means.
- [Journeys](./journeys/index.md) follows each payment end to end, from the channel a customer starts in to the money settling.
- [Workflows](./workflows/index.md) covers the logic inside each workflow (core, composite, periodic).
- [Stages](./stages.md) covers the state-transition steps a workflow composes.
- [ActivityGroups & Activities](./activities.md) covers the retryable actions the stages call.
- [Database](./database.md) describes the tables that hold payment state and its audit trail.
- [Diagrams](./diagrams/index.md) collects the state and sequence diagrams.
