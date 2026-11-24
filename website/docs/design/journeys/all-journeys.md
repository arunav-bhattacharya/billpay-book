---
title: All Journeys
description: 'Every journey through Billpay starts one of two ways: a customer asks for something and waits for the answer, or an event, a callback or a date sets it off with nobody on the line.'
sidebar_label: All Journeys
---

import Lead from '@site/src/components/Lead';
import JourneyIndex from '@site/src/components/JourneyIndex';
import JourneyMap from '@site/src/components/JourneyMap';

export const GROUPS = [
  {
    label: 'Make a payment',
    journeys: [
      {label: 'Pay my bill today', to: '#pay-my-bill-today', kind: 'customer'},
      {label: 'Pay on a future date', to: '#pay-on-a-future-date', kind: 'customer'},
      {label: 'Pay by Bank today', to: '#pay-by-bank-today', kind: 'customer'},
      {label: 'Pay by Debit card', to: '#pay-by-debit-card', kind: 'customer'},
      {label: 'Pay with multiple instructions', to: '#pay-with-multiple-instructions', kind: 'customer'},
      {label: 'Pay with MR Points', to: '#pay-with-mr-points', kind: 'customer'},
      {label: 'Pay & Plan', to: '#pay--plan', kind: 'customer'},
    ],
  },
  {
    label: 'Change a payment',
    journeys: [
      {label: 'Update a payment', to: '#update-a-payment', kind: 'customer'},
      {label: 'Cancel a payment', to: '#cancel-a-payment', kind: 'customer'},
    ],
  },
  {
    label: 'Refund a balance',
    journeys: [
      {label: 'Initiate a credit balance refund', to: '#initiate-a-credit-balance-refund', kind: 'customer'},
    ],
  },
  {
    label: 'Read payments',
    journeys: [
      {label: 'Read payments by account', to: '#read-payments-by-card-account', kind: 'customer'},
      {label: 'Read details of a payment', to: '#read-details-of-a-payment', kind: 'customer'},
    ],
  },
  {
    label: 'Corporate payments',
    journeys: [
      {label: 'Pay a corporate bill today', to: '#pay-a-corporate-bill-today', kind: 'customer'},
      {label: 'Schedule a corporate payment', to: '#schedule-a-corporate-payment', kind: 'customer'},
      {label: 'Allocations arrive by callback', to: '#allocations-arrive-by-callback', kind: 'system'},
    ],
  },
  {
    label: 'After execution',
    journeys: [
      {label: 'A payment is paid', to: '#a-payment-is-paid', kind: 'system'},
      {label: 'A payment is returned', to: '#a-payment-is-returned', kind: 'system'},
      {label: 'A payment is represented', to: '#a-payment-is-represented', kind: 'system'},
    ],
  },
  {
    label: 'Other Payments',
    journeys: [
      {label: 'A third party pushes a payment', to: '#a-third-party-pushes-a-payment', kind: 'system'},
      {label: 'Accounts Receivable initiates a payment', to: '#accounts-receivable-initiates-a-payment', kind: 'system'},
    ],
  },
];

# All Journeys

<Lead>Every journey through Billpay starts one of two ways. A customer asks for something and waits for the answer, or an event, a callback or a date sets it off with nobody on the line. Both kinds are here, and each one says which it is.</Lead>

<JourneyIndex groups={GROUPS} />

<details>
<summary>How to read the diagrams</summary>

Every journey below uses the same diagram, so a step means the same thing throughout: what happens, which systems it calls, and the state the payment holds when it is done.

- A customer initiated journey opens with the person and the Amex channels they came in through. Its early steps are marked as the customer waiting, and the shaded region shows where the caller already has an answer and the rest runs with nobody watching.
- A system initiated journey opens with the event, the callback or the date that set it off. Nothing is marked as waiting and there is no shaded region, because nobody is on the line.
- When the route passes through One-Data's inbox and a dispatcher, the work waits in the inbox until the governor lets it in. Nothing is lost while it waits.
- A navy **Reply** flag marks the step where the workflow answers whoever called it. A pink flag marks a step something outside starts or resumes, and names how: an **Update** (a Temporal update, which answers its sender), a **Signal** (no answer back), a **Callback** from a partner system, a **Dispatcher** picking up a due row, or **Events** paired in One-Data's inbox. The connector into such a step is a pink dashed line, with no arrowhead: the step before it doesn't lead straight on, and the workflow waits until the trigger lands. The sequence diagrams draw the same triggers as pink arrows.

</details>

