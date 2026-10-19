---
title: The Complete Picture
description: 'Every request takes the same road through Billpay: a One-Data function, a core API or a dispatcher, the Router, one workflow, its stages, and the calls those stages make.'
sidebar_label: The Complete Picture
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import RouteLedger from '@site/src/components/RouteLedger';

# The Complete Picture

<Lead>Every request takes the same road through Billpay: a One-Data function, a core API or a dispatcher, the Router, one workflow, its stages, and the calls those stages make. This page lists every road in one index and opens any one of them as a card.</Lead>

Each of the other Design pages covers one stretch of that road. [Routing](./routing.md) maps triggers to workflows, the [Component Model](./component-model/index.md) has the stages and the activities, and [Build → API Spec](../build/api-spec/index.md) has the contracts. When you are chasing one payment, say a scheduled one that never left on its due date, you want its whole road in front of you and the other roads out of the way. That is what this page does.

<RouteLedger />

## How it works

1. Pick a road. The index lists all 23, grouped by how the work arrives. Each row shows the trigger, where it lands, the Router's choice of cluster and start, and the stages the road runs. With nothing picked, every road looks the same. Pick one and the rest grey out.
2. Read its card. The card opens beside the road and follows it from the trigger, through the Router's six steps, to every activity its stages call and the system behind each one. Click an activity to open it in place: where it runs, what this call does on this road, and what happens when it fails. Expand all, at the top of the card, opens every one. On pay today and on a scheduled payment, switch the account type to CORPORATE to follow a corporate payment through every later step.
3. See every call. Under the index, the activities show each interface with its system, its task queue and the stages that call it, and a picked road's calls are lit. Pick an activity instead, and the roads that call it stay lit while its card lists them by stage.

Pick the road again, press Esc or use Show all to bring every road back. Inside a card, the road that comes next is one click away, and an opened activity links to every road that calls it.

## How to read the index

Roads are grouped by how the work arrives. When a caller waits for an answer, the core API starts the workflow on the Online cluster with Update-With-Start, or sends an update to one already waiting. Work nobody waits for is stored first, in One-Data's inbox or as a Work Tracker row in Oracle, and a dispatcher starts it on the Offline cluster at the pace the governor sets. The allocations callback is the one request that starts its workflow asynchronously, before it replies.

One request can lead to several roads. `CreatePayment.v3` has five. The Router reads the date and the number of instructions to pick pay today, multiple instructions or a scheduled payment. A payment that needs the customer to confirm at their bank takes a road of its own, `CreatePaymentIntentWorkflow`, which stops at `PENDING` and waits for the confirm, and so does one made while another payment on the account is pending, in a market that turns the go-ahead on, until the customer gives it. The confirm and the no are updates to that same running workflow, so their roads name it too.

The squares are the stages a road runs, in order: Capture, Verify, Reverify, Execute and Fulfil, then one square for a stage only that kind of road has, such as Cancel, Return or Settle. A pale square means a child workflow runs that stage: multiple instructions runs one `CreateImmediatePaymentWorkflow` per instruction, and an update cancels the old payment and leaves the new one to a child. A small square means the stage runs only in some cases, like a corporate payment's Reverify, which pay today skips.

## What the index shows

A few things are easier to see here than anywhere else.

- Execute sits on ten roads and Fulfil on nine, but there is one Execute stage and one Fulfil stage. The behaviors the Router resolves decide which of their methods run.
- Every stage commits through `PaymentStore`, and every state change goes out to RTF, which is why those two run the full width of the activities. Raven is narrower. It is called only where the customer is told, such as a scheduled or declined payment at Verify, a processed one at Fulfil, or a cancellation.
- A corporate payment's own execution clears once, for the whole payment, and does nothing else. Its legs make the AR and open-to-buy calls and do Fulfil's work, and a corporate leg never clears.
- Nothing One-Data stores ever reaches a core API. AR intake, returns and inbound payments wait in its inbox until their dispatcher pulls them, so a burst of returns waits its turn instead of competing with a customer who is paying today.
- One road skips the Router. Nobody asks for `ProcessPaidEventsWorkflow`: a Schedule starts it every 30 seconds, and it settles whatever One-Data has marked `READY`.

## When the Router says no

The Router's first step, Admit, checks that the market, the account type and the API are live in this environment. What happens when it refuses depends on how the work arrived.

| The work arrived as | What happens |
| --- | --- |
| A caller's request | 422, and the caller does not retry. |
| A request One-Data stored | Its dispatcher marks it `REJECTED`, which raises an alert. The sender is not told. |
| The allocations callback | 422, or 429 with `Retry-After` when it is over its traffic budget. |
| A Work Tracker row | Refused only if its market was taken out of service after the row was written. Its dispatcher marks it `FAILED`, which raises the retries-exhausted alert. |

Workflow names in the index and the cards drop the `Workflow` suffix to save room. Each card's Pick the journey step gives the full name.
