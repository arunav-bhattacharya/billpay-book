---
title: System Initiated
sidebar_label: System initiated
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';
import JourneyMap from '@site/src/components/JourneyMap';

# System Initiated Journeys

<Lead accent="var(--amex-cat-design)">Not every journey starts with someone tapping Pay. Banks return money, third parties push payments in, Accounts Receivable raises its own, and every payment ever made still has to be closed out. **Nobody is waiting on these.** They run when an event arrives or a timer fires.</Lead>

## Journeys at a glance

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'After a payment is executed',
      links: [
        {to: '#a-payment-is-posted', label: 'A payment is Posted'},
        {to: '#a-payment-is-returned', label: 'A payment is Returned'},
      ],
    },
    {
      term: 'Payments raised elsewhere',
      links: [
        {to: '#a-third-party-pushes-a-payment', label: 'A Third-party pushes a Payment'},
        {to: '#accounts-receivable-initiates-a-payment', label: 'Accounts Receivable initiates a payment'},
      ],
    },
  ]}
/>

<details>
<summary>How to read the diagrams</summary>

These use the same diagram as the [customer initiated](./customer-initiated.md) journeys, so a step means the same thing on either page: what happens, which systems it calls, and the state the payment holds when it is done.

- Each one opens with the event or the schedule that sets it off, rather than a person and a channel.
- No step is marked as a customer waiting, and there is no shaded region, because none of this is a request.

</details>

## A payment is Posted

This is where every payment on the [customer journeys](./customer-initiated.md) ends. Billpay does not mark a payment paid just because it sent the money. It waits for the bank to confirm the money settled and for Accounts Receivable to confirm it posted. The two confirmations arrive at their own pace, and a timer matches them up.

<JourneyMap
  title="A payment is Posted"
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
  reference={{to: '/docs/design/diagrams/sequence-diagram#10-paid-events-reconciliation', label: 'Sequence diagram'}}
/>

Nothing here is a single request. The two confirmations land whenever the owning system produces them, the event handlers write each one into the tracker, and this workflow only acts once both are there.

## A payment is Returned

Days after a payment looks finished, the bank can send the money back. Billpay reverses the payment, then decides whether it is worth presenting again. Most returns are worth one more try, and that second attempt is scheduled rather than immediate.

<JourneyMap
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
  workflow={[
    {label: 'ProcessReturnedPaymentWF'},
    {label: 'ProcessRepresentmentWF', note: 'on the retry date'},
  ]}
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
    {
      icon: 'parallelArrows',
      name: 'Retry',
      state: 'REPRESENTED',
      mode: 'awaiting',
      caption: 'on the retry date',
      systems: ['MR/M3'],
      exit: {state: 'DECLINED'},
    },
  ]}
  detail={[
    {step: 1, text: 'Only a payment that got far enough can come back. Billpay looks it up and confirms it is PAID, PROCESSING or PROCESSED before touching anything.'},
    {step: 2, text: 'The payment moves to RETURNED. This is the one terminal state that is neither a success nor a failure: the payment happened, and then it unhappened.'},
    {step: 3, text: 'Not every return is worth chasing. Billpay checks the rules for this payment and works out the next date it could reasonably be presented.'},
    {step: 4, text: 'A retry is a new presentment against the same payment, sitting at REPRESENTING until its date comes round.'},
    {step: 5, text: 'The Scheduled Representments Executor picks it up, revalidates, and sends it for clearing again. It either settles, or it is declined and the payment stops there.'},
  ]}
  reference={{to: '/docs/design/diagrams/sequence-diagram#7-return-processing--representment-eligibility-check', label: 'Sequence diagram'}}
/>

## A Third-party pushes a Payment

Someone other than the cardmember pushes money at the account. A bank, a partner, a third-party service. Amex did not ask for it, so the first question is whether it will be accepted at all.

<JourneyMap
  title="A Third-party initiated Payment"
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
  reference={{to: '/docs/design/diagrams/sequence-diagram#9-inbound-payment', label: 'Sequence diagram'}}
/>

## Accounts Receivable initiates a payment

Some payments start inside Amex. Accounts Receivable raises one on the customer's behalf, and it runs as a scheduled payment with nobody on the line.

<JourneyMap
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
    {text: 'The shape is [Pay on a future date](./customer-initiated.md#pay-on-a-future-date), with one difference that runs through the whole diagram: no step is marked as a customer waiting, because there is no customer on the line. Both workflows run on the Offline worker.'},
    {step: 2, text: 'The payment is checked and parked exactly as a customer-scheduled one would be, and it lands on the same SCHEDULED state.'},
    {step: 4, text: 'The Scheduled Payments Executor wakes it on the due date and checks it again before any money moves.'},
    {text: 'Accounts Receivable also raises refunds through the same function. The spec covers only the payment side, so that is all this diagram claims.'},
  ]}
/>
