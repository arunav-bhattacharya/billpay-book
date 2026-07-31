---
title: Design
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Design

<Lead>Design sets out the **precise model** behind the platform: the components a workflow composes, the canonical states a payment moves through, and the logic behind every transition.</Lead>

## Pages in this section

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Principles',
      to: '/docs/design/principles',
      desc: `The five layered components, what each one is responsible for, and the call, naming, and composition rules that keep business decisions apart from transport.`,
    },
    {
      term: 'Payment State Model',
      to: '/docs/design/payment-state-model',
      desc: `The canonical lifecycle states a payment moves through, what each one means, and which states a consumer or corporate payment can reach.`,
    },
    {
      term: 'Journeys',
      to: '/docs/design/journeys',
      desc: `Each payment followed end to end, from the channel a customer starts in, or the event that fires, to the money settling.`,
    },
    {
      term: 'Component Model',
      to: '/docs/design/component-model',
      desc: `What exists at each layer: every workflow, the stages those workflows sequence, and the activity groups the stages call.`,
    },
    {
      term: 'Database',
      to: '/docs/design/database',
      desc: `The tables that hold payment state and its audit trail, and which of them each part of the lifecycle writes to.`,
    },
    {
      term: 'Diagrams',
      to: '/docs/design/diagrams',
      desc: `The state diagrams per workflow and the sequence diagrams for the end-to-end flows, drawn from the spec.`,
    },
  ]}
/>
