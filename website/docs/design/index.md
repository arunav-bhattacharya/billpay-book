---
title: Design
description: 'Design is the model the code follows: the states a payment moves through, which workflow runs each journey, and how work nobody is waiting for is paced around the customers who are.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Design

<Lead>Design is the model the code follows: the states a payment moves through, which workflow runs each journey, and how work nobody is waiting for is paced around the customers who are.</Lead>

Four layers handle every journey. A **workflow** runs it, **stages** take its business steps, **activities** make the calls to one system each, and **clients** speak that system's contract. Only stages change with a market's behaviors, so adding a market rarely means new code.

In front of the workflows sits the **Billpay Router**. For every request it:

1. Admits it, or turns it away with a 422 when the market isn't live.
2. Picks the journey.
3. Resolves the market's behaviors into a **resolved profile**.
4. Places the work on the Online or Offline cluster.
5. Starts it in the right mode:
   - Update-With-Start when a caller is waiting
   - an async start for an allocations callback
   - a plain start when a dispatcher hands it work that was pulled or fell due

The pages below start with the rules and the states, then follow the moving parts.

## In this section

<SectionIndex
  items={[
    {
      term: 'Principles',
      to: '/docs/design/principles',
      desc: `The rules behind every design choice, the four layers and what each may call, how they are named, and how a resolved profile picks a market's stages.`,
    },
    {
      term: 'Payment State Model',
      to: '/docs/design/payment-state-model',
      desc: `The states every payment moves through, the stage that makes each move, and the rules for split payments and corporate parents.`,
    },
    {
      term: 'Domain Model',
      to: '/docs/design/domain-model',
      desc: `How the code turns those states into types: one class per state, 36 functions between them, and what the supplied code still needs.`,
    },
    {
      term: 'Journeys',
      to: '/docs/design/journeys',
      desc: `How a payment page becomes a journey, each journey end to end, and the complete picture of one journey through every layer.`,
    },
    {
      term: 'Routing',
      to: '/docs/design/routing',
      desc: `The Router's six steps, the start mode for each kind of request, and which workflow each trigger starts, on which cluster.`,
    },
    {
      term: 'Component Model',
      to: '/docs/design/component-model',
      desc: `Every workflow, the thirteen stages they run, and the activities those stages call.`,
    },
    {
      term: 'Pacing',
      to: '/docs/design/pacing',
      desc: `How dispatchers release dated and pulled work into the Offline cluster, and how the governor resets their rates every 15 seconds.`,
    },
    {
      term: 'Throttling',
      to: '/docs/design/throttling',
      desc: `One rate-limited queue per downstream system, what happens on a 429, and the priority and fairness keys that decide who goes first.`,
    },
    {
      term: 'Corporate Allocations',
      to: '/docs/design/corporate-allocations',
      desc: `How a corporate payment fetches its allocations before it moves money, then clears once and posts each allocation as a leg.`,
    },
    {
      term: 'Sequence Diagrams',
      to: '/docs/design/sequence-diagrams',
      desc: `Sixteen flows traced from the caller, through the Router, to the stages and the systems they call.`,
    },
  ]}
/>
