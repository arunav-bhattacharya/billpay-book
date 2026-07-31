---
title: Customer Initiated
sidebar_label: Customer initiated
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import JourneyMap from '@site/src/components/JourneyMap';

# Customer Initiated Journeys

<Lead accent="var(--amex-cat-design)">A person starts every journey on this page. They pay a bill, change one, or look one up, and they are waiting for an answer while Billpay works.</Lead>

## Journeys at a glance

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Make a payment',
      links: [
        {to: '#pay-my-bill-today', label: 'Pay my bill today'},
        {to: '#pay-on-a-future-date', label: 'Pay on a future date'},
        {to: '#pay-with-points--money', label: 'Pay with Points & Money'},
        {to: '#pay--plan', label: 'Pay & Plan'},
      ],
    },
    {
      term: 'Change a payment',
      links: [
        {to: '#update-a-payment', label: 'Update a payment'},
        {to: '#cancel-a-payment', label: 'Cancel a payment'},
      ],
    },
    {
      term: 'Read payments',
      links: [
        {to: '#read-payments-by-card-account', label: 'Read payments by account'},
        {to: '#read-details-of-a-payment', label: 'Read details of a payment'},
      ],
    },
    {
      term: 'Refund a balance',
      links: [
        {to: '#initiate-a-credit-balance-refund', label: 'Initiate a credit balance refund'},
      ],
    },
    {
      term: 'Create an intent to pay',
      links: [
        {to: '#intent-to-pay', label: 'Intent to pay'},
      ],
    },
  ]}
/>

Journeys nobody starts by hand, such as returns, third-party pushes and the settlement that closes every payment out, are on [System Initiated](./system-initiated.md).

<details>
<summary>How to read the diagrams</summary>

Every journey below uses the same diagram, so a step means the same thing throughout: what happens, which systems it calls, and the state the payment holds when it is done.

- Each one opens with the person and the Amex channels they came in through.
- The early steps are marked as the customer waiting.
- The shaded region shows where the caller already has its answer and the rest runs unwatched.

The [system initiated](./system-initiated.md) journeys use the same diagram without those three marks, because nothing on that page is a request.

</details>

## Pay my bill today

A customer picks an amount and a way to pay it, and wants it to count today. Billpay answers as soon as it accepts the payment. The money moves after that, and the payment is not finished until both the bank and Accounts Receivable confirm it.

<JourneyMap
  eyebrow="Immediate payment"
  title="Pay my bill today"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
    note: 'Channels are how we describe the ways in. Billpay sees an authenticated request, and the spec only says "an end user".',
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={{label: 'CreateImmediatePaymentWF'}}
  steps={[
    {
      icon: 'fingerprint',
      name: 'Capture',
      state: 'PENDING',
      mode: 'live',
    },
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options'],
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'AMP'],
      parallel: true,
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'Lumi', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Post',
      state: 'PAID',
      mode: 'awaiting',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {
      step: 1,
      text: 'Billpay writes the payment and its idempotency key together. If the same request arrives twice the second write fails, and the customer gets the original payment back. Nobody is charged twice.',
    },
    {
      step: 2,
      text: 'Payment Instruments confirms the way the customer is paying. Payment Options confirms the amount they picked. Billpay accepts or declines on those two answers.',
    },
    {
      text: 'The caller gets its answer as soon as the payment is accepted. Everything after that runs with nobody waiting on it.',
    },
    {
      step: 3,
      text: 'Three calls go out at once: clearing at the bank, statement balance down, available credit up. Corporate payments fetch their allocation breakdown first, then run one execution per allocation.',
    },
    {
      step: 4,
      text: 'Accounting, audit and risk hear about the payment first. The customer confirmation goes out last.',
    },
    {
      step: 5,
      text: 'The payment holds at PROCESSED until the bank confirms it settled and Accounts Receivable confirms it posted. If either is still missing after 48 hours, Billpay asks the system that owes it, or raises an alert.',
    },
  ]}
  reference={{to: '/docs/design/sequence-diagrams#1-immediate-payment-single-instruction', label: 'Sequence diagram'}}
