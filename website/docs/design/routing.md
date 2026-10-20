---
title: Routing
description: 'Every payment workflow starts through the Billpay Router, a library inside the core APIs and the dispatchers.'
sidebar_label: Routing
---

import Lead from '@site/src/components/Lead';
import RouteMap from '@site/src/components/RouteMap';
import ProfileToStages from '@site/src/components/ProfileToStages';

# Routing

<Lead>Every payment workflow starts through the Billpay Router, a library inside the core APIs and the dispatchers. It decides the journey, the stages and where the work runs, so no channel or market branches that choice by hand.</Lead>

A request reaches Billpay through a One-Data function. Most then call a core API, and the API calls the Router. Work that nobody waits for takes a different door: One-Data keeps it in its inbox, and a dispatcher pulls it later and calls the Router. Either way the Router is the only code that starts a payment workflow. The contracts on each side are in [Build → API Spec](../build/api-spec/index.md).

## The six steps

The Router runs the same six steps for every request that starts a workflow.

1. Admit the request. The market, account type and API must be live in this environment, which the Router checks against billpay-core's in-memory copy of the onboarding config, so admission adds no call. If they aren't, the API answers 422, which senders don't retry, and a dispatcher marks a pulled request `REJECTED` (only operations hear of it, through an alert). A Work Tracker row is refused only if its market was taken out of service after the row was written. Its dispatcher then marks the row `FAILED`, which raises the retries-exhausted alert. An allocation callback must also fit its traffic class's budget, or it gets 429 with `Retry-After`. Dispatchers never see a 429, because the governor already paces them. One create is never refused: a create One-Data held while billpay-core was slow, which arrives after its market was taken out of service, is captured and declined instead, so the customer is told.
2. Pick the journey from the routing table below. A create that waits for the customer, for bank confirmation or a go-ahead, takes `CreatePaymentIntentWorkflow`. The go-ahead is a market setting, off by default: where it is off, the Router ignores the pending payments' IDs One-Data sends.
3. Resolve the behaviors from the market's active config. A behavior set to BOTH becomes Y or N by the market's rule for this journey. Realtime clearing, for example, is Y only for a pay-today payment from a channel. Bank confirmation set to BOTH follows the request's payment method instead: a method that needs the customer to confirm at their bank gets Y.
4. Pin the plan key: the market, the journey, the resolved behaviors and the config version. The market is there so a market's own classes can apply, such as GB's funds check for Pay with Bank Transfer. The key also carries the market's rule settings from that version, which the [verification rules](./component-model/stages.md#how-verification-decides) read, and for a payment that waits for the customer, its confirmation window. The workflow looks up its stages from the key at runtime ([From profile to stages](#from-profile-to-stages) walks through one).
5. Place the work: cluster, task queue, priority, fairness key and workflow ID.
6. Start it in the journey's start mode.

The confirm, and the customer's no to a payment that waits, are only admitted. They are updates to a workflow that is already running, so there is nothing to pick, pin or place.

## From profile to stages

A market and an account type never pick code directly. Their profile sets five behaviors, the Router resolves those for the journey, and the resolved behaviors pick the stages and the checks and methods they use.

Follow one profile through. Say a market's consumer profile sets AR posting to Y, mandate authorization to Y, bank confirmation to N, and realtime clearing to BOTH, with Y for pay today. This is a payment made today from a channel:

<ProfileToStages />

A payment scheduled for its due date resolves differently. The two side by side:

| | Pay today, from a channel | Scheduled, on its due date |
| --- | --- | --- |
| Account type | Consumer | Consumer |
| AR posting | Y | Y |
| Realtime clearing | Y | N: every future-dated payment clears in batch |
| Mandate authorization | Y | Y |
| Bank confirmation | N | N |
| Verify, or Reverify on the due date | `DefaultPaymentVerifyStage`, with the Instrument, Options and Mandate checks | `DefaultPaymentReverifyStage`, with the same three checks |
| Execute | `DefaultPaymentExecuteStage`, with `RealtimeClearing` | `DefaultPaymentExecuteStage`, with `BatchClearing` |
| Fulfil | `DefaultPaymentFulfilStage` | `DefaultPaymentFulfilStage` |

