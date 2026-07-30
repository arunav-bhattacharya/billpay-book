---
title: A Closer Look
sidebar_label: A Closer Look
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import RouteMap from '@site/src/components/RouteMap';
import ApiTable from '@site/src/components/ApiTable';
import WorkerSplit from '@site/src/components/WorkerSplit';
import ScheduleTable from '@site/src/components/ScheduleTable';

export const FUNCTIONS = [
  {
    fn: 'CreatePayment.v3',
    method: 'POST',
    path: '/payments',
    purpose: 'Pay now or on a future date, with one instruction or several',
  },
  {
    fn: 'UpdatePayment.v1',
    method: 'PUT',
    path: '/payments/{payment-id}',
    purpose: 'Change a payment that is still scheduled',
  },
  {
    fn: 'DeletePayment.v1',
    method: 'DELETE',
    path: '/payments/{payment-id}',
    purpose: 'Cancel a scheduled or accepted payment',
  },
  {
    fn: 'CreateInboundPayment.v1',
    method: 'POST',
    path: '/payments/inbound',
    purpose: 'Take in a payment a third party started',
  },
  {
    fn: 'CreatePaymentIntent.v1',
    method: 'POST',
    path: '/payments/intent',
    purpose: 'Register an intent, processed once the customer FI confirms it',
  },
  {
    fn: 'CreateCreditBalanceRefund.v1',
    method: 'POST',
    path: '/refunds',
    purpose: 'Send a credit balance back to the customer',
  },
  {
    fn: 'CreatePaymentInstallment.v1',
    method: 'POST',
    path: '/payment-installments',
    purpose: 'A payment plus the installment plan behind it',
    tag: 'Composite',
  },
  {
    fn: 'ReadPayments.v1',
    method: 'GET',
    path: '/payments/account/{account-id}',
    purpose: "List a card account's payments",
  },
  {
    fn: 'ReadPaymentEventsById.v1',
    method: 'GET',
    path: '/payments/{payment-id}',
    purpose: 'Read the lifecycle events of one payment',
  },
];

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

export const STRIPS = [
  {
    label: 'Either worker',
    text: 'A few workflows run on both, depending on where in the journey they are invoked.',
    items: ['Create Schedule Payment', 'Execute Split Payment', 'Create Balance Refund'],
  },
];

export const SCHEDULES = [
  {schedule: 'Scheduled Payment Executor', workflow: 'ExecuteScheduledPaymentWF'},
  {schedule: 'Corporate Allocations Processor', workflow: 'ExecuteSplitPaymentWF'},
  {schedule: 'Paid Events Processor', workflow: 'PaidEventsProcessingWF'},
  {schedule: 'Missing Paid Events Processor', workflow: 'MissingPaidEventsProcessingWF'},
  {schedule: 'Data Purge', workflow: 'DataPurgingWF'},
];

# A Closer Look

<Lead>The blocks the [overview](./overview.md) introduced, one at a time: the gateway and the core APIs, the router, the two worker pools, the building blocks inside a workflow, and the async edges.</Lead>

## How a request gets in

Upstream channels never call Billpay directly. They call **One-Data Functions**, versioned contracts that stay stable while the implementation behind them moves, and each function delegates to one Billpay **core REST API**. Every function name below links to its contract in the One-Data explorer.

<ApiTable rows={FUNCTIONS} />