How the page a customer pays on turns into one of these journeys is on [Make a Payment Journey](./make-a-payment.md), and [The Complete Picture](./complete-picture.md) draws any one of them through every layer. To trace a request from the trigger it arrives on to the workflow that runs it, see [Routing](../routing.md).

## Make a payment

### Pay my bill today

A customer picks an amount and a way to pay, and wants it to count today. The journey runs on the Online cluster, started with Update-With-Start, and the customer gets an answer the moment Verify decides. The money moves after that, with nobody waiting on it.

<JourneyMap journey="pay-my-bill-today" />

### Pay on a future date

The customer picks a date inside the range Payment Options gives them. Billpay checks the payment now, so the customer knows straight away whether it will be attempted, then keeps it as a row in Oracle until the day. Nothing runs in Temporal while it waits.

<JourneyMap journey="pay-on-a-future-date" />

### Pay by Bank today

Some markets let a customer pay straight from their bank account, confirming the payment at their bank: Pay with Bank Transfer in the UK, Plaid in the US. Billpay talks to one service for all of them, Amex Pay with Bank Transfer, which works with each market's provider. The customer starts the payment as usual, goes to their bank, and comes back. When they are back, the channel tells Billpay, which asks Amex Pay with Bank Transfer how the payment went and answers with the status: `PENDING`, `ACCEPTED` or `DECLINED`. While the answer is pending, Billpay keeps asking until it has a final one. One workflow, `CreatePaymentIntentWorkflow`, runs all of it, so the payment's whole story shows in one place in the Temporal UI.

<JourneyMap journey="pay-by-bank-today" />

### Pay by Debit card

A customer can pay with a debit card, a way to pay of its own, apart from a bank account. Every debit card payment goes through 3D Secure, the card schemes' check that the customer is the cardholder. Billpay asks the market's card provider (Checkout.com in the UK) to start it, and the provider calls Billpay back once the card is authenticated. Then Billpay authorizes the payment, and the authorization takes the money from the customer's account if it holds enough. One workflow, `CreatePaymentIntentWorkflow`, holds the payment from the create to its end.

<JourneyMap journey="pay-by-debit-card" />

### Pay with multiple instructions

One request, more than one instruction. To the customer, that is a bank account and MR Points together, paid today. One-Data sends one payment ID and one idempotency key for each instruction. The composite captures and verifies every instruction itself and replies with each decision, then hands each accepted instruction's Execute and Fulfil to a child, all on the Online cluster. The composite's workflow has a unique ID of its own, and each instruction's child takes it with a suffix: `{groupId}-init` and `{groupId}_{paymentId}-init` (Proposed). A request with several instructions never takes bank confirmation or a debit card: one that would need either gets 422 before any workflow starts.

<JourneyMap journey="pay-with-multiple-instructions" />

### Pay with MR Points

