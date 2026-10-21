---
title: The Complete Picture
description: 'Pick a journey and see it through every layer at once: what the customer does and sees, One-Data, the API and the Router, the workflows, the systems each stage calls, and the rows in Oracle.'
sidebar_label: The Complete Picture
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import JourneyStrata from '@site/src/components/JourneyStrata';

# The Complete Picture

<Lead>Pick a journey and see it through every layer at once: what the customer does and sees, One-Data at the edge, the API and the Router, the workflows in Temporal, the systems each stage calls, and the rows it writes in Oracle.</Lead>

Each of the other Design pages covers one layer. [Routing](../routing.md) maps triggers to workflows, the [Component Model](../component-model/index.md) has the stages and the activities, and [Build → API Spec](../../build/api-spec/index.md) has the contracts. When you are chasing one payment, say a scheduled one that never left on its due date, you want every layer of its journey in front of you, lined up in time. That is what this page does.

<JourneyStrata />

## How to read a journey

Left to right is time. The journey is cut into stretches: one for each workflow run, and one for each wait between runs, such as the days a scheduled payment spends as a row in Oracle. Top to bottom is distance from the customer, one band per layer.

- **Customer.** What the customer does, and the answers and messages they get. A solid line means the customer is waiting for an answer. A dashed line means nobody is: the rest runs on its own. A hollow square is something the customer may do, such as cancel a scheduled payment.
- **One-Data.** The function the request comes in through, the inbox where work nobody waits for is stored, and the delete call that ends a create.
- **API and Router.** The core API or the dispatcher that hands the work to the Router, the cluster it runs on, and how it starts.
- **Workflows.** Each run as a card, with its stages in order and the state each one commits. A pale square is a stage a child workflow runs. A hollow one runs only in some cases. A state above a stage is where it can stop instead, such as `DECLINED`.
- **Time.** Only on a journey that waits for a date. Everything else happens in seconds or minutes.
- **Systems.** What each stage calls, lined up under the stage. Two calls run under every stage, so they are bars across the whole band: the commit to Oracle through `PaymentStore`, and the lifecycle event to RTF.
- **Oracle.** The state the payment row holds after each stage, and the Work Tracker rows that carry dated work from one run to the next.

Whatever happens at a stage lines up under it, all the way down. On Pay on a future date, the column under Verify holds the customer seeing `SCHEDULED`, the calls to Payment Instruments and Payment Options (and Plans, where the market requires a mandate), and the `SCHED_EXEC` row written in the same commit.

## By journey, or by workflow

The switch above the picture changes the question. **By journey** follows one thing a customer or a system asks for, across every workflow it takes. **By workflow** lists the workflows instead, every road from a trigger to one workflow, grouped by how the work arrives. Pick a road there to open its card: the Router's six steps with this road's outcome, every activity its stages call, and what happens when a call fails.

A journey can take several workflows, and a workflow can serve several journeys. Pay on a future date takes three: `CreateScheduledPaymentWorkflow` on the day it is made, `ExecuteScheduledPaymentWorkflow` on its due date, and `ProcessPaidEventsWorkflow` when it settles. `CreatePaymentIntentWorkflow` serves both Pay by Bank today and Pay while another payment is pending.

## What the picture shows

A few things are easier to see here than anywhere else.

- The customer waits only while a request is answered: at the create, and again at a confirm. The solid line ends at Verify, or at the reply that carries the link or the pending list, and everything after it runs with nobody waiting.
- Work that waits for a date waits in Oracle, not in Temporal. Between runs, the Workflows band is empty and the Work Tracker row is what carries the payment forward.
- A corporate payment takes six kinds of run to get from the request to `PAID`, and asks for its allocations before any money moves. Its own execution clears once, for the whole payment; its legs do the rest.
- One journey skips the Router. Nobody asks for `ProcessPaidEventsWorkflow`: a Schedule starts it every 30 seconds, and it settles whatever One-Data has marked `READY`.

## When the Router says no

The Router's first step, Admit, checks that the market, the account type and the API are live in this environment. What happens when it refuses depends on how the work arrived.

| The work arrived as | What happens |
| --- | --- |
| A caller's request | 422, and the caller does not retry. |
| A request One-Data stored | Its dispatcher marks it `REJECTED`, which raises an alert. The sender is not told. |
| The allocations callback | 422, or 429 with `Retry-After` when it is over its traffic budget. |
| A Work Tracker row | Refused only if its market was taken out of service after the row was written. Its dispatcher marks it `FAILED`, which raises the retries-exhausted alert. |

Workflow names on the cards drop the `Workflow` suffix to save room.
