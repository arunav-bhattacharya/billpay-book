---
title: Workflows
description: 'A workflow runs one journey end to end, on one of two Temporal clusters: Online when someone is waiting for the answer, Offline when the work can be paced.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';
import WorkerSplit from '@site/src/components/WorkerSplit';

export const CLUSTERS = [
  {
    term: 'Online cluster',
    tone: 'Online',
    waiting: 'someone is waiting',
    desc: `Journeys where a caller waits for the answer, started with Update-With-Start. Peak 100 TPS.`,
    items: [
      'Create Immediate Payment',
      'Create Scheduled Payment, from channels',
      'Update Payment',
      'Cancel Payment',
      'Create Payment Intent',
      'Create Balance Refund, from channels',
      'Composites',
      'Execute Split Payment, consumer legs',
    ],
  },
  {
    term: 'Offline cluster',
    tone: 'Offline',
    waiting: 'nobody is blocked',
    desc: `Work that can be paced, released by dispatchers at the rate the governor sets.`,
    items: [
      'Create Scheduled Payment, from AR',
      'Execute Scheduled Payment',
      'Execute Split Payment: corporate legs, and consumer legs of an Offline parent',
      'Request Allocations',
      'Receive Allocations',
      'Process Returned Payment',
      'Process Representment',
      'Process Inbound Payment',
      'Create Balance Refund, from AR',
      'Periodic jobs',
      'Dispatchers and the governor',
      'Market provisioning',
    ],
  },
];

# Workflows

<Lead>A workflow runs one journey end to end, on one of two Temporal clusters: Online when someone is waiting for the answer, Offline when the work can be paced.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Core',
      to: '/docs/design/component-model/workflows/core',
      desc: `One business journey each: pay today, schedule, execute, split, allocate, update, cancel, return, represent, inbound, intent and refund.`,
    },
    {
      term: 'Composite',
      to: '/docs/design/component-model/workflows/composite',
      desc: `A parent that runs core workflows as children, such as Pay & Plan or a payment with several instructions.`,
    },
    {
      term: 'Periodic and control',
      to: '/docs/design/component-model/workflows/periodic',
      desc: `The jobs Temporal Schedules start, such as marking payments PAID, and the dispatchers and governor that pace everything offline.`,
    },
  ]}
/>

## Two clusters

<WorkerSplit workers={CLUSTERS} />

Each cluster has its own Aurora PostgreSQL database and its own OpenSearch, so a burst of offline work can never slow the customer-facing path inside Temporal. Nothing calls across the two. A payment scheduled on the Online cluster reaches the Offline cluster as a Work Tracker row in Oracle, written in the same commit as its `SCHEDULED` state, and no child workflow ever starts on the other cluster.

Three workflows appear on both sides, and what starts them decides where they run. `CreateScheduledPaymentWorkflow` and `CreateBalanceRefundWorkflow` run on the Online cluster when a channel calls, and on the Offline cluster when Accounts Receivable raises them. `ExecuteSplitPaymentWorkflow` runs consumer legs as children on their parent's cluster, and corporate legs only on the Offline cluster, where the leg dispatcher starts them.

The clusters are separate, but the app isn't. One app, billpay-core, runs the workers for both, with a Temporal client for each. Offline work has its own Oracle connection pool and its own cap on how many tasks run at once, so it can never take a whole pod, and the governor cuts offline rates as soon as online response times climb. It ships as one app, and more capacity means more pods of it. The [billpay-core deployable page](../../../deployment/deployables/worker-app.md) has the detail.

## Four kinds of workflow

- Core workflows run one business journey each, such as paying today, executing a scheduled payment or processing a return.
- Composite workflows are a parent that runs core workflows as children, sometimes across domains: Pay & Plan (Billpay and GAR), Pay with MR Points (Billpay and Loyalty), and payments with several instructions. They run on the Online cluster, with their children on the same cluster.
- Periodic workflows are jobs that Temporal Schedules start on the Offline cluster.
- Control workflows are the dispatchers, the governor and market provisioning. They pace and configure payment work; they aren't payment journeys themselves.

Each workflow on the pages that follow shows its cluster, its workflow ID and what starts it.