/>

## Pay on a future date

The customer picks a date. Billpay checks the payment now so they hear straight away whether it will be attempted, then parks it. On the day, a timer wakes it and checks again, because things change while a payment sits: an account gets closed, a balance moves.

<JourneyMap
  eyebrow="Scheduled payment"
  title="Pay on a future date"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={[
    {label: 'CreateSchedulePaymentWF'},
    {label: 'ExecuteScheduledPaymentWF', note: 'on the due date'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'SCHEDULED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options'],
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'SCHEDULED',
      mode: 'awaiting',
      caption: 'until the due date',
      exit: {state: 'CANCELLED', label: 'if the customer cancels first'},
    },
    {
      icon: 'recheck',
      name: 'Re-verify',
      state: 'ACCEPTED',
      mode: 'background',
      caption: 'checked again, on the day',
      systems: ['Payment Instruments', 'Payment Options'],
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'AMP'],
      parallel: true,
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'Lumi', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Post',
      state: 'PAID',
      mode: 'awaiting',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {step: 1, text: 'The same single write as an immediate payment, so a repeat request gets the original back.'},
    {step: 2, text: 'Checked now, not on the day. The customer finds out immediately whether Billpay will attempt this payment, and the answer is SCHEDULED rather than paid.'},
    {step: 3, text: 'Nothing happens until the date arrives. The customer can still change or cancel the payment during this time.'},
    {step: 4, text: 'The Scheduled Payments Executor picks up due payments in waves, roughly 2,500 a minute, and checks them again. A payment valid last week can fail today, so this second check is not a formality.'},
    {text: 'From here the journey is identical to [Pay my bill today](#pay-my-bill-today): the money moves, everyone downstream is told, and the payment closes once the bank and Accounts Receivable both confirm it.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#2-scheduled-payment-created-today-and-executed-later', label: 'Sequence diagram'}}
/>

## Pay with Points & Money

One request, more than one instruction. The customer settles part of the bill with points and the rest from a bank account. Billpay checks the request as a whole, then runs each instruction as its own payment.

<JourneyMap
  eyebrow="Multiple instructions"
  title="Pay with Points & Money"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={[
    {label: 'CreatePaymentWithMultipleInstructionsWF'},
    {label: 'CreateImmediatePaymentWF', via: 'calls', child: true, note: 'one per instruction'},
  ]}
  persist={false}
  band={false}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Verify',
      caption: 'all instructions together',
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'parallelArrows',
      name: 'Split',
      caption: 'a child workflow each',
    },
    {
      branches: [
        {
          name: 'Pay with Points',
          icon: 'orchestrate',
          states: ['PENDING', 'PAID'],
          note: 'CreateImmediatePaymentWF',
        },
        {
          name: 'Pay with Money',
          icon: 'orchestrate',
          states: ['PENDING', 'PAID'],
          note: 'CreateImmediatePaymentWF',
        },
      ],
    },
    {
      icon: 'doubleCheck',
      name: 'Rejoin',
      caption: 'both children done',
    },
  ]}
  detail={[
    {step: 1, text: 'The instructions are checked as one request. The customer gets a single answer for the whole thing, not one answer per instruction, and a request that fails here fails entirely.'},
    {step: 2, text: 'Once it passes, the payment splits. Each instruction starts its own CreateImmediatePaymentWF, and each of those runs [Pay my bill today](#pay-my-bill-today) end to end with its own states and its own confirmations.'},
    {step: 3, text: 'The parent waits for both children to finish before control comes back to it. Points and cash are one payment to the customer, so neither half is done until both are.'},
  ]}
/>

## Pay & Plan

The customer pays something now and spreads the rest. One workflow drives both halves at once: the payment goes through Billpay while the plan is set up in Globestar.