Event-driven functions such as `MoneyMovementEventHandler` bring async outcomes back in. Those are covered under [Async edges](#async-edges).

## Billpay Router

The router sits between the core APIs and the workflows and decides **which workflow to invoke**. It then fetches the stages for the market's dimensions and passes them in.

<RouteMap
  routes={[
    {
      trigger: 'Create payment',
      condition: 'today · single-instruction',
      workflows: [{name: 'CreateImmediatePaymentWF', worker: 'Online'}],
      children: [
        {account: 'Consumer', when: 'split', workflows: [{name: 'ExecuteSplitPaymentWF', worker: 'Online'}]},
        {account: 'Corporate', when: 'allocations', workflows: [{name: 'GetCorporatePaymentAllocationsWF', worker: 'Offline'}, {name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
      ],
    },
    {
      trigger: 'Create payment',
      condition: 'today · multi-instruction',
      workflows: [{name: 'CreatePaymentWithMultipleInstructionsWF', worker: 'Online'}],
    },
    {
      trigger: 'Create payment',
      condition: 'future-dated',
      workflows: [{name: 'CreateSchedulePaymentWF', worker: 'Online'}, {name: 'ExecuteScheduledPaymentWF', worker: 'Offline'}],
      children: [
        {account: 'Consumer', when: 'split', workflows: [{name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
        {account: 'Corporate', when: 'allocations', workflows: [{name: 'GetCorporatePaymentAllocationsWF', worker: 'Offline'}, {name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
      ],
    },
    {trigger: 'Update payment', condition: 'a scheduled payment', workflows: [{name: 'UpdatePaymentWF', worker: 'Online'}]},
    {trigger: 'Cancel payment', condition: 'scheduled or accepted', workflows: [{name: 'CancelPaymentWF', worker: 'Online'}]},
    {trigger: 'Money movement event', condition: 'return', workflows: [{name: 'ProcessReturnedPaymentWF', worker: 'Offline'}, {name: 'ProcessRepresentmentWF', worker: 'Offline'}]},
    {trigger: 'Inbound payment', condition: 'third-party initiated', workflows: [{name: 'ProcessInboundPaymentWF', worker: 'Offline'}]},
    {trigger: 'Payment intent', condition: 'awaiting FI confirmation', workflows: [{name: 'CreatePaymentIntentWF', worker: 'Online'}]},
    {
      trigger: 'From Accounts Receivable',
      condition: 'future-dated · single-instruction',
      workflows: [{name: 'CreateSchedulePaymentWF', worker: 'Offline'}, {name: 'ExecuteScheduledPaymentWF', worker: 'Offline'}],
      children: [
        {account: 'Consumer', when: 'split', workflows: [{name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
        {account: 'Corporate', when: 'allocations', workflows: [{name: 'GetCorporatePaymentAllocationsWF', worker: 'Offline'}, {name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
      ],
    },
  ]}
/>

The tagged, indented rows are the **child workflows** a route triggers once the payment is accepted, and the tag is the `accountType` dimension that selects them: a consumer split runs one `ExecuteSplitPaymentWF` per leg, while a corporate payment first runs `GetCorporatePaymentAllocationsWF` to fetch its allocation breakdown, then an `ExecuteSplitPaymentWF` per allocation.

## Where workflows run

Workflows run on two Temporal worker pools, divided by whether someone is waiting for the answer.

<WorkerSplit workers={WORKERS} strips={STRIPS} />

Keeping synchronous and asynchronous work on separate pools means a burst of async work, say a settlement sweep draining a backlog, cannot hold up the customer-facing path. Each pool polls its own task queues with its own tuning. Both ship together in a single JVM, the [Worker App](../deployment/deployables/worker-app.md), so the isolation is logical rather than deployment-level. The periodic work the Offline worker carries is fired by Temporal Schedules, listed under [Async edges](#async-edges).

## Building Blocks

Inside a workflow, work is layered so each concern lives in exactly one place, and a workflow never calls an external system directly.

<Highlights
  accent="var(--amex-cat-architecture)"
  variant="solid"
  items={[
    {
      term: 'Workflow',
      desc: `Orchestrates one complete journey: a payment, a refund, or a return. It sequences the business decision points and nothing else.`,
    },
    {
      term: 'Stage',
      desc: (
        <>
          A single state-transition decision point (for example <code>InitiatedToPendingStage</code>). It consumes one payment state and emits the next.
        </>
      ),
    },
    {
      term: 'ActivityGroup',
      desc: `Coordinates a cohesive set of business actions: validation, lifecycle-event publication, balance updates.`,
    },
    {
      term: 'Activity',
      desc: `One retryable action, such as publishing an event, persisting a record, or updating a downstream balance.`,
    },
    {
      term: 'Client',
      desc: "An adapter to one external system; translates Billpay's payment language into that system's contract.",
    },
  ]}
/>

The call direction is strict: **Workflow → Stage → ActivityGroup → Activity → Client → external system**. It is **composition, not inheritance**, so there is one workflow per journey, and market or account-type variation comes from swapping stage and activity-group implementations. The full call rules, code locations, and naming conventions live in the Design section.

## Async edges

**Event handlers** are the event-driven One-Data functions that take async outcomes in: money movement for returns and settlement, Accounts-Receivable posting, and Open-To-Buy updates. Each one is recorded in the external-events tracker, so a workflow can advance or a payment can close out to `PAID`.

**Temporal Schedules** fire the periodic Offline workflows in waves.

<ScheduleTable rows={SCHEDULES} />
