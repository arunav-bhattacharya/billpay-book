---
title: Routing
sidebar_label: Routing
---

import Lead from '@site/src/components/Lead';
import RouteMap from '@site/src/components/RouteMap';

# Routing

<Lead>Between the core APIs and the workflows sits the Billpay Router. It reads the payment date, the number of instructions, and the market's behaviors, fetches the stages that match, and starts the workflow.</Lead>

A request travels One-Data function, core API, **Billpay Router**, workflow, then the stages, activity groups and activities the workflow sequences. The router is the only place that decides which workflow runs, so no channel or market branches that choice by hand.

Each trigger below arrives through a One-Data function and a core endpoint. Those contracts are listed in [Build → API Spec](../build/api-spec/index.md).

## Trigger to workflow

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
      condition: 'future-dated · single-instruction',
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

The `Online` and `Offline` tags are the [Temporal worker](./component-model/workflows/index.md#workers) the workflow runs on. Three workflows appear on both, because the worker depends on where in the journey they are called.

## Child workflows

The tagged, indented rows are the child workflows a route triggers once the payment is accepted. The tag is the `accountType` behavior that selects them:

- A consumer split runs one `ExecuteSplitPaymentWF` per leg.
- A corporate payment runs `GetCorporatePaymentAllocationsWF` first to fetch its allocation breakdown, then one `ExecuteSplitPaymentWF` per allocation.

## What the router passes in

The router does not only pick the workflow. It also looks up the stage and activity-group implementations that match the market's behaviors and passes them into the workflow it starts. That is why the same route behaves correctly in every market without a branch in the workflow code. The rules behind that composition are in [Design Principles](./principles.md).