<JourneyMap
  title="Pay & Plan"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'CreatePaymentInstallment.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payment-installments'}]}
  workflow={[
    {label: 'Create Payment & Installments'},
    {label: 'CreateImmediatePaymentWF', via: 'calls', child: true},
  ]}
  persist={false}
  band={false}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Verify',
      caption: 'the payment and the plan',
      exit: {state: 'DECLINED'},
    },
    {
      branches: [
        {
          name: 'Pay now',
          icon: 'orchestrate',
          states: ['PENDING', 'PAID'],
          note: 'CreateImmediatePaymentWF',
        },
        {
          name: 'Plan',
          icon: 'calendar',
          systems: ['Globestar'],
          note: 'an API request, not a workflow',
        },
      ],
    },
    {
      icon: 'doubleCheck',
      name: 'Rejoin',
      caption: 'both halves done',
    },
  ]}
  detail={[
    {text: 'Create Payment & Installments orchestrates both halves. It calls CreateImmediatePaymentWF for the payment and, in parallel, sends an API request to Globestar to set up the plan. Neither waits on the other. The spec names this composite in prose only, so unlike the core workflows it has no WF identifier yet.'},
    {step: 2, text: 'The payment itself is [Pay my bill today](#pay-my-bill-today), unchanged. Nothing about the plan alters how the money moves, or how it settles.'},
    {step: 3, text: 'Globestar holds the plan for the balance the customer chose to spread. Billpay does not own instalments, it only asks for them.'},
    {text: 'Running the two together is what makes this a composite journey. The customer asked for one thing, so they should not wait for a payment to finish before a plan exists.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#12-create-payment--installments-composite', label: 'Sequence diagram'}}
/>

## Update a payment

Nothing is edited in place. Billpay cancels the original and re-initiates it with the new details, then ties the two together so the history reads straight. The customer keeps their confirmation number throughout.

<JourneyMap
  title="Update a payment"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'UpdatePayment.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'PUT /payments/{payment-id}'}]}
  workflow={[
    {label: 'UpdatePaymentWF'},
    {label: 'CancelPaymentWF', via: 'calls', child: true},
    {label: 'CreateSchedulePaymentWF', via: 'and', child: true},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', mode: 'live', caption: 'recorded once'},
    {
      icon: 'undo',
      name: 'Cancel',
      state: 'CANCELLED',
      mode: 'live',
      caption: 'the original payment',
    },
    {
      icon: 'calendar',
      name: 'Re-initiate',
      state: 'SCHEDULED',
      mode: 'live',
      caption: 'same confirmation number',
      systems: ['Payment Instruments', 'Payment Options'],
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'database',
      name: 'Link',
      table: 'ORIG_TRANS_REFER_MAP',
      mode: 'background',
      caption: 'old payment to new',
    },
  ]}
  detail={[
    {text: 'UpdatePaymentWF does not do the cancelling and rescheduling itself. It calls CancelPaymentWF to stop the original and CreateSchedulePaymentWF to raise the replacement, so an update behaves exactly like doing both by hand.'},
    {step: 1, text: 'A repeat of the same update request returns the previous response rather than cancelling anything twice.'},
    {step: 2, text: 'The scheduled payment is cancelled outright. There is no edit path, which keeps every payment record immutable once written.'},
    {step: 3, text: 'A new payment is raised from the updated details. It gets a new payment id but keeps the same confirmation number, so the customer sees one continuous payment rather than two.'},
    {step: 4, text: 'The new payment id is mapped to the old one, so an auditor can follow the chain later.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#5-update-a-scheduled-payment', label: 'Sequence diagram'}}
/>

## Cancel a payment

A payment can be pulled back while it is still waiting or accepted. Once the money is moving, it is too late, and a return is the only way back.

<JourneyMap
  title="Cancel a payment"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'DeletePayment.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'DELETE /payments/{payment-id}'}]}
  workflow={{label: 'CancelPaymentWF'}}
  steps={[
    {icon: 'fingerprint', name: 'Capture', mode: 'live', caption: 'recorded once'},
    {
      icon: 'shieldCheck',
      name: 'Check',
      mode: 'live',
      caption: 'is it still stoppable',
      exit: {label: 'already processing, so it cannot be pulled back'},
    },
    {
      icon: 'undo',
      name: 'Cancel',
      state: 'CANCELLED',
      mode: 'live',
      caption: 'customer gets a response',
    },
  ]}
  detail={[
    {step: 1, text: 'A repeat cancel request returns the previous response, so pressing twice does nothing new.'},
    {step: 2, text: 'Billpay calls out to confirm the payment can still be stopped, and reads its current state. Only SCHEDULED and ACCEPTED payments qualify.'},
    {step: 3, text: 'The payment moves to CANCELLED and stays there. It is a terminal state, so nothing picks it up later.'},
    {text: 'A payment already sent for clearing cannot be cancelled. Getting that money back means a return, which is on [System Initiated](./system-initiated.md).'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#6-cancel-a-payment', label: 'Sequence diagram'}}
/>

## Intent to pay

Some payments are not Amex's to accept. The customer signals an intent, and it is only processed once their bank confirms it.

<JourneyMap
  eyebrow="Payment intent"
  title="Intent to pay"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
    ],
  }}
  entry={[{kind: 'function', label: 'CreatePaymentIntent.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments/intent'}]}
  workflow={{label: 'CreatePaymentIntentWF'}}
  status={{
    kind: 'tbd',
    note: 'The route to the workflow is settled. The workflow logic itself is marked TBD in the spec, so there is no journey to draw yet.',
  }}
/>

## Initiate a credit balance refund

When an account carries a credit balance, the money goes back to the customer.

<JourneyMap
  eyebrow="Credit balance refund"
  title="Initiate a credit balance refund"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [{icon: 'headset', label: 'Servicing rep'}],
  }}
  entry={[{kind: 'function', label: 'CreateCreditBalanceRefund.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /refunds'}]}
  workflow={{label: 'CreateBalanceRefundWF'}}
  status={{
    kind: 'unmapped',
    note: 'The function, the endpoint and the workflow all exist in the spec, but it never says which routes to which, and never describes the steps. The chain above is what the naming implies, not a documented route.',
  }}