*(An example. The class names follow the [naming rule](./component-model/stages.md#naming).)*

Each step runs one stage, and that stage does the whole step. The workflow calls Verify once. `DefaultPaymentVerifyStage` asks for the checks that apply to the payment, and for this profile gets the Instrument, Options and Mandate checks. It makes their calls to Payment Instruments, Payment Options and Plans as activities, in parallel, runs the verification rules over the answers, then commits once. It doesn't call other stages, because a stage never calls another stage ([Call rules](./principles.md#call-rules)). Each check is written once and used by every market that needs it, so nothing is copied.

If this market ever needed a Verify check of its own, it would add one class in its module under `market/{m}/`, saying it applies to that market, with the market's code at the front of its name. The class would run for this market and no other, which is why the plan key carries the market. GB has one: `GBFundsCheck`, which for Pay with Bank Transfer checks that the customer's bank account holds enough money for the payment. It stays GB's own until a second market needs it. A second market with the same profile runs exactly the same classes, with no code of its own.

## Start modes

How a workflow starts depends on who is waiting for it.

| When | Start | Reply | Used by |
| --- | --- | --- | --- |
| A caller waits | Update-With-Start, conflict policy `USE_EXISTING` | The update's result: `PENDING`, `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED` | Pay today, schedule, a payment that waits for the customer, composites, update, cancel, refunds from channels |
| A caller answers a waiting payment | An update to its running `CreatePaymentIntentWorkflow` | The update's result: `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`; 409 once the workflow no longer waits | The confirm, and the customer's no |
| Nobody waits | One-Data stores the request; a dispatcher pulls it from the inbox and starts it through the Router | AR intake and inbound: 202 from One-Data, once stored. A return arrives as an event | AR intake (payments and refunds), returns, inbound |
| An allocation callback | Async start; the workflow exists before Billpay replies | 202; 429 with `Retry-After` over budget | Allocation callbacks |
| Due on a date, or a big fan-out | A Work Tracker row in the producer's commit; a dispatcher starts it through the Router | None | Scheduled execution, allocation requests, corporate execution, corporate legs, representments |

Update-With-Start is what keeps the online journeys fast. It starts the workflow and sends it an update in one call, and the request itself rides in the start, so nothing is written to Oracle before the workflow begins. The update returns as soon as there is an answer, such as Verify's decision on a new payment or `CANCELLED` for a cancel, and the rest of the workflow carries on without the caller. Temporal calls this the early-return pattern. On the Online cluster, the decision's calls also run as local activities, inside the worker, so Capture, Verify and its commit all happen in the workflow's first task and the caller's answer comes back with it.

- `PENDING` in a reply means the payment is captured but not yet decided. The API waits at most 2.5 seconds for the decision, so its answer reaches One-Data inside One-Data's own 3 seconds; a payment not decided by then is answered `PENDING` and finishes on its own. The caller learns the outcome from notifications, lifecycle events or `GET /payments/{payment-id}`. For a payment that needs bank confirmation, `PENDING` comes with the provider's redirect link, and the confirm's reply carries the decision. A caller that loses the link gets it again from a repeated create or from `GET /payments/{payment-id}`, while the payment waits. A payment held for the customer's go-ahead also comes back `PENDING`, and One-Data adds the pending payments to the reply.
- A create repeated after its `{paymentId}-init` run has closed starts a new run under the default reuse policy, and Capture's idempotency check decides whether it carries on ([Creates that arrive late or twice](./component-model/workflows/core.md#creates-that-arrive-late-or-twice)).
- A payment that waits for the customer stays in one workflow, `CreatePaymentIntentWorkflow`, from the create to its end. The confirm and the customer's no reach it as updates, so their replies carry the decision, and its own timer cancels the payment once the confirmation window and a short grace have passed.
- Eager workflow start isn't used: the server refuses it with Update-With-Start. Online latency comes from Update-With-Start and local activities instead.
- For pulled work and async starts, the workflow ID comes from the request: the payment ID in its idempotency key, or for a return, the returned payment and its sequence number. A repeated request finds the same workflow. A start that fails as already started counts as done, and reuse policy `REJECT_DUPLICATE` stops a second run after the first one closes.

## Trigger to workflow

One tray per trigger. The square on each workflow is the cluster it runs on, and the line into it says how the Router starts it. Where a payment branches, by account type or by bank confirmation, the tree forks.

<RouteMap
  triggers={[
    {
      term: 'Create payment',
      routes: [
        {
          desc: 'Today, one instruction',
          flow: [{via: 'uws', name: 'CreateImmediatePayment', cluster: 'Online'}],
          fork: [
            {term: 'Consumer, one amount', self: ['Capture, Verify, Execute, Fulfil', 'Execute runs clearing, AR and OTB']},
            {term: 'Consumer, split', via: 'child', detail: 'one per leg', flow: [{name: 'ExecuteSplitPayment', cluster: 'Online'}]},
            {
              term: 'Corporate',
              via: 'row',
              detail: 'due at once',
              flow: [
                {name: 'RequestAllocations', cluster: 'Offline'},
                {via: 'async', detail: 'the callback, one per batch', name: 'ReceiveAllocations', cluster: 'Offline'},
                {via: 'row', detail: 'once allocated, due at once', name: 'ExecuteScheduledPayment', cluster: 'Offline'},
                {via: 'row', detail: 'one per leg, once it clears', name: 'ExecuteSplitPayment', cluster: 'Offline'},
              ],
              notes: ['CreateImmediatePayment stops at ACCEPTED. Dispatchers start every later step.'],
            },
          ],
        },
        {
          desc: 'Waits for the customer: bank confirmation, or a go-ahead where the market has it on',
          flow: [
            {
              via: 'uws',
              name: 'CreatePaymentIntent',
              cluster: 'Online',
              caption: ['Capture, RequestConfirmation for a bank, then the wait', 'After the confirm: Verify, Execute, Fulfil'],
            },
          ],
          note: "The confirm and the no arrive as updates. No answer by the window's end: cancelled.",
        },
        {
          desc: 'Today, several instructions',
          flow: [
            {via: 'uws', name: 'CreatePaymentWithMultipleInstructions', cluster: 'Online'},
            {via: 'child', detail: 'one per instruction', name: 'CreateImmediatePayment', cluster: 'Online'},
          ],
        },
        {
          desc: 'Future-dated',
          flow: [{via: 'uws', name: 'CreateScheduledPayment', cluster: 'Online'}],
          fork: [
            {
              term: 'Consumer, one amount',
              via: 'row',
              detail: 'on the due date',
              flow: [{name: 'ExecuteScheduledPayment', cluster: 'Offline', caption: ['Runs it all itself: Reverify, Execute, Fulfil']}],
            },
            {
              term: 'Consumer, split',
              via: 'row',
              detail: 'on the due date',
              flow: [
                {name: 'ExecuteScheduledPayment', cluster: 'Offline'},
                {via: 'child', detail: 'one per leg', name: 'ExecuteSplitPayment', cluster: 'Offline'},
              ],
            },
            {
              term: 'Corporate',
              via: 'row',
              detail: 'at the fetch time',
              flow: [
                {name: 'RequestAllocations', cluster: 'Offline'},
                {via: 'async', detail: 'the callback, one per batch', name: 'ReceiveAllocations', cluster: 'Offline'},
                {via: 'row', detail: 'once allocated, at the execution time', name: 'ExecuteScheduledPayment', cluster: 'Offline'},
                {via: 'row', detail: 'one per leg, once it clears', name: 'ExecuteSplitPayment', cluster: 'Offline'},
              ],
              notes: ['No cancel or update once ALLOCATING.', 'Reverify runs first, on the due date.'],
            },
          ],
        },
      ],
    },
    {
      term: 'Pay & Plan',
      routes: [
        {
          desc: 'Pay today, plan future installments',
          flow: [
            {via: 'uws', name: 'Create Payment & Installments', cluster: 'Online'},
            {via: 'child', name: 'CreateImmediatePayment', cluster: 'Online'},
          ],
        },
      ],
    },
    {
      term: 'From Accounts Receivable',
      routes: [
        {
          desc: 'Future-dated',
          across: true,
          flow: [
            {via: 'inbox', detail: 'AR intake dispatcher', name: 'CreateScheduledPayment', cluster: 'Offline'},
            {via: 'row', detail: 'on the due date', name: 'ExecuteScheduledPayment', cluster: 'Offline'},
          ],
        },
      ],
    },
    {
      term: 'Update payment',
      routes: [
        {
          desc: 'SCHEDULED, inside the window',
          flow: [
            {via: 'uws', name: 'UpdatePayment', cluster: 'Online'},
            {via: 'child', detail: 'the new payment', name: 'CreateScheduledPayment', cluster: 'Online'},
          ],
        },
      ],
    },
    {
      term: 'Cancel payment',
      routes: [
        {desc: 'SCHEDULED, inside the window', flow: [{via: 'uws', name: 'CancelPayment', cluster: 'Online'}]},
        {desc: "PENDING, on the customer's no", flow: [{via: 'update', name: 'CreatePaymentIntent', cluster: 'Online'}]},
      ],
    },
    {
      term: 'Confirm payment',
      routes: [{desc: 'PENDING, confirmed at the bank or given the go-ahead', flow: [{via: 'update', name: 'CreatePaymentIntent', cluster: 'Online'}]}],
    },
    {
      term: 'Credit balance refund',
      routes: [
        {desc: 'From a channel', flow: [{via: 'uws', name: 'CreateBalanceRefund', cluster: 'Online'}]},
        {
          desc: 'Raised by AR',
          flow: [{via: 'inbox', detail: 'AR intake dispatcher', name: 'CreateBalanceRefund', cluster: 'Offline'}],
        },
      ],
    },
    {
      term: 'Money movement event',
      routes: [
        {
          desc: 'A return',
          flow: [{via: 'inbox', detail: 'returns dispatcher', name: 'ProcessReturnedPayment', cluster: 'Offline'}],
        },
      ],
    },
    {
      term: 'Representment falls due',
      routes: [
        {
          desc: 'A REPRESENT row',
          flow: [{via: 'row', detail: 'representment dispatcher', name: 'ProcessRepresentment', cluster: 'Offline'}],
        },
      ],
    },
    {
      term: 'Inbound payment',
      routes: [
        {
          desc: 'Pushed by a third party',
          flow: [{via: 'inbox', detail: 'inbound dispatcher', name: 'ProcessInboundPayment', cluster: 'Offline'}],
        },
      ],
    },
    {
      term: 'Allocations callback',
      routes: [
        {
          desc: 'A corporate payment',
          flow: [{via: 'async', detail: 'then 202', name: 'ReceiveAllocations', cluster: 'Offline'}],
          note: 'One per batch; the last one moves the payment to ALLOCATED',
        },
      ],
    },
  ]}
/>

Settlement and Accounts Receivable posting are the one input the Router never sees. One-Data pairs the two events in its inbox, and `ProcessPaidEventsWorkflow` pulls the payments that have both every 30 seconds ([Periodic Workflows](./component-model/workflows/periodic.md) has the detail).

## Child workflows

The behaviors pick the branch at each fork: `accountType` for consumer and corporate. Whether a create waits for the customer is decided before the fork, when the Router picks the journey: `requiresBankConfirmation` for a payment the customer confirms at their bank, and for a go-ahead, the other pending payments' IDs One-Data sends with the create, where the market's go-ahead setting is on. A consumer payment of one amount starts no child: its workflow runs every stage itself. The child in the several-instructions route runs once per instruction.

- A consumer split runs one `ExecuteSplitPaymentWorkflow` per leg, as children of the parent, on the parent's cluster. Verify's `ACCEPTED` commit writes the legs, and the parent commits `PROCESSED` once every leg has finished.
- A corporate payment starts no child at all. Verify's commit writes an `ALLOC_REQUEST` row, and every later step is a Work Tracker row that a dispatcher picks up: `RequestAllocationsWorkflow` asks for the breakdown, `ReceiveAllocationsWorkflow` takes each batch, and the batch that completes the amount writes the `ALLOC_EXEC` row. The allocated-payments dispatcher then starts `ExecuteScheduledPaymentWorkflow`, which clears the parent and releases its legs, and the leg dispatcher starts one `ExecuteSplitPaymentWorkflow` per leg, because one payment can have 100K of them. [Corporate Allocations](./corporate-allocations.md) has the whole flow.
- A request with several instructions never takes bank confirmation, and neither does Pay & Plan: one that would need it gets 422 before any workflow starts.
- A payment that waits for the customer starts no child either. `CreatePaymentIntentWorkflow` replies `PENDING` with the provider's redirect link, or the pending list for a go-ahead, and waits. The caller's confirm and the customer's no are updates to that same workflow, and if neither comes in time, its timer runs Cancel. After a confirm it runs Verify, Execute and Fulfil itself, or stops at `SCHEDULED` for a future-dated go-ahead.

No child workflow ever crosses clusters. A scheduled payment created on the Online cluster reaches the Offline cluster as a Work Tracker row in Oracle, written in the same commit as `SCHEDULED`.

## Re-routing on the due date

A scheduled payment can wait up to 30 days, and a market's config can change in that time. So on the due date the dispatcher calls the Router again, and the payment runs with today's config. The version it was scheduled under stays in its timeline for audit.

Two guardrails keep that safe. The plan key carries the resolved behaviors and the config version, so the running workflow never reads config that changed after it started. And the workflow is pinned to its build with Worker Versioning, so a deploy never changes its code mid-run.

## Workflow IDs

The payment ID is a ULID, and every workflow ID is the payment ID plus a suffix, such as `{paymentId}-init`, so any payment can be traced from its ID alone. The Work Tracker doesn't store workflow IDs at all.

| Thing | Workflow ID |
| --- | --- |
| Create or schedule, including a payment that waits for its customer | `{paymentId}-init` |
| Scheduled or corporate execution | `{paymentId}-execute` |
| Update and cancel | `{paymentId}-update`, `{paymentId}-cancel` |
| Allocation request and received batch | `{paymentId}-allocations`, `{paymentId}-allocations-{batch}` |
| Leg | `{paymentId}_{seq}-execute` |
| Return and representment | `{paymentId}-return-{seq}`, `{paymentId}-represent-{seq}` |
| Dispatcher run | Its Schedule's ID, such as `dispatch-sched-DE`, plus the trigger time |
| Governor | `governor`, plus its Schedule's trigger time |
| Market onboarding | `onboard-{market}-{accountType}-v{N}` |

The confirm and the no are not workflows. They are updates to the waiting payment's `{paymentId}-init`, with the update IDs `{paymentId}-confirm` and `{paymentId}-no`, so the whole wait and its answer show in one history.

On returns and representments, `{seq}` is the [presentment](./payment-state-model.md#presentments) sequence. A return's is the presentment that came back, and a representment's is the new one it sends, so a payment returned twice runs `-return-1`, `-represent-2`, `-return-2` and `-represent-3`.