Next to the way to pay, the customer can tick Pay with MR Points, to pay with their Membership Rewards points. Redeeming them is one call to Loyalty, and it belongs to the decision the customer waits for. So when the points are the only instruction, the payment runs as an ordinary payment today, in `CreateImmediatePaymentWorkflow`: Verify redeems the points last, once every other rule has passed, and a failed redemption declines the payment. There is no composite and no child workflow. With a bank account as well, it is two instructions, and runs as [Pay with multiple instructions](#pay-with-multiple-instructions).

Points pay today only. Once they are ticked, the page offers no later date, and a future-dated create with points is turned away with 422 (Proposed). A market offers points only where its Pay with MR Points setting is on (Proposed).

<JourneyMap journey="pay-with-mr-points" />

### Pay & Plan

The customer pays today and sets up a plan of future installments in the same request. One composite workflow, Create Payment & Installments, makes the decision itself and replies, then sets up the plan, on the Online cluster. It takes one instruction (Proposed).

<JourneyMap journey="pay-and-plan" />

## Change a payment

### Update a payment

Nothing is edited in place. Billpay cancels the original and raises a new payment with the new details, then ties the two together so the history reads straight. The customer keeps their confirmation number throughout.

<JourneyMap journey="update-a-payment" />

### Cancel a payment

A payment can be pulled back while it is `SCHEDULED`, inside the market's cancellation window. Once it has left `SCHEDULED`, it can no longer be cancelled. A corporate payment can close sooner: it leaves `SCHEDULED` for `ALLOCATING` when its allocations are requested, and from then on a cancel gets 409. The same call also carries a customer's no to a payment that waits for bank confirmation, with no window check, on [Pay by Bank today](#pay-by-bank-today).

<JourneyMap journey="cancel-a-payment" />

## Refund a balance

### Initiate a credit balance refund

When an account carries a credit balance, the money goes back to the customer. A refund can come from a channel or from Accounts Receivable, and the two start in different places.

<JourneyMap journey="initiate-a-credit-balance-refund" />

## Read payments

Reading touches none of the machinery above: no Router, no workflow, no state change. Both reads reach billpay-online, which reads Oracle. `ReadPayments.v1` also reads One-Data's Redis and removes duplicates, with Oracle's copy winning, so a payment shows from the moment it is made.

### Read payments by card account

Everything a customer has paid on one card. This is the payment history behind the web and mobile apps.

<JourneyMap journey="read-payments-by-card-account" />

### Read details of a payment

One payment, and every state it moved through on the way. This is what a servicing rep opens when a customer asks what happened to a particular payment.

<JourneyMap journey="read-details-of-a-payment" />

## Corporate payments

A corporate payment is paid once, as one amount, and the allocations manager supplies its breakdown into allocations. Billpay fetches that breakdown before the money moves, and the payment's own state shows how far it has got: `ALLOCATING` while the batches come in, `ALLOCATED` once they add up.

No workflow waits for the answer, and no workflow starts the next step itself. Each step is a Work Tracker row that a dispatcher picks up, so a payment made today and a scheduled one take the same path once they are `ALLOCATED`. [Corporate Allocations](../corporate-allocations.md) covers the whole flow.

### Pay a corporate bill today

The customer gets the same quick answer a consumer does. Behind it, the payment asks for its allocations, and only once they are all in does it clear and post its legs.

<JourneyMap journey="pay-a-corporate-bill-today" />

### Schedule a corporate payment

The same path, started by the date. The allocations are fetched on the due date or before it, and the payment executes at its execution time once they are all in.

<JourneyMap journey="schedule-a-corporate-payment" />

### Allocations arrive by callback

The breakdown itself. Billpay asks for it and then stops: no workflow waits for the answer. The allocations manager calls back, once or several times, and the batch that completes the amount makes the payment `ALLOCATED`.

<JourneyMap journey="allocations-arrive-by-callback" />

## After execution

### A payment is paid

This is where a payment turns `PAID`, or for a split payment, each of its legs. Billpay doesn't mark a payment paid because it sent the money. It waits for the bank to confirm the money settled and for Accounts Receivable to confirm it posted, and the two confirmations arrive on their own schedules. A debit card payment has no clearing, so MR/M3 sends no settlement. Billpay creates that event itself, in Execute, and it pairs with the posting like any other. A Pay with Bank Transfer payment has no clearing either, but M3 reports its settlement, and that notice is the settlement. M3 sends it to One-Data's `CreateBillpaySettlementEvent.v1`, which records it for the pairing (Proposed). MR Points and inbound payments have no clearing either, and Billpay creates their settlement events as it does a debit card's (agreed 2026-11-23).

<JourneyMap journey="a-payment-is-paid" />

### A payment is returned

Days after a payment looks finished, the bank can send the money back. Billpay reverses the payment, then decides whether it is worth presenting again. This journey ends by queueing that second attempt, not by making it.

<JourneyMap journey="a-payment-is-returned" />

### A payment is represented

The second attempt queued by a return, run on the day it falls due. Billpay checks the representment still makes sense before anything goes to clearing, because the reason a payment came back can outlive the return.

<JourneyMap journey="a-payment-is-represented" />

## Other Payments

### A third party pushes a payment

Someone other than the cardmember pushes money at the account. Amex didn't ask for it, so the first question is whether it will be accepted at all.

<JourneyMap journey="a-third-party-pushes-a-payment" />

### Accounts Receivable initiates a payment

Some payments start inside Amex. Accounts Receivable raises them on the customer's behalf, in bulk, and they run as scheduled payments with nobody on the line. One dated today is scheduled too, and executes the same day (agreed 2026-11-07).

<JourneyMap journey="accounts-receivable-initiates-a-payment" />

## Where to go deeper

- [Payment State Model](../payment-state-model.md): what each state means, and which stage makes each move
- [Core Workflows](../component-model/workflows/core.md): the step-by-step logic behind each journey
- [Stages](../component-model/stages.md): the business steps the workflows compose
- [Pacing](../pacing.md): how dispatchers and the governor decide when offline work runs
- [Corporate Allocations](../corporate-allocations.md): how a corporate payment fetches its allocations before it moves money
- [Sequence Diagrams](../sequence-diagrams.md): the same journeys at engineering resolution
- [Routing](../routing.md): every trigger, the workflow it starts and the cluster it runs on
