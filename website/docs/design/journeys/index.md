---
title: Payment Journeys
sidebar_label: Journeys
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
      {label: 'Pay with Points & Money', to: '#pay-with-points--money', kind: 'customer'},
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
    label: 'Initiate payment intent',
    journeys: [{label: 'Intent to pay', to: '#intent-to-pay', kind: 'customer'}],
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
      {label: 'Get corporate payment allocations', to: '#get-corporate-payment-allocations', kind: 'system'},
    ],
  },
  {
    label: 'Post payment execution',
    journeys: [
      {label: 'A payment is posted', to: '#a-payment-is-posted', kind: 'system'},
      {label: 'A payment is returned', to: '#a-payment-is-returned', kind: 'system'},
      {label: 'A payment is represented', to: '#a-payment-is-represented', kind: 'system'},
    ],
  },
  {
    label: 'Payments raised elsewhere',
    journeys: [
      {label: 'A third party pushes a payment', to: '#a-third-party-pushes-a-payment', kind: 'system'},
      {label: 'Accounts Receivable initiates a payment', to: '#accounts-receivable-initiates-a-payment', kind: 'system'},
    ],
  },
];

# Payment Journeys

<Lead accent="var(--amex-cat-design)">Every journey through Billpay starts one of two ways. A customer asks for something and waits for the answer, or an event or a timer sets it off with nobody on the line. Both kinds are here, and each one says which it is.</Lead>

<JourneyIndex groups={GROUPS} />

<details>
<summary>How to read the diagrams</summary>

Every journey below uses the same diagram, so a step means the same thing throughout: what happens, which systems it calls, and the state the payment holds when it is done.

- A customer initiated journey opens with the person and the Amex channels they came in through. Its early steps are marked as the customer waiting, and the shaded region shows where the caller already has its answer and the rest runs unwatched.
- A system initiated journey opens with the event, the file or the schedule that set it off. Nothing is marked as waiting and there is no shaded region, because none of it is a request.

</details>

To trace a request from the trigger it arrives on to the workflow that runs it, see [Routing](../routing.md).

## Make a payment

### Pay my bill today

A customer picks an amount and a way to pay it, and wants it to count today. Billpay answers as soon as it accepts the payment. The money moves after that, and the payment is not finished until both the bank and Accounts Receivable confirm it.

<JourneyMap
  kind="customer"
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
      text: 'Three calls go out at once: clearing at the bank, statement balance down, available credit up. A corporate payment takes a different route from here, on [Pay a corporate bill today](#pay-a-corporate-bill-today).',
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

### Pay on a future date

The customer picks a date. Billpay checks the payment now so they hear straight away whether it will be attempted, then parks it. On the day, a timer wakes it and checks again, because things change while a payment sits: an account gets closed, a balance moves.

<JourneyMap
  kind="customer"
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

### Pay with Points & Money

One request, more than one instruction. The customer settles part of the bill with points and the rest from a bank account. Billpay checks the request as a whole, then runs each instruction as its own payment.

<JourneyMap
  kind="customer"
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

### Pay & Plan

The customer pays something now and spreads the rest. One workflow drives both halves at once: the payment goes through Billpay while the plan is set up in Globestar.

<JourneyMap
  kind="customer"
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

## Change a payment

### Update a payment

Nothing is edited in place. Billpay cancels the original and re-initiates it with the new details, then ties the two together so the history reads straight. The customer keeps their confirmation number throughout.

<JourneyMap
  kind="customer"
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

### Cancel a payment

A payment can be pulled back while it is still waiting or accepted. Once the money is moving, it is too late, and a return is the only way back.

