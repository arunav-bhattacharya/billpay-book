---
title: Routing
description: 'Every payment workflow starts through the Billpay Router, a library inside the core APIs and the dispatchers.'
sidebar_label: Routing
---

import Lead from '@site/src/components/Lead';
import RouteMap from '@site/src/components/RouteMap';

# Routing

<Lead>Every payment workflow starts through the Billpay Router, a library inside the core APIs and the dispatchers. It decides the journey, the stages and where the work runs, so no channel or market branches that choice by hand.</Lead>

A request reaches Billpay through a One-Data function. Most then call a core API, and the API calls the Router. Work that nobody waits for takes a different door: One-Data keeps it in its inbox, and a dispatcher pulls it later and calls the Router. Either way the Router is the only code that starts a payment workflow. The contracts on each side are in [Build → API Spec](../build/api-spec/index.md).

## The six steps

The Router runs the same six steps for every request.

1. Admit the request. The market, account type and API must be live in this environment. If they aren't, the API answers 422, which senders don't retry, and a dispatcher marks a pulled request `REJECTED` (only operations hear of it, through an alert). An allocation callback must also fit its traffic class's budget, or it gets 429 with `Retry-After`. Dispatchers never see a 429, because the governor already paces them.
2. Pick the journey from the routing table below.
3. Resolve the behaviors from the market's active config. A behavior set to BOTH becomes Y or N by the market's rule for this journey. Realtime clearing, for example, is Y only for a pay-today payment from a channel.
4. Pin the plan key: the journey, the resolved behaviors and the config version. The workflow looks up its stages from it at runtime (see [Principles](./principles.md#how-a-workflow-finds-its-stages)).
5. Place the work: cluster, task queue, priority, fairness key and workflow ID.
6. Start it in the journey's start mode.

## Start modes

How a workflow starts depends on who is waiting for it.

| When | Start | Reply | Used by |
| --- | --- | --- | --- |
| A caller waits | Update-With-Start, conflict policy `USE_EXISTING` | The update's result: `PENDING`, `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED` | Pay today, schedule, composites, intent, update, cancel, refunds from channels |
| Nobody waits | One-Data stores the request; a dispatcher pulls it from the inbox and starts it through the Router | AR intake and inbound: 202 from One-Data, once stored. A return arrives as an event | AR intake (payments and refunds), returns, inbound |
| An allocation callback | Async start; the workflow exists before Billpay replies | 202; 429 with `Retry-After` over budget | Allocation callbacks |
| Due on a date, or a big fan-out | A Work Tracker row in the producer's commit; a dispatcher starts it through the Router | None | Scheduled execution, allocation requests, corporate legs, representments |

Update-With-Start is what keeps the online journeys fast. It starts the workflow and sends it an update in one call. The update returns as soon as there is an answer, such as Verify's decision on a new payment or `CANCELLED` for a cancel, and the rest of the workflow carries on without the caller.

- `PENDING` in a reply means the payment is captured but not yet decided. The caller learns the outcome from notifications, lifecycle events or `GET /payments/{payment-id}`.
- Eager workflow start isn't used: the server refuses it with Update-With-Start. Online latency comes from Update-With-Start and local activities instead.
- For pulled work and async starts, the workflow ID comes from the request: the payment ID in its idempotency key, or for a return, the returned payment and its sequence number. A repeated request finds the same workflow. A start that fails as already started counts as done, and reuse policy `REJECT_DUPLICATE` stops a second run after the first one closes.

## Trigger to workflow

Each chip is the Temporal cluster the workflow runs on.

<RouteMap
  rows={[
    {
      trigger: 'Create payment',
      condition: 'Today, one instruction',
      start: 'Update-With-Start',
      workflows: [{name: 'CreateImmediatePaymentWorkflow', cluster: 'Online'}],
      children: [
        {account: 'Consumer', when: 'split', start: 'Child of the parent', workflows: [{name: 'ExecuteSplitPaymentWorkflow', cluster: 'Online'}]},
        {
          account: 'Corporate',
          when: 'allocations',
          start: 'Dispatchers, and the allocations callback',
          workflows: [
            {name: 'RequestAllocationsWorkflow', cluster: 'Offline'},
            {name: 'ReceiveAllocationsWorkflow', cluster: 'Offline'},
            {name: 'ExecuteSplitPaymentWorkflow', cluster: 'Offline'},
          ],
        },
      ],
    },
    {
      trigger: 'Create payment',
      condition: 'Today, several instructions',
      start: 'Update-With-Start',
      workflows: [
        {name: 'CreatePaymentWithMultipleInstructionsWorkflow', cluster: 'Online'},
        {name: 'CreateImmediatePaymentWorkflow', cluster: 'Online'},
      ],
    },
    {
      trigger: 'Create payment',
      condition: 'Future-dated',
      start: 'Update-With-Start; on the due date, the scheduled-payments dispatcher',
      workflows: [
        {name: 'CreateScheduledPaymentWorkflow', cluster: 'Online'},
        {name: 'ExecuteScheduledPaymentWorkflow', cluster: 'Offline'},
      ],
      children: [
        {account: 'Consumer', when: 'split', start: 'Child of the parent', workflows: [{name: 'ExecuteSplitPaymentWorkflow', cluster: 'Offline'}]},
        {
          account: 'Corporate',
          when: 'allocations',
          start: 'Dispatchers, and the allocations callback',
          workflows: [
            {name: 'RequestAllocationsWorkflow', cluster: 'Offline'},
            {name: 'ReceiveAllocationsWorkflow', cluster: 'Offline'},
            {name: 'ExecuteSplitPaymentWorkflow', cluster: 'Offline'},
          ],
        },
      ],
    },
    {
      trigger: 'Pay & Plan',
      condition: 'Pay today, plan future installments',
      start: 'Update-With-Start',
      workflows: [
        {name: 'Create Payment & Installments', cluster: 'Online'},
        {name: 'CreateImmediatePaymentWorkflow', cluster: 'Online'},
      ],
    },
    {
      trigger: 'From Accounts Receivable',
      condition: 'Future-dated',
      start: 'AR intake dispatcher; on the due date, the scheduled-payments dispatcher',
      workflows: [
        {name: 'CreateScheduledPaymentWorkflow', cluster: 'Offline'},
        {name: 'ExecuteScheduledPaymentWorkflow', cluster: 'Offline'},
      ],
    },
    {
      trigger: 'Update payment',
      condition: 'SCHEDULED, inside the window',
      start: 'Update-With-Start',
      workflows: [
        {name: 'UpdatePaymentWorkflow', cluster: 'Online'},
        {name: 'CreateScheduledPaymentWorkflow', cluster: 'Online'},
      ],
    },
    {
      trigger: 'Cancel payment',
      condition: 'SCHEDULED, inside the window',
      start: 'Update-With-Start',
      workflows: [{name: 'CancelPaymentWorkflow', cluster: 'Online'}],
    },
    {
      trigger: 'Payment intent',
      condition: 'Awaiting FI confirmation',
      start: 'Update-With-Start',
      workflows: [{name: 'CreatePaymentIntentWorkflow', cluster: 'Online'}],
    },
    {
      trigger: 'Credit balance refund',
      condition: 'From a channel',
      start: 'Update-With-Start',
      workflows: [{name: 'CreateBalanceRefundWorkflow', cluster: 'Online'}],
    },
    {
      trigger: 'Credit balance refund',
      condition: 'Raised by AR',
      start: 'AR intake dispatcher',
      workflows: [{name: 'CreateBalanceRefundWorkflow', cluster: 'Offline'}],
    },
    {
      trigger: 'Money movement event',
      condition: 'A return',
      start: 'Returns dispatcher',
      workflows: [{name: 'ProcessReturnedPaymentWorkflow', cluster: 'Offline'}],
    },
    {
      trigger: 'Representment falls due',
      condition: 'A REPRESENT row',
      start: 'Representment dispatcher',
      workflows: [{name: 'ProcessRepresentmentWorkflow', cluster: 'Offline'}],
    },
    {
      trigger: 'Inbound payment',
      condition: 'Pushed by a third party',
      start: 'Inbound dispatcher',
      workflows: [{name: 'ProcessInboundPaymentWorkflow', cluster: 'Offline'}],
    },
    {
      trigger: 'Allocations callback',
      condition: 'A corporate payment',
      start: 'Async start, then 202',
      workflows: [{name: 'ReceiveAllocationsWorkflow', cluster: 'Offline'}],
    },
  ]}
/>

Settlement and Accounts Receivable posting are the one input the Router never sees. One-Data pairs the two events in its inbox, and `ProcessPaidEventsWorkflow` pulls the payments that have both every 30 seconds ([Periodic Workflows](./component-model/workflows/periodic.md) has the detail).

## Child workflows

The indented rows are the extra workflows a payment of that account type runs, tagged with the `accountType` behavior that selects them. The child in the several-instructions row runs once per instruction.

- A consumer split runs one `ExecuteSplitPaymentWorkflow` per leg, as children of the parent, on the parent's cluster.
- A corporate payment starts its legs from Work Tracker rows instead, because one payment can have 100K of them. `RequestAllocationsWorkflow` asks for the breakdown, `ReceiveAllocationsWorkflow` writes the legs as the batches arrive, and the leg dispatcher starts one `ExecuteSplitPaymentWorkflow` per leg. [Corporate Allocations](./corporate-allocations.md) has the whole track.

No child workflow ever crosses clusters. A scheduled payment created on the Online cluster reaches the Offline cluster as a Work Tracker row in Oracle, written in the same commit as `SCHEDULED`.

## Re-routing on the due date

A scheduled payment can wait up to 30 days, and a market's config can change in that time. So on the due date the dispatcher calls the Router again, and the payment runs with today's config. The version it was scheduled under stays in its timeline for audit.

Two guardrails keep that safe. The plan key carries the resolved behaviors and the config version, so the running workflow never reads config that changed after it started. And the workflow is pinned to its build with Worker Versioning, so a deploy never changes its code mid-run.

## Workflow IDs

Every workflow ID is the payment ID plus a suffix, so any payment can be traced from its ID alone. The Work Tracker doesn't store workflow IDs at all.

| Thing | Workflow ID |
| --- | --- |
| Create or schedule | `{paymentId}-init` |
| Scheduled execution | `{paymentId}-execute` |
| Update and cancel | `{paymentId}-update`, `{paymentId}-cancel` |
| Allocation request and received batch | `{paymentId}-allocations`, `{paymentId}-allocations-{batch}` |
| Leg | `{paymentId}_{seq}-execute` |
| Return and representment | `{paymentId}-return-{seq}`, `{paymentId}-represent-{seq}` |
| Dispatcher run | Its Schedule's ID, such as `dispatch-sched-DE`, plus the trigger time |
| Governor | `governor`, plus its Schedule's trigger time |
| Market provisioning | `provision-{market}-{accountType}-v{N}` |

On returns and representments, `{seq}` is the presentment sequence, so a payment returned again after its representment gets a new workflow ID.