/>

## Read payments by card account

Everything a customer has paid on one card. This is the payment history screen behind the web and mobile apps. Reading touches none of the machinery on this page: no router decision, no workflow, no state change.

<JourneyMap
  eyebrow="Reads"
  title="Read payments by card account"
  origin={{
    actor: 'Cardmember or servicing rep',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
  }}
  entry={[{kind: 'function', label: 'ReadPayments.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'GET /payments/account/{account-id}'}]}
  status={{
    kind: 'read-only',
    note: 'Lists every payment on the account. The endpoint pairing is inferred from the naming, because reads do not appear in the router table.',
  }}
/>

## Read details of a payment

One payment, and every state it moved through on the way. This is what a servicing rep opens when a customer asks what happened to a particular payment.

<JourneyMap
  eyebrow="Reads"
  title="Read details of a payment"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [{icon: 'headset', label: 'Servicing rep'}],
  }}
  entry={[{kind: 'function', label: 'ReadPaymentEventsById.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'GET /payments/{payment-id}'}]}
  status={{
    kind: 'read-only',
    note: 'Returns the lifecycle history of a single payment, which is the audit trail written at every state change on the diagrams above. Like the account read, the endpoint pairing is inferred rather than stated.',
  }}
/>

## Where to go deeper

- [Payment state model](../payment-state-model.md), what each state means and which ones are final
- [Workflows](../component-model/workflows/core.md), the step-by-step logic behind each journey
- [Stages](../component-model/stages.md), the state-transition units the workflows compose
- [Sequence diagrams](../sequence-diagrams.md), the same journeys at engineering resolution
- [Routing](../component-model/routing.md), the full router table with every trigger and child workflow