<JourneyMap
  kind="customer"
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
    {text: 'A payment already sent for clearing cannot be cancelled. Getting that money back means [a return](#a-payment-is-returned).'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#6-cancel-a-payment', label: 'Sequence diagram'}}
/>

## Refund a balance

### Initiate a credit balance refund

When an account carries a credit balance, the money goes back to the customer.

<JourneyMap
  kind="customer"
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

## Initiate payment intent

### Intent to pay

Some payments are not Amex's to accept. The customer signals an intent, and it is only processed once their bank confirms it.

<JourneyMap
  kind="customer"
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

## Read payments

Reading touches none of the machinery above: no router decision, no workflow, no state change.

### Read payments by card account

Everything a customer has paid on one card. This is the payment history screen behind the web and mobile apps.

<JourneyMap
  kind="customer"
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

### Read details of a payment

One payment, and every state it moved through on the way. This is what a servicing rep opens when a customer asks what happened to a particular payment.

<JourneyMap
  kind="customer"
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

## Corporate payments

A corporate account does not settle one balance. A single payment covers a set of accounts under the arrangement, and Allocations Manager owns how the money divides between them. That one difference reshapes the whole journey: Billpay accepts the payment, asks for the breakdown, then runs a separate execution for every allocation it gets back.

Corporate payments also use two lifecycle states nothing else does, ALLOCATING and ALLOCATED. See the [payment state model](../payment-state-model.md) for where they sit.

### Pay a corporate bill today

The customer gets the same immediate answer a consumer does. Behind it, the payment goes for clearing as one amount, then splits into a leg per allocation once the breakdown arrives.

<JourneyMap
  kind="customer"
  eyebrow="Immediate payment, corporate"
  title="Pay a corporate bill today"
  origin={{
    actor: 'Corporate customer',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
    note: 'The spec only says "an end user". Which channels a corporate market opens is a market onboarding decision, not a Billpay one.',
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={[
    {label: 'CreateImmediatePaymentWF'},
    {label: 'GetCorporatePaymentAllocationsWF', via: 'calls', child: true},
    {label: 'ExecuteSplitPaymentWF', via: 'then', child: true},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
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
      icon: 'bank',
      name: 'Clear',
      state: 'PROCESSING',
      mode: 'background',
      caption: 'the bank only',
      systems: ['MR/M3'],
    },
    {
      icon: 'orchestrate',
      name: 'Allocate',
      state: 'ALLOCATING',
      mode: 'background',
      caption: 'ask for the breakdown',
      systems: ['Allocations'],
      exit: {state: 'DECLINED', label: 'if the breakdown never arrives'},
    },
    {
      icon: 'doubleCheck',
      name: 'Receive',
      state: 'ALLOCATED',
      mode: 'background',
      caption: 'the breakdown is in',
    },
    {
      icon: 'parallelArrows',
      name: 'Split',
      state: 'ACCEPTED',
      table: 'split_trans_dtl',
      mode: 'background',
      caption: 'one leg per allocation',
    },
    {
      icon: 'broadcast',
      name: 'Execute each leg',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['GAR', 'AMP'],
      parallel: true,
    },
  ]}
  detail={[
    {step: 1, text: 'The same single write as any other payment, so a repeat request returns the original.'},
    {step: 2, text: 'The payment is checked as one amount, against the total the customer asked to pay. They hear ACCEPTED or DECLINED before any corporate work starts.'},
    {step: 3, text: 'Clearing runs on the parent payment and stops there. Accounts Receivable and Authorizations are deliberately not told at this point, because the figures they need are per allocation and the allocations do not exist yet. This is the one place the corporate route diverges from [Pay my bill today](#pay-my-bill-today).'},
    {step: 4, text: 'Billpay asks Allocations Manager for the breakdown and marks the payment as having requested it. If the breakdown cannot be fetched the payment is declined.'},
    {step: 5, text: 'The breakdown arrives as a signal and the parent moves to ALLOCATED. The parent never moves money again after this. The legs do.'},
    {step: 6, text: 'One split payment per allocation, written in ACCEPTED with its own lifecycle history, so each leg can be traced on its own.'},
    {step: 7, text: 'Each leg runs ExecuteSplitPaymentWF: statement balance down, available credit up, for its own allocation. Clearing already happened once on the parent, so the legs do not repeat it. The steps from 4 onwards are [Get corporate payment allocations](#get-corporate-payment-allocations), drawn on its own below.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#3-immediate-corporate-payment', label: 'Sequence diagram'}}
/>

### Schedule a corporate payment

The same breakdown, fetched early. Billpay parks the payment, asks for the allocations ahead of the date, and has every leg written and waiting before the executor wakes it.

<JourneyMap
  kind="customer"
  eyebrow="Scheduled payment, corporate"
  title="Schedule a corporate payment"
  origin={{
    actor: 'Corporate customer',
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
    {label: 'GetCorporatePaymentAllocationsWF', via: 'calls', child: true},
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
      icon: 'orchestrate',
      name: 'Allocate',
      state: 'ALLOCATING',
      mode: 'background',
      caption: 'ahead of the date',
      systems: ['Allocations'],
      exit: {state: 'DECLINED', label: 'if the breakdown never arrives'},
    },
    {
      icon: 'parallelArrows',
      name: 'Receive and split',
      state: 'ALLOCATED',
      table: 'split_trans_dtl',
      mode: 'background',
      caption: 'one leg per allocation',
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'ALLOCATED',
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
      icon: 'broadcast',
      name: 'Execute each leg',
      state: 'PROCESSED',
      mode: 'background',
      caption: 'clearing on the parent, balances per leg',
      systems: ['MR/M3', 'GAR', 'AMP'],
      parallel: true,
    },
  ]}
  detail={[
    {text: 'The shape is [Pay on a future date](#pay-on-a-future-date), with the allocation work slotted in while the payment waits.'},
    {step: 2, text: 'SCHEDULED, exactly as a consumer payment would be, and the customer can still change or cancel it.'},
    {step: 3, text: 'Allocations are requested before the payment date, either on the day or a set number of days ahead of it. Asking early is what stops the executor waiting on another system when the date arrives.'},
    {step: 4, text: 'The parent settles at ALLOCATED with every leg already written. Nothing runs yet.'},
    {step: 6, text: 'The Scheduled Payments Executor picks up due payments in waves, roughly 2,500 a minute, and checks each one again before any money moves.'},
    {step: 7, text: 'Clearing runs once, on the parent. Each leg then updates the statement balance and the available credit for its own allocation, through ExecuteSplitPaymentWF.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#4-scheduled-corporate-payment', label: 'Sequence diagram'}}
/>

### Get corporate payment allocations

The breakdown itself, as its own workflow. Both corporate journeys above call it, and it is the one workflow in Billpay that stops and waits for another system to call back.

<JourneyMap
  kind="system"
  eyebrow="Corporate allocations"
  title="Get corporate payment allocations"
  topLayer="Started by another workflow"
  origin={{
    channelsLabel: 'Callers',
    brandLogo: false,
    channels: [
      {icon: 'orchestrate', label: 'CreateImmediatePaymentWF'},
      {icon: 'orchestrate', label: 'CreateSchedulePaymentWF'},
      {icon: 'orchestrate', label: 'ExecuteScheduledPaymentWF'},
    ],
  }}
  entryVia="triggers"
  entry={[{kind: 'workflow', label: 'Child workflow, Offline worker'}]}
  workflow={[
    {label: 'GetCorporatePaymentAllocationsWF'},
    {label: 'ExecuteSplitPaymentWF', via: 'calls', child: true},
  ]}
  band={false}
  steps={[
    {
      icon: 'orchestrate',
      name: 'Request',
      state: 'ALLOCATING',
      mode: 'background',
      caption: 'ask for the breakdown',
      systems: ['Allocations'],
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'ALLOCATING',
      mode: 'awaiting',
      caption: 'for the signal to come back',
      exit: {state: 'DECLINED', label: 'if the breakdown never arrives'},
    },
    {
      icon: 'doubleCheck',
      name: 'Receive',
      state: 'ALLOCATED',
      mode: 'background',
      caption: 'the parent is done moving money',
    },
    {
      icon: 'parallelArrows',
      name: 'Split',
      state: 'ACCEPTED',
      table: 'split_trans_dtl',
      mode: 'background',
      caption: 'one leg per allocation',
    },
    {
      icon: 'broadcast',
      name: 'Hand off',
      mode: 'background',
      caption: 'a workflow per leg',
    },
  ]}
  detail={[
    {text: 'Billpay does not work a corporate breakdown out for itself. Allocations Manager owns which accounts a payment applies to and in what amounts, and this workflow is how Billpay asks.'},
    {step: 1, text: 'ToAllocatingStage calls Allocations Manager for this payment and records that the allocations have been requested. ALLOCATING and ALLOCATED are the two lifecycle states only corporate payments reach.'},
    {step: 2, text: 'This is the only place in Billpay where a workflow stops and waits on another system to call back. Temporal holds it open until the AllocationsReady signal arrives, however long that takes. If the breakdown cannot be fetched the payment is declined.'},
    {step: 3, text: 'The parent payment moves to ALLOCATED. From here it is a container: every amount that still has to move belongs to a leg.'},
    {step: 4, text: 'One split payment per allocation, each written in ACCEPTED with its own lifecycle history.'},
    {step: 5, text: 'Each leg runs ExecuteSplitPaymentWF. The Corporate Allocations Processor schedule also starts them in waves of roughly 2,500 a minute, which is how a large breakdown gets through without one workflow fanning out to hundreds of children at once.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#3-immediate-corporate-payment', label: 'Sequence diagram'}}
/>

## Post payment execution

### A payment is posted

This is where every customer payment ends. Billpay does not mark a payment paid just because it sent the money. It waits for the bank to confirm the money settled and for Accounts Receivable to confirm it posted. The two confirmations arrive at their own pace, and a timer matches them up.

<JourneyMap
  kind="system"
  title="A payment is posted"
  topLayer="Events from other systems"
  origin={{
    channelsLabel: 'Sources',
    brandLogo: false,
    channels: [
      {icon: 'bank', label: 'MR/M3 settled'},
      {icon: 'database', label: 'GAR posted'},
    ],
  }}
  entry={[{kind: 'event', label: 'Event handlers'}]}
  core={[{kind: 'schedule', label: 'Paid Events Processor'}]}
  workflow={{label: 'PaidEventsProcessingWF'}}
  persist={false}
  steps={[
    {
      icon: 'doubleCheck',
      name: 'Reconcile',
      table: 'External Transaction Events Tracker',
      mode: 'background',
      caption: 'both confirmations in',
      exit: {label: 'one still missing, so the payment waits'},
    },
    {
      icon: 'lock',
      name: 'Claim',
      table: 'External Transaction Events Tracker',
      mode: 'background',
      caption: 'so no run repeats it',
    },
    {
      icon: 'bank',
      name: 'Mark paid',
      state: 'PAID',
      mode: 'background',
      caption: 'the payment is closed',
      systems: ['Lumi'],
    },
  ]}
  detail={[
    {
      text: 'A payment reaches this point already processed. The money has gone to the bank and the balances are updated, but nobody has confirmed it landed yet.',
    },
    {
      text: 'Two systems owe that confirmation. The bank says the money settled, Accounts Receivable says the payment posted. Their event handlers write each one into the External Transaction Events Tracker as it arrives. Neither changes the payment on its own.',
    },
    {
      step: 1,
      text: 'The Paid Events Processor wakes on its schedule and reads the tracker, looking for payments that now hold both confirmations. A payment with only one is left alone and picked up on a later run.',
    },
    {
      step: 2,
      text: 'The rows it found are marked as picked up. Runs overlap, and this is what stops two of them closing the same payment twice.',
    },
    {
      step: 3,
      text: 'Now the payment is done. PAID goes into its lifecycle history, its status changes to PAID, and the PAID event goes out to everyone downstream.',
    },
    {
      text: 'If a confirmation never turns up, the payment would sit here forever. After 48 hours the Missing Paid Events Processor, a separate schedule, asks the system that owes the event. It either records the answer so the next run can finish the payment, or raises an alert for someone to look at.',
    },
  ]}
  reference={{to: '/docs/design/sequence-diagrams#10-paid-events-reconciliation', label: 'Sequence diagram'}}
/>

Nothing here is a single request. The two confirmations land whenever the owning system produces them, the event handlers write each one into the tracker, and this workflow only acts once both are there.

### A payment is returned

Days after a payment looks finished, the bank can send the money back. Billpay reverses the payment, then decides whether it is worth presenting again. Most returns are worth one more try, and this journey ends by queueing that second attempt rather than making it.

<JourneyMap
  kind="system"
  title="A payment is returned"
  topLayer=""
  origin={{
    actor: 'Bank',
    icon: 'bank',
    channelsLabel: null,
    channels: [{icon: 'undo', label: 'MR/M3 returned'}],
  }}
  entry={[{kind: 'event', label: 'Money movement handler'}]}
  core={[{kind: 'api', label: 'POST /payments/returns'}]}
  workflow={{label: 'ProcessReturnedPaymentWF'}}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Check',
      mode: 'background',
      caption: 'can this be returned',
      exit: {label: 'not in a returnable state'},
    },
    {
      icon: 'undo',
      name: 'Return',
      state: 'RETURNED',
      mode: 'background',
      caption: 'the money goes back',
    },
    {
      icon: 'recheck',
      name: 'Judge',
      mode: 'background',
      caption: 'worth another try',
      exit: {label: 'not representable, so it stays returned'},
    },
    {
      icon: 'calendar',
      name: 'Queue',
      state: 'REPRESENTING',
      mode: 'background',
      caption: 'a date to retry',
    },
  ]}
  detail={[
    {step: 1, text: 'Only a payment that got far enough can come back. Billpay looks it up and confirms it is PAID, PROCESSING or PROCESSED before touching anything.'},
    {step: 2, text: 'The payment moves to RETURNED. This is the one terminal state that is neither a success nor a failure: the payment happened, and then it unhappened.'},
    {step: 3, text: 'Not every return is worth chasing. Billpay checks the rules for this payment and works out the next date it could reasonably be presented.'},
    {step: 4, text: 'A retry is a new presentment against the same payment, written as its own transaction and left at REPRESENTING until its date comes round. Nothing is sent yet.'},
    {text: 'What happens on that date is [A payment is represented](#a-payment-is-represented).'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#7-return-processing--representment-eligibility-check', label: 'Sequence diagram'}}
/>

### A payment is represented

The retry queued by a return, run on the day it comes due. Billpay checks the representment still makes sense before it sends anything, because the reason a payment was returned can outlive the return.

<JourneyMap
  kind="system"
  eyebrow="Second attempt"
  title="A payment is represented"
  topLayer="Started on a schedule"
  origin={{
    channelsLabel: 'Source',
    brandLogo: false,
    channels: [{icon: 'calendar', label: 'Representments due today'}],
  }}
  entry={[{kind: 'schedule', label: 'Scheduled Representments Executor'}]}
  workflow={{label: 'ProcessRepresentmentWF'}}
  band={false}
  steps={[
    {
      icon: 'clock',
      name: 'Pick up',
      state: 'REPRESENTING',
      mode: 'background',
      caption: 'due today',
    },
    {
      icon: 'recheck',
      name: 'Re-check',
      mode: 'background',
      caption: 'is this still worth sending',
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'bank',
      name: 'Represent',
      state: 'REPRESENTED',
      mode: 'background',
      caption: 'sent for clearing again',
      systems: ['MR/M3'],
    },
  ]}
  detail={[
    {text: 'A representment is a second attempt at the same payment, not a new one. It was created by [A payment is returned](#a-payment-is-returned) and has been sitting at REPRESENTING since.'},
    {step: 1, text: 'The Scheduled Representments Executor picks up representments due, in waves of roughly 2,500 a minute, the same way the Scheduled Payments Executor picks up payments.'},
    {step: 2, text: 'Eligibility is checked on the day the representment would run, not the day it was queued. Days have passed since the return, and the account may have moved on.'},
    {step: 3, text: 'The payment goes for clearing again and lands at REPRESENTED, a terminal state meaning the second attempt settled.'},
    {text: 'A failed check ends at DECLINED, which is also terminal. The spec describes one retry, not a series of them.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#8-representment-workflow', label: 'Sequence diagram'}}
/>

## Payments raised elsewhere

### A third party pushes a payment

Someone other than the cardmember pushes money at the account. A bank, a partner, a third-party service. Amex did not ask for it, so the first question is whether it will be accepted at all.

<JourneyMap
  kind="system"
  title="A third party pushes a payment"
  topLayer=""
  origin={{
    actor: 'A third party',
    icon: 'inbox',
    channelsLabel: null,
    channels: [{icon: 'inbox', label: 'Batch Gateway / IPN'}],
  }}
  entry={[{kind: 'function', label: 'CreateInboundPayment.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments/inbound'}]}
  workflow={{label: 'ProcessInboundPaymentWF'}}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'background'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'background',
      caption: 'will Amex take it',
      exit: {state: 'DISALLOWED'},
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
    {step: 1, text: 'Recorded once, the same as any payment. Third parties retry, so the idempotency check matters here.'},
    {step: 2, text: 'A payment Amex will not take ends at DISALLOWED. That state exists only on this journey, and it says something different from DECLINED: the payment was not rejected on its merits, it was not accepted in the first place.'},
    {text: 'Past that point the journey matches an ordinary payment. The money is applied, everyone downstream is told, and it closes once both confirmations arrive.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#9-inbound-payment', label: 'Sequence diagram'}}
/>

### Accounts Receivable initiates a payment

Some payments start inside Amex. Accounts Receivable raises one on the customer's behalf, and it runs as a scheduled payment with nobody on the line.

<JourneyMap
  kind="system"
  title="Accounts Receivable initiates a payment"
  topLayer={null}
  origin={{
    actor: 'Accounts Receivable',
    icon: 'database',
    channelsLabel: null,
    channels: [{icon: 'inbox', label: 'Batch Gateway'}],
    via: 'File',
  }}
  entryVia="event"
  entry={[{kind: 'function', label: 'CreateBillpayTransactionFromAccountsReceivable.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={[
    {label: 'CreateSchedulePaymentWF'},
    {label: 'ExecuteScheduledPaymentWF', note: 'on the due date'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'background'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'SCHEDULED',
      mode: 'background',
      systems: ['Payment Instruments', 'Payment Options'],
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'SCHEDULED',
      mode: 'awaiting',
      caption: 'until the due date',
    },
    {
      icon: 'recheck',
      name: 'Re-verify',
      state: 'ACCEPTED',
      mode: 'background',
      caption: 'checked again, on the day',
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
    {text: 'The shape is [Pay on a future date](#pay-on-a-future-date), with one difference that runs through the whole diagram: no step is marked as a customer waiting, because there is no customer on the line. Both workflows run on the Offline worker.'},
    {step: 2, text: 'The payment is checked and parked exactly as a customer-scheduled one would be, and it lands on the same SCHEDULED state.'},
    {step: 4, text: 'The Scheduled Payments Executor wakes it on the due date and checks it again before any money moves.'},
    {text: 'Accounts Receivable also raises refunds through the same function. The spec covers only the payment side, so that is all this diagram claims.'},
  ]}
/>

## Where to go deeper

- [Payment state model](../payment-state-model.md), what each state means and which ones are final
- [Workflows](../component-model/workflows/core.md), the step-by-step logic behind each journey
- [Stages](../component-model/stages.md), the state-transition units the workflows compose
- [Sequence diagrams](../sequence-diagrams.md), the same journeys at engineering resolution
- [Routing](../routing.md), the full router table with every trigger and child workflow
