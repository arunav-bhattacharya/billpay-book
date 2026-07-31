---
title: Workflows
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Workflows

<Lead>A workflow orchestrates one payment journey end to end. Every workflow runs on Temporal, falls into one of three kinds, and executes on the Online or Offline worker depending on whether an end user is waiting for it.</Lead>

## The two workers

- The **Online worker** runs workflows an end user is waiting on: an immediate payment, an update, a cancellation, a payment intent.
- The **Offline worker** runs everything triggered asynchronously: scheduled execution, inbound payments, returns, and the periodic sweeps.

Three workflows run on either worker, depending on where in the journey they are called: Create Schedule Payment, Execute Split Payment, and Create Balance Refund.

## Pages in this section

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Core',
      to: '/docs/design/component-model/workflows/core',
      desc: `Triggered per request: create, update, cancel, execute, return, represent, allocate. Each one carries the worker it runs on and the dimensions it varies by.`,
    },
    {
      term: 'Composite',
      to: '/docs/design/component-model/workflows/composite',
      desc: `Wrap one or more core workflows and add logic that spans domains, such as installments or a payment carrying multiple instructions.`,
    },
    {
      term: 'Periodic',
      to: '/docs/design/component-model/workflows/periodic',
      desc: `Scheduler driven and run in waves: executing scheduled payments, processing allocations and representments, closing out paid events, and purging old data.`,
    },
  ]}
/>
