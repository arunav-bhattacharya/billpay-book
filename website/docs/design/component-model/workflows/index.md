---
title: Workflows
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import WorkerSplit from '@site/src/components/WorkerSplit';

export const WORKERS = [
  {
    name: 'Online worker',
    tone: 'online',
    waiting: 'someone is waiting',
    desc: 'Request-path workflows, where an end user is waiting for the answer.',
    items: [
      'Create Immediate Payment',
      'Update Payment',
      'Cancel Payment',
      'Create Payment Intent',
    ],
  },
  {
    name: 'Offline worker',
    tone: 'offline',
    waiting: 'nobody is blocked',
    desc: 'Everything triggered asynchronously, by events, by async systems such as RTF, or by a scheduler.',
    items: [
      'Execute Scheduled Payment',
      'Process Inbound Payment',
      'Process Returned Payment',
      'Process Representment',
      'Get Corporate Payment Allocations',
      'Periodic sweeps',
    ],
  },
];

# Workflows

<Lead>A workflow orchestrates one payment journey end to end. Every workflow runs on Temporal, falls into one of three kinds, and executes on the Online or Offline worker depending on whether an end user is waiting for it.</Lead>

## Where workflows run

Workflows run on two Temporal worker pools, divided by whether someone is waiting for the answer.

<WorkerSplit workers={WORKERS} />

:::info[Either worker]
Three workflows run on both, depending on where in the journey they are invoked: **Create Schedule Payment**, **Execute Split Payment**, and **Create Balance Refund**.
:::

Keeping synchronous and asynchronous work on separate pools means a burst of async work, say a settlement sweep draining a backlog, cannot hold up the customer-facing path. Each pool polls its own task queues with its own tuning. Both ship together in a single JVM, the [Worker App](../../../deployment/deployables/worker-app.md), so the isolation is logical rather than deployment-level.

Each workflow on the pages below carries the worker it runs on, alongside the dimensions that select its implementations.

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
