---
title: Components
sidebar_label: Components
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import RouteMap from '@site/src/components/RouteMap';

# Components

<Lead>A closer look at the blocks the [overview](./overview.md) introduced — the gateway, the router, the two worker pools, the component model, and the async edges.</Lead>

## One-Data Functions → core APIs

Upstream channels integrate with **One-Data Functions** — versioned, stable contracts — which delegate to the Billpay **core REST APIs**:

| One-Data Function | Core API | Purpose |
| --- | --- | --- |
| `CreatePayment.v3` | `POST /payments` | Immediate or scheduled payment (single or multi-instruction) |
| `UpdatePayment.v1` | `PUT /payments/{payment-id}` | Update a scheduled payment |
| `DeletePayment.v1` | `DELETE /payments/{payment-id}` | Cancel a scheduled or accepted payment |
| `CreateInboundPayment.v1` | `POST /payments/inbound` | Third-party-initiated payment |
| `CreatePaymentIntent.v1` | `POST /payments/intent` | Register a payment intent |
| `CreateCreditBalanceRefund.v1` | `POST /refunds` | Credit-balance refund |
| `CreatePaymentInstallment.v1` | `POST /payment-installments` | Composite — payment + installments |
| `ReadPayments.v1` · `ReadPaymentEventsById.v1` | `GET /payments/account/{account-id}` · `GET /payments/{payment-id}` | Read payments / lifecycle events |

Event-driven functions (for example `MoneyMovementEventHandler`) bring async outcomes back in — see [Async edges](#async-edges).

## Billpay Router

The router sits between the core APIs and the workflows and decides **which workflow to invoke** — then fetches the stages for the market's dimensions and passes them in.

<RouteMap
  routes={[
    {
      trigger: 'Create payment',
      condition: 'today · single-instruction',
      workflows: [{name: 'CreateImmediatePaymentWF', worker: 'Online'}],
      children: [
        {when: 'Consumer (split)', workflows: [{name: 'ExecuteSplitPaymentWF', worker: 'Online'}]},
        {when: 'Corporate (allocations)', workflows: [{name: 'GetCorporatePaymentAllocationsWF', worker: 'Offline'}, {name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
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
        {when: 'Consumer (split)', workflows: [{name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
        {when: 'Corporate (allocations)', workflows: [{name: 'GetCorporatePaymentAllocationsWF', worker: 'Offline'}, {name: 'ExecuteSplitPaymentWF', worker: 'Offline'}]},
      ],
    },
    {trigger: 'Update', condition: 'a scheduled payment', workflows: [{name: 'UpdatePaymentWF', worker: 'Online'}]},
    {trigger: 'Cancel', condition: 'scheduled or accepted', workflows: [{name: 'CancelPaymentWF', worker: 'Online'}]},
    {trigger: 'Return', condition: 'money-movement event', workflows: [{name: 'ProcessReturnedPaymentWF', worker: 'Offline'}, {name: 'ProcessRepresentmentWF', worker: 'Offline'}]},
    {trigger: 'Inbound Payments', condition: 'third-party', workflows: [{name: 'ProcessInboundPaymentWF', worker: 'Offline'}]},
    {trigger: 'Payment Intent', condition: 'awaiting FI confirmation', workflows: [{name: 'CreatePaymentIntentWF', worker: 'Online'}]},
  ]}
/>

The indented rows are the **child workflows** a create route triggers once the payment is accepted — one `ExecuteSplitPaymentWF` per leg for consumers, preceded by `GetCorporatePaymentAllocationsWF` for corporate allocations.

## The two workers

Workflows run on two Temporal worker pools, split on purpose:

<Highlights
  accent="var(--amex-cat-architecture)"
  items={[
    {
      term: 'Online worker',
      desc: (
        <>
          Runs request-path workflows where an end user is <strong>awaiting a response</strong> — create, update, cancel, intent.
        </>
      ),
    },
    {
      term: 'Offline worker',
      desc: (
        <>
          Runs workflows triggered <strong>asynchronously</strong> — by events, async systems (RTF), or a scheduler — with no user waiting: scheduled execution, inbound, returns, and all periodic work.
        </>
      ),
    },
  ]}
/>

Keeping synchronous and asynchronous work on separate workers means a burst of async work — say a settlement sweep draining a backlog — can't hold up the customer-facing path, and each can scale and deploy independently. A few workflows (Create Schedule Payment, Execute Split Payment, Create Balance Refund) can run on either, depending on where in the journey they're invoked.

## The component model

Inside a workflow, work is layered so each concern lives in exactly one place — and a workflow never calls an external system directly:

<Highlights
  accent="var(--amex-cat-architecture)"
  items={[
    {
      term: 'Workflow',
      desc: `Orchestrates a complete journey — a payment, a refund, a return — sequencing the business decision points.`,
    },
    {
      term: 'Stage',
      desc: (
        <>
          A single state-transition decision point (e.g. <code>InitiatedToPendingStage</code>) — consumes one payment state, emits the next.
        </>
      ),
    },
    {
      term: 'ActivityGroup',
      desc: `Coordinates a cohesive set of business actions — validation, lifecycle-event publication, balance updates.`,
    },
    {
      term: 'Activity',
      desc: `One retryable action — publish an event, persist a record, update a downstream balance.`,
    },
    {
      term: 'Client',
      desc: "An adapter to one external system; translates Billpay's payment language into that system's contract.",
    },
  ]}
/>

The call direction is strict — **Workflow → Stage → ActivityGroup → Activity → Client → external system** — and it is **composition, not inheritance**: there is one workflow per journey, and market or account-type variation comes from swapping stage and activity-group implementations. The full call rules, code locations, and naming conventions live in the Design section.

## Async edges

- **Event handlers** — event-driven One-Data functions that consume async outcomes (money movement for returns/settlement, Accounts-Receivable posting, Open-To-Buy updates) and record them in the external-events tracker, so a workflow can advance or a payment can close out to `PAID`.
- **Temporal Schedules** — fire the periodic Offline workflows in waves:

  | Schedule | Workflow |
  | --- | --- |
  | Scheduled Payment Executor | `#ExecuteScheduledPaymentWF` |
  | Corporate Allocations Processor | `#ExecuteSplitPaymentWF` |
  | Paid Events Processor | `#PaidEventsProcessingWF` |
  | Missing Paid Events Processor | `#MissingPaidEventsProcessingWF` |
  | Data Purge | `#DataPurgingWF` |
