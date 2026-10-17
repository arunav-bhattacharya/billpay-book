---
title: The Complete Picture
description: 'Every request takes the same road through Billpay: a One-Data function, a core API or a dispatcher, the Router, one workflow, its stages, and the calls those stages make.'
sidebar_label: The Complete Picture
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import RouteLedger from '@site/src/components/RouteLedger';

# The Complete Picture

<Lead>Every request takes the same road through Billpay: a One-Data function, a core API or a dispatcher, the Router, one workflow, its stages, and the calls those stages make. This page puts every road on one sheet.</Lead>

Each of the other Design pages covers one stretch of that road. [Routing](./routing.md) maps triggers to workflows, the [Component Model](./component-model/index.md) has the stages and the activities, and [Build → API Spec](../build/api-spec/index.md) has the contracts. When you are chasing one payment, say a scheduled one that never left on its due date, you want the whole road in front of you at once. That is what the sheet is for.

<RouteLedger />

## How to read it

Rows are grouped by how the work arrives. When a caller waits for an answer, the core API starts the workflow on the Online cluster with Update-With-Start. Work nobody waits for is stored first, in One-Data's inbox or as a Work Tracker row in Oracle, and a dispatcher starts it on the Offline cluster at the pace the governor sets. The allocations callback is the one request that starts its workflow asynchronously, before it replies.

One line goes into the Router for each request, and one comes out for each workflow it can start. `CreatePayment.v3` has three ways out: the Router reads the date and the number of instructions, then picks pay today, multiple instructions or a scheduled payment. The line changes from grey to the cluster's colour at the Router, because that is where the cluster is chosen.

The squares are the stages a workflow runs, in order. A pale square means a child workflow runs that stage: multiple instructions runs one `CreateImmediatePaymentWorkflow` per instruction, and an update cancels the old payment and leaves the new one to a child. Stages that only one kind of journey needs, such as Return or Settle, sit in the last column.

Click a journey and the activity rows at the bottom light up the calls it makes. Or go the other way, and follow a stage's column down to see every system it reaches. The sheet shows each journey's usual shape. A corporate payment's own execution, from its `ALLOC_EXEC` row, skips Fulfil because its legs do that work, and a corporate leg never clears.

## What the sheet shows

A few things are easier to see here than anywhere else.

- Execute sits in nine rows and Fulfil in eight, but there is one Execute stage and one Fulfil stage. Pay today, a scheduled payment on its due date, a corporate payment once it is allocated, an inbound payment, both kinds of refund and a corporate leg all run Execute. The behaviors the Router resolves decide which implementation runs.
- Every stage commits through `PaymentStore`, and every state change goes out to RTF, which is why those two rows run the full width. Raven is narrower. It is called only where the customer is told, such as a scheduled or declined payment at Verify, a processed one at Fulfil, or a cancellation.
- Nothing One-Data stores ever reaches a core API. AR intake, returns and inbound payments wait in its inbox until their dispatcher pulls them, so a burst of returns waits its turn instead of competing with a customer who is paying today.
- One road skips the Router. Nobody asks for `ProcessPaidEventsWorkflow`: a Schedule starts it every 30 seconds, and it settles whatever One-Data has marked `READY`.

Workflow names on the sheet drop the `Workflow` suffix to save room. Point at a row to see its full name.
