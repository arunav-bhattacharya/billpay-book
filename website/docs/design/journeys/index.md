---
title: Payment Journeys
description: 'Every journey through Billpay starts one of two ways: a customer asks for something and waits for the answer, or an event, a callback or a date sets it off with nobody on the line.'
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
      {label: 'Pay by bank', to: '#pay-by-bank', kind: 'customer'},
      {label: 'Pay while another is pending', to: '#pay-while-another-payment-is-pending', kind: 'customer'},
      {label: 'Pay on a future date', to: '#pay-on-a-future-date', kind: 'customer'},
      {label: 'Pay with several instructions', to: '#pay-with-several-instructions', kind: 'customer'},
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

# Payment Journeys

<Lead>Every journey through Billpay starts one of two ways. A customer asks for something and waits for the answer, or an event, a callback or a date sets it off with nobody on the line. Both kinds are here, and each one says which it is.</Lead>

<JourneyIndex groups={GROUPS} />

<details>
<summary>How to read the diagrams</summary>

Every journey below uses the same diagram, so a step means the same thing throughout: what happens, which systems it calls, and the state the payment holds when it is done.

- A customer initiated journey opens with the person and the Amex channels they came in through. Its early steps are marked as the customer waiting, and the shaded region shows where the caller already has an answer and the rest runs with nobody watching.
- A system initiated journey opens with the event, the callback or the date that set it off. Nothing is marked as waiting and there is no shaded region, because nobody is on the line.
- When the route passes through One-Data's inbox and a dispatcher, the work waits in the inbox until the governor lets it in. Nothing is lost while it waits.

</details>

To trace a request from the trigger it arrives on to the workflow that runs it, see [Routing](../routing.md).

## Make a payment

### Pay my bill today

A customer picks an amount and a way to pay, and wants it to count today. The journey runs on the Online cluster, started with Update-With-Start, and the customer gets an answer the moment Verify decides. The money moves after that, with nobody waiting on it.

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
    note: 'Channels are how we describe the ways in. Billpay sees an authenticated request.',
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={{label: 'CreateImmediatePaymentWorkflow'}}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {step: 1, text: 'Billpay writes the payment and its idempotency key in one insert-if-absent. A repeated request joins the workflow that is already running, so the customer gets the original answer back and is never charged twice.'},
    {step: 2, text: 'Payment Instruments confirms the way the customer is paying, Payment Options confirms the amount they picked, and Plans returns the mandate details where the market requires one. Billpay\'s verification rules check the answers, then Verify commits `ACCEPTED` or `DECLINED` in one guarded update, and the caller\'s update returns right there. A payment the customer must confirm at their bank goes another way, on [Pay by bank](#pay-by-bank), and so does one made while another is pending, on [Pay while another payment is pending](#pay-while-another-payment-is-pending).'},
    {text: 'Everything after this runs with nobody waiting. The `PENDING` event and the decision go to RTF after the reply, in order.'},
    {step: 3, text: 'Three calls go out at once: clearing with the bank, the statement balance down in Accounts Receivable, and available credit up in Authorizations. Authorizations needs the instrument\'s details in clear text, so its branch first asks Payment Instruments for them, while the other two calls are already under way. A corporate payment never gets this far in this workflow: it stops at `ACCEPTED` and asks for its allocations, on [Pay a corporate bill today](#pay-a-corporate-bill-today).'},
    {step: 4, text: 'Accounting, eBNC, risk and three notification systems are told first, in parallel: two legacy systems, the Transaction Notification Engine (TFNE) and the Payments History Database (GPHDB), and B2Notifier, which passes the news on to other downstream systems. The three use the clear-text details Execute fetched. Then the lifecycle event goes to RTF and the confirmation to Raven, and only then does the payment commit `PROCESSED`. The customer hears last, once everything else has worked.'},
    {step: 5, text: 'The payment waits at `PROCESSED` for two confirmations: the bank\'s settlement and Accounts Receivable\'s posting. Both land in One-Data\'s inbox, and a periodic workflow marks the payments that have both `PAID`, in batches. [A payment is paid](#a-payment-is-paid) shows how.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#1-pay-today-one-instruction', label: 'Sequence diagram'}}
/>

### Pay by bank

Some markets let a customer pay from a bank account they confirm on the bank's own side: Plaid in the US, Pay with Bank Transfer in the UK. The customer starts the payment as usual, gets sent to the provider's site to confirm their bank details, and comes back. Billpay holds the payment at `PENDING` meanwhile, and one workflow, `CreatePaymentIntentWorkflow`, waits for the customer on a timer, so the payment's whole story shows in one place in the Temporal UI.

<JourneyMap
  kind="customer"
  eyebrow="Immediate payment, bank confirmation"
  title="Pay by bank"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
    ],
    note: 'Which payment methods need bank confirmation is a market setting, resolved per request.',
  }}
  entry={[
    {kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'},
    {kind: 'function', label: 'CreateConfirmPendingPayment.v1', logo: 'oneData', note: 'once confirmed'},
  ]}
  core={[
    {kind: 'api', label: 'POST /payments'},
    {kind: 'api', label: 'POST /payments/{payment-id}/confirm'},
  ]}
  workflow={{label: 'CreatePaymentIntentWorkflow', note: "the caller's confirm arrives as an update"}}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'redirect',
      name: 'Redirect',
      state: 'PENDING',
      mode: 'live',
      caption: 'caller gets the link',
      systems: ['Bank provider'],
    },
    {
      icon: 'bank',
      name: 'Customer confirms',
      state: 'PENDING',
      mode: 'awaiting',
      caption: "on the provider's site",
      exit: {state: 'CANCELLED'},
    },
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'live',
      caption: 'caller confirms, gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {step: 1, text: 'Billpay writes the payment and its idempotency key in one insert-if-absent, as for any payment. A repeated request joins the workflow that is already running.'},
    {step: 2, text: 'The market\'s `requiresBankConfirmation` behavior resolves to Y for this payment method, so the Router starts `CreatePaymentIntentWorkflow`, and RequestConfirmation runs in place of Verify. It asks the market\'s provider for the customer\'s redirect link and stores it on the payment. The caller\'s update returns `PENDING` with the link, and the `PENDING` event goes to RTF. If the provider gives no link, the payment is `DECLINED` instead.'},
    {step: 3, text: 'The customer confirms their bank details on the provider\'s site while the workflow waits on its timer: the market\'s confirmation window and a short grace. If no confirm comes in that time, the workflow runs Cancel itself, and the payment ends `CANCELLED`: RTF gets the event, and the customer gets the message through Raven.'},
    {step: 4, text: 'The caller comes back with the same payment ID, and `POST /payments/{payment-id}/confirm` sends an update to the waiting workflow. The provider has already verified the customer\'s bank details. To guard against fraud, Verify asks Payment Instruments whether the verification token it holds for the instrument is valid (Payment Instruments decides), then commits `ACCEPTED` or `DECLINED`, guarded on `PENDING`. A payment without a valid token is `DECLINED`. In GB, Verify also checks that the customer\'s bank account holds enough money for the payment, and declines it if not. The confirm\'s reply returns here. A confirm that arrives after the payment was cancelled gets 409.'},
    {text: 'Everything after this runs with nobody waiting, in the same workflow, exactly as on [Pay my bill today](#pay-my-bill-today).'},
    {step: 5, text: 'Clearing with the bank, the statement balance down in Accounts Receivable and available credit up in Authorizations, all at once. Authorizations waits for the instrument\'s clear-text details from Payment Instruments.'},
    {step: 6, text: 'Accounting, eBNC, risk, TFNE, GPHDB and B2Notifier first, then the RTF event and the Raven message, then `PROCESSED`.'},
    {step: 7, text: '`PAID` follows once the settlement and the AR posting are both in One-Data\'s inbox.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#14-pay-by-bank-create-and-confirm', label: 'Sequence diagram'}}
/>

### Pay while another payment is pending

A customer who isn't sure their first payment went through may pay again, and end up paying twice. So One-Data checks every new payment against the card account's pending payments, which it keeps in Redis. When it finds one, and the market has the go-ahead turned on (it is off unless a market asks for it), the new payment waits for the customer's go-ahead: the channel shows what is already pending and asks whether to go ahead with this one too. Only the new payment waits. The earlier one carries on by itself, and this step offers no way to cancel it.

<JourneyMap
  kind="customer"
  eyebrow="Immediate payment, go-ahead"
  title="Pay while another payment is pending"
  origin={{
    actor: 'Cardmember',
    icon: 'user',
    channels: [
      {icon: 'monitor', label: 'Web'},
      {icon: 'phone', label: 'Mobile app'},
      {icon: 'headset', label: 'Servicing rep'},
    ],
    note: 'One-Data checks the card account for pending payments on every new payment, today or future-dated.',
  }}
  entry={[
    {kind: 'function', label: 'CreatePayment.v3', logo: 'oneData', note: 'checks pending'},
    {kind: 'function', label: 'CreateConfirmPendingPayment.v1', logo: 'oneData', note: 'on a yes'},
    {kind: 'function', label: 'DeletePayment.v1', logo: 'oneData', note: 'on a no'},
  ]}
  core={[
    {kind: 'api', label: 'POST /payments'},
    {kind: 'api', label: 'POST /payments/{payment-id}/confirm'},
    {kind: 'api', label: 'DELETE /payments/{payment-id}'},
  ]}
  workflow={{label: 'CreatePaymentIntentWorkflow', note: 'the yes and the no arrive as updates'}}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'lock',
      name: 'Hold',
      state: 'PENDING',
      mode: 'live',
      caption: 'caller gets the pending list',
    },
    {
      icon: 'user',
      name: 'Customer decides',
      state: 'PENDING',
      mode: 'awaiting',
      caption: 'yes or no',
      exit: {state: 'CANCELLED'},
    },
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'live',
      caption: 'caller confirms, gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {text: 'One-Data checks before it calls the core. In one Redis call it reads the card account\'s pending payments, adds this one to the list and stores the create. Another payment is still pending, so One-Data sends that payment\'s ID with the create.'},
    {step: 1, text: 'Billpay writes the payment and its idempotency key in one insert-if-absent, as for any payment, along with the IDs of the pending payments that came with the create.'},
    {step: 2, text: 'The create came with those IDs and the market has the go-ahead turned on, so the Router started `CreatePaymentIntentWorkflow`, and the payment is held before any check runs. The caller gets `PENDING`, One-Data adds the pending payments to the reply, and the workflow waits. A payment that also needs bank confirmation waits only once: RequestConfirmation gets the redirect link, the reply carries the link and the list, and confirming at the bank is the go-ahead.'},
    {step: 3, text: 'The channel shows the pending payments and asks whether to go ahead. A no comes in through `DeletePayment.v1` as an update to the waiting workflow, and Cancel moves the new payment to `CANCELLED`, guarded on `PENDING`. So does the workflow\'s timer, if no answer comes before the window and its grace have passed. Either way, RTF gets the event, the customer gets the message through Raven, and the payment leaves the account\'s pending list.'},
    {step: 4, text: 'A yes comes in through `CreateConfirmPendingPayment.v1` with the same payment ID, as an update to the same workflow, and Verify runs the usual checks: the payment\'s behaviors pick it, as for any payment. It goes through even if the earlier payment was decided while the customer looked. Verify commits `ACCEPTED` or `DECLINED`, guarded on `PENDING`, and the caller\'s update returns here. A yes and a no from two tabs are two updates to one workflow: the first one wins, and the other gets 409. For a payment dated in the future, Verify commits `SCHEDULED` instead, and the payment waits for its date (Proposed).'},
    {text: 'Everything after this runs with nobody waiting, in the same workflow, exactly as on [Pay my bill today](#pay-my-bill-today).'},
    {step: 5, text: 'Clearing with the bank, the statement balance down in Accounts Receivable and available credit up in Authorizations, all at once. Authorizations waits for the instrument\'s clear-text details from Payment Instruments.'},
    {step: 6, text: 'Accounting, eBNC, risk, TFNE, GPHDB and B2Notifier first, then the RTF event and the Raven message, then `PROCESSED`. When the workflow ends, billpay-core calls One-Data\'s delete API, `DeletePendingPayment.v1`, and the payment leaves the account\'s pending list.'},
    {step: 7, text: '`PAID` follows once the settlement and the AR posting are both in One-Data\'s inbox.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#15-a-new-payment-while-another-is-pending', label: 'Sequence diagram'}}
/>

### Pay on a future date

The customer picks a date, up to 30 days out. Billpay checks the payment now, so the customer knows straight away whether it will be attempted, then keeps it as a row in Oracle until the day. Nothing runs in Temporal while it waits.

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
    {label: 'CreateScheduledPaymentWorkflow'},
    {label: 'ExecuteScheduledPaymentWorkflow', note: 'on the due date'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'SCHEDULED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'SCHEDULED',
      mode: 'awaiting',
      caption: 'a row in Oracle',
      exit: {state: 'CANCELLED', label: 'if cancelled inside the window'},
    },
    {
      icon: 'recheck',
      name: 'Reverify',
      state: 'ACCEPTED',
      mode: 'background',
      caption: 'checked again, on the day',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'parallelArrows',
      name: 'Execute',
      state: 'PROCESSING',
      mode: 'background',
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {step: 1, text: 'The same insert-if-absent as an immediate payment, so a repeated request gets the original back.'},
    {step: 2, text: 'Checked now, not on the day. The answer is `SCHEDULED`, and the same commit writes a `SCHED_EXEC` row in the Work Tracker, due at the market\'s execution time on that date. Then the workflow closes.'},
    {step: 3, text: 'For up to 30 days the payment is a row in Oracle and nothing more. The customer can update or cancel it until the market\'s cancellation window closes, which is always before execution starts.'},
    {step: 4, text: 'At the market\'s execution time, that market\'s dispatcher claims the row, calls the Router again so the payment runs with today\'s config, and starts `ExecuteScheduledPaymentWorkflow` on the Offline cluster at the rate the governor allows. Reverify checks the payment again, the mandate included where the market requires one, because an account can close or a balance can move while a payment waits.'},
    {text: 'A future-dated payment never clears in real time. It clears in batch, whichever channel it came from.'},
    {text: 'From Execute on, the journey is [Pay my bill today](#pay-my-bill-today). The last commit marks the Work Tracker row `DONE`.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#2-scheduled-payment-created-today-and-executed-later', label: 'Sequence diagram'}}
/>

### Pay with several instructions

One request, more than one instruction. Billpay validates the composite payment as a whole, then runs each instruction as its own payment, all on the Online cluster. Pay with MR Points, which spans Billpay and Loyalty, is a composite of its own; its steps aren't in the design yet.

<JourneyMap
  kind="customer"
  eyebrow="Multiple instructions"
  title="Pay with several instructions"
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
    {label: 'CreatePaymentWithMultipleInstructionsWorkflow'},
    {label: 'CreateImmediatePaymentWorkflow', via: 'runs', child: true, note: 'one per instruction'},
  ]}
  persist={false}
  band={false}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Validate',
      caption: 'the composite payment',
    },
    {
      icon: 'parallelArrows',
      name: 'Run each instruction',
      caption: 'a child workflow each',
    },
  ]}
  detail={[
    {step: 1, text: 'The composite payment is validated as a whole before any instruction runs.'},
    {step: 2, text: 'Then each instruction runs as its own `CreateImmediatePaymentWorkflow`, a child on the same cluster, and goes through [Pay my bill today](#pay-my-bill-today) with its own states.'},
  ]}
/>

### Pay & Plan

The customer pays today and sets up a plan of future installments in the same request. One composite workflow, Create Payment & Installments, runs both in order on the Online cluster.

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
    {label: 'CreateImmediatePaymentWorkflow', via: 'runs', child: true},
  ]}
  persist={false}
  band={false}
  steps={[
    {icon: 'orchestrate', name: 'Pay now', caption: 'a child workflow'},
    {icon: 'calendar', name: 'Plan', caption: 'future installments', systems: ['Installments']},
    {icon: 'recheck', name: 'Autopay', caption: 'an optional update'},
  ]}
  detail={[
    {step: 1, text: 'The payment is [Pay my bill today](#pay-my-bill-today), run as a child workflow. Nothing about the plan changes how the money moves or settles.'},
    {step: 2, text: 'Then the composite calls the Installments API to set up the plan of future installments. Billpay asks for the plan; it doesn\'t own it.'},
    {step: 3, text: 'Last, an optional update to the customer\'s Autopay.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#12-pay--plan', label: 'Sequence diagram'}}
/>

## Change a payment

### Update a payment

Nothing is edited in place. Billpay cancels the original and raises a new payment with the new details, then ties the two together so the history reads straight. The customer keeps their confirmation number throughout.

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
    {label: 'UpdatePaymentWorkflow'},
    {label: 'CreateScheduledPaymentWorkflow', via: 'starts', child: true, note: '{newId}-init'},
  ]}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Check',
      mode: 'live',
      caption: 'window and eligibility',
      exit: {label: '409 outside the window'},
    },
    {
      icon: 'undo',
      name: 'Cancel',
      state: 'CANCELLED',
      mode: 'live',
      caption: 'the original, guarded',
      exit: {label: '409 if it has left SCHEDULED'},
    },
    {
      icon: 'calendar',
      name: 'Re-create',
      state: 'SCHEDULED',
      mode: 'live',
      caption: 'same confirmation number',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
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
    {step: 1, text: 'Read-only calls check the market\'s cancellation window and whether the payment can still change. Outside the window the answer is 409.'},
    {step: 2, text: 'The original is cancelled with a guarded update, the same one [Cancel a payment](#cancel-a-payment) uses. If the payment has already left `SCHEDULED`, which a corporate payment does once its allocations are requested, no row changes and the answer is 409.'},
    {step: 3, text: 'The new payment starts as a child, `CreateScheduledPaymentWorkflow` with the ID `{newId}-init`. It gets a new payment ID but keeps the confirmation number, so the customer sees one payment rather than two. Its result is the caller\'s answer.'},
    {step: 4, text: 'The old and new payment IDs are mapped in `ORIG_TRANS_REFER_MAP`, so anyone can follow the chain later.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#5-update-a-scheduled-payment', label: 'Sequence diagram'}}
/>

### Cancel a payment

A payment can be pulled back while it is `SCHEDULED`, inside the market's cancellation window. Once it has left `SCHEDULED`, it can no longer be cancelled. A corporate payment can close sooner: it leaves `SCHEDULED` for `ALLOCATING` when its allocations are requested, and from then on a cancel gets 409. The same call also carries a customer's no to a payment made while another was pending, with no window check, on [Pay while another payment is pending](#pay-while-another-payment-is-pending).

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
  workflow={{label: 'CancelPaymentWorkflow'}}
  steps={[
    {
      icon: 'shieldCheck',
      name: 'Check',
      mode: 'live',
      caption: 'window and eligibility',
      exit: {label: '409 outside the window'},
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
    {step: 1, text: 'Read-only calls check the cancellation window, which always closes before execution starts, and whether the payment is still eligible.'},
    {step: 2, text: 'One guarded update moves the payment to `CANCELLED`, and the same commit cancels its Work Tracker rows, so no dispatcher will ever pick it up. The `CANCELLED` event and message go out after the reply.'},
    {text: 'If the update changes nothing, the payment has moved on. When it is already `CANCELLED`, the caller gets that answer again, so cancelling twice is harmless. Otherwise the answer is 409.'},
    {text: 'A corporate payment whose allocations have been requested is `ALLOCATING`, not `SCHEDULED`, so the update changes nothing and the answer is 409, the same as outside the window.'},
    {text: 'There is no path from `ACCEPTED` to `CANCELLED`, so the window is the only chance to pull a payment back.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#6-cancel-a-payment', label: 'Sequence diagram'}}
/>

## Refund a balance

### Initiate a credit balance refund

When an account carries a credit balance, the money goes back to the customer. A refund can come from a channel or from Accounts Receivable, and the two start in different places.

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
  workflow={{label: 'CreateBalanceRefundWorkflow'}}
  status={{
    kind: 'tbd',
    note: 'From a channel, the refund starts on the Online cluster with Update-With-Start. A refund that Accounts Receivable raises waits in One-Data\'s inbox, and the AR intake dispatcher starts it on the Offline cluster. Either way it follows the payment path (Capture, Verify, Execute, Fulfil), but its detailed steps are still being defined.',
  }}
/>

## Read payments

Reading touches none of the machinery above: no Router, no workflow, no state change. Both reads go straight to Oracle.

### Read payments by card account

Everything a customer has paid on one card. This is the payment history behind the web and mobile apps.

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
    note: 'Lists every payment on the account, read from Oracle. One-Data\'s event handlers use the same function to find the payment an event doesn\'t name.',
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
    note: 'The function lists the lifecycle states one payment has been through. They come from the payment\'s timeline in Oracle, which is written at every state change on the diagrams above and names the cluster that ran each step.',
  }}
/>

## Corporate payments

A corporate payment is paid once, as one amount, and the allocations manager supplies its breakdown into allocations. Billpay fetches that breakdown before the money moves, and the payment's own state shows how far it has got: `ALLOCATING` while the batches come in, `ALLOCATED` once they add up.

No workflow waits for the answer, and no workflow starts the next step itself. Each step is a Work Tracker row that a dispatcher picks up, so a payment made today and a scheduled one take the same path once they are `ALLOCATED`. [Corporate Allocations](../corporate-allocations.md) covers the whole flow.

### Pay a corporate bill today

The customer gets the same quick answer a consumer does. Behind it, the payment asks for its allocations, and only once they are all in does it clear and post its legs.

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
    note: 'Which channels a corporate market opens is a market onboarding decision, not a Billpay one.',
  }}
  entry={[{kind: 'function', label: 'CreatePayment.v3', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments'}]}
  workflow={[
    {label: 'CreateImmediatePaymentWorkflow'},
    {label: 'RequestAllocationsWorkflow', via: 'then'},
    {label: 'ReceiveAllocationsWorkflow', via: 'then'},
    {label: 'ExecuteScheduledPaymentWorkflow', via: 'then'},
    {label: 'ExecuteSplitPaymentWorkflow', via: 'then', note: 'one per leg'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'ACCEPTED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'orchestrate',
      name: 'Request',
      state: 'ALLOCATING',
      mode: 'background',
      caption: 'at once',
      systems: ['Allocations'],
    },
    {
      icon: 'database',
      name: 'Receive',
      state: 'ALLOCATED',
      table: 'allocation_batch',
      mode: 'background',
      caption: 'once the batches add up',
    },
    {
      icon: 'bank',
      name: 'Clear',
      state: 'PROCESSING',
      mode: 'background',
      caption: 'once, for the whole amount',
      systems: ['MR/M3'],
    },
    {
      icon: 'broadcast',
      name: 'Run each leg',
      state: 'PROCESSED',
      mode: 'background',
      caption: 'written, then a workflow each',
      systems: ['GAR', 'Payment Instruments', 'AMP', 'Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier'],
    },
    {
      icon: 'doubleCheck',
      name: 'Complete',
      state: 'PROCESSED',
      mode: 'background',
      caption: 'the parent, once every leg is done',
      systems: ['RTF', 'Raven'],
    },
  ]}
  detail={[
    {step: 2, text: 'The payment is checked as one amount. Verify\'s commit also writes an `ALLOC_REQUEST` Work Tracker row, due at once, and `CreateImmediatePaymentWorkflow` ends there. It starts nothing itself.'},
    {step: 3, text: 'The allocation-request dispatcher starts `RequestAllocationsWorkflow` on the Offline cluster. It moves the payment to `ALLOCATING`, asks the allocations manager for the breakdown, and ends. No workflow sits waiting for the answer.'},
    {step: 4, text: 'The allocations manager calls back with the batches, as [Allocations arrive by callback](#allocations-arrive-by-callback) shows. The batch that completes the amount moves the payment to `ALLOCATED` and writes its `ALLOC_EXEC` row, due at once.'},
    {step: 5, text: 'The allocated-payments dispatcher starts `ExecuteScheduledPaymentWorkflow`, the same workflow a scheduled corporate payment runs, without Reverify. Execute clears the parent once, at payment level, and its commit releases the legs. Clearing never runs per allocation.'},
    {step: 6, text: 'The leg dispatcher writes each allocation as a leg, `{paymentId}_{seq}`, in `ACCEPTED` with a Work Tracker row of its own, then starts one `ExecuteSplitPaymentWorkflow` per leg: the statement balance and available credit for that account (available credit once Payment Instruments has returned the clear-text details), then accounting, eBNC, risk, TFNE, GPHDB and B2Notifier, then the leg\'s RTF event and Raven message. Legs run at priority 2 with the parent\'s ID as their fairness key, so one big payment can\'t starve the others.'},
    {step: 7, text: 'Every 60 seconds the leg dispatcher counts each parent\'s legs. Once every leg is `PROCESSED` or `PAID`, it sends the parent\'s RTF event and Raven message, then moves the parent to `PROCESSED`.'},
    {text: 'From there each leg turns `PAID` on its own, once the parent has settled and that leg has posted. The parent stays `PROCESSED`.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#3-corporate-payment-pay-today', label: 'Sequence diagram'}}
/>

### Schedule a corporate payment

The same path, started by the date. The allocations are fetched on the due date or before it, and the payment executes at its execution time once they are all in.

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
    {label: 'CreateScheduledPaymentWorkflow'},
    {label: 'RequestAllocationsWorkflow', via: 'then', note: 'at the fetch time'},
    {label: 'ReceiveAllocationsWorkflow', via: 'then'},
    {label: 'ExecuteScheduledPaymentWorkflow', via: 'then', note: 'at the execution time'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'live'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'SCHEDULED',
      mode: 'live',
      caption: 'customer gets a response',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
      handoffAfter: true,
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'SCHEDULED',
      mode: 'awaiting',
      caption: 'until the fetch time',
      exit: {state: 'CANCELLED', label: 'inside the window'},
    },
    {
      icon: 'orchestrate',
      name: 'Request',
      state: 'ALLOCATING',
      mode: 'background',
      caption: 'at the market\'s fetch time',
      systems: ['Allocations'],
    },
    {
      icon: 'database',
      name: 'Receive',
      state: 'ALLOCATED',
      table: 'allocation_batch',
      mode: 'background',
      caption: 'once the batches add up',
    },
    {
      icon: 'recheck',
      name: 'Reverify',
      state: 'ACCEPTED',
      mode: 'background',
      caption: 'at the execution time',
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'bank',
      name: 'Clear',
      state: 'PROCESSING',
      mode: 'background',
      caption: 'once, for the whole amount',
      systems: ['MR/M3'],
    },
    {
      icon: 'broadcast',
      name: 'Legs, then parent',
      state: 'PROCESSED',
      mode: 'background',
      caption: 'a workflow per leg',
      systems: ['GAR', 'Payment Instruments', 'AMP', 'Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier'],
    },
  ]}
  detail={[
    {text: 'The shape is [Pay a corporate bill today](#pay-a-corporate-bill-today), started by the date instead of at once.'},
    {step: 2, text: '`SCHEDULED`, as for a consumer payment. The same commit writes an `ALLOC_REQUEST` Work Tracker row, due at the market\'s fetch time, and no `SCHED_EXEC` row: the execution row comes once the payment is `ALLOCATED`.'},
    {step: 3, text: 'Nothing runs while the payment waits. The customer can update or cancel it inside the window while it is `SCHEDULED`.'},
    {step: 4, text: 'The fetch time is a market setting: on the due date, or a set number of hours or days before it. The allocation-request dispatcher starts `RequestAllocationsWorkflow`, which moves the payment to `ALLOCATING`. From here an update or a cancel gets 409.'},
    {step: 5, text: 'The batch that completes the amount moves the payment to `ALLOCATED` and writes its `ALLOC_EXEC` row, due at the execution time on the due date.'},
    {step: 6, text: 'At the execution time the allocated-payments dispatcher starts `ExecuteScheduledPaymentWorkflow` through the Router, with today\'s config. Reverify checks the payment again: `ACCEPTED`, or `DECLINED`, in which case no leg is ever written.'},
    {step: 7, text: 'Execute clears the parent once, at payment level, and releases its legs.'},
    {step: 8, text: 'From here it runs as [Pay a corporate bill today](#pay-a-corporate-bill-today) does: the leg dispatcher writes and runs the legs, and its completion check moves the parent to `PROCESSED`. If the allocations are late, the payment waits in `ALLOCATING`, an alert fires at the market\'s alert point, and it executes as soon as the last batch arrives.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#4-corporate-payment-scheduled', label: 'Sequence diagram'}}
/>

### Allocations arrive by callback

The breakdown itself. Billpay asks for it and then stops: no workflow waits for the answer. The allocations manager calls back, once or several times, and the batch that completes the amount makes the payment `ALLOCATED`.

<JourneyMap
  kind="system"
  eyebrow="Corporate allocations"
  title="Allocations arrive by callback"
  topLayer="Partner system"
  origin={{
    actor: 'Allocations manager',
    icon: 'orchestrate',
    channelsLabel: null,
    channels: [{icon: 'inbox', label: 'Batches, numbered per payment'}],
  }}
  entry={[{kind: 'function', label: 'CreatePaymentAllocations.v1', logo: 'oneData'}]}
  core={[{kind: 'api', label: 'POST /payments/{payment-id}/allocations'}]}
  workflow={[
    {label: 'ReceiveAllocationsWorkflow'},
    {label: 'ExecuteScheduledPaymentWorkflow', via: 'then', note: 'from the allocated-payments dispatcher'},
  ]}
  band={false}
  steps={[
    {
      icon: 'database',
      name: 'Store',
      table: 'allocation_batch',
      mode: 'background',
      caption: 'before any workflow starts',
    },
    {
      icon: 'orchestrate',
      name: 'Start',
      mode: 'background',
      caption: 'async start, then 202',
      exit: {label: '429 over budget, 503 if Offline is down'},
    },
    {
      icon: 'shieldCheck',
      name: 'Check',
      mode: 'background',
      caption: 'no legs written yet',
    },
    {
      icon: 'doubleCheck',
      name: 'Allocated',
      state: 'ALLOCATED',
      mode: 'background',
      caption: 'once the batches add up',
    },
    {
      icon: 'clock',
      name: 'Execution row',
      mode: 'background',
      caption: 'at once, or at the execution time',
    },
  ]}
  detail={[
    {text: 'Billpay doesn\'t work the breakdown out for itself. The allocations manager owns the breakdown, and it sends it back in numbered batches.'},
    {step: 1, text: 'The API stores the batch in `allocation_batch` first. A batch can hold thousands of allocations, and keeping them out of the workflow\'s input keeps its history small.'},
    {step: 2, text: 'Then it starts `ReceiveAllocationsWorkflow` with only the payment ID and the batch number, and replies 202. Over its traffic budget the callback gets 429 with `Retry-After`, and while the Offline cluster is down, 503. The allocations manager retries both.'},
    {step: 3, text: 'The workflow checks the batch against the payment. It writes no legs: every batch waits in `allocation_batch` until the payment executes.'},
    {step: 4, text: 'The batch that completes the amount moves the payment from `ALLOCATING` to `ALLOCATED`, in one guarded commit.'},
    {step: 5, text: 'The same commit writes the `ALLOC_EXEC` row: due at once for a payment made today, or at the execution time on the due date for a scheduled one. The allocated-payments dispatcher picks it up from there.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#13-allocations-callback', label: 'Sequence diagram'}}
/>

## After execution

### A payment is paid

This is where a payment turns `PAID`, or for a split payment, each of its legs. Billpay doesn't mark a payment paid because it sent the money. It waits for the bank to confirm the money settled and for Accounts Receivable to confirm it posted, and the two confirmations arrive on their own schedules.

<JourneyMap
  kind="system"
  eyebrow="Settlement and posting"
  title="A payment is paid"
  topLayer="Events from other systems"
  origin={{
    channelsLabel: 'Sources',
    brandLogo: false,
    channels: [
      {icon: 'bank', label: 'MR/M3 settled'},
      {icon: 'database', label: 'GAR posted'},
    ],
  }}
  entry={[
    {kind: 'event', label: 'Event handlers'},
    {kind: 'inbox', label: 'One-Data\'s inbox'},
  ]}
  core={[{kind: 'schedule', label: 'Every 30 seconds'}]}
  workflow={{label: 'ProcessPaidEventsWorkflow'}}
  persist={false}
  steps={[
    {icon: 'inbox', name: 'Fetch', mode: 'background', caption: 'up to 500 READY rows'},
    {icon: 'bank', name: 'Settle', state: 'PAID', mode: 'background', caption: 'one Oracle transaction'},
    {icon: 'broadcast', name: 'Announce', mode: 'background', caption: 'the PAID events', systems: ['RTF']},
    {icon: 'doubleCheck', name: 'Mark', mode: 'background', caption: 'DONE or UNMATCHED'},
  ]}
  detail={[
    {text: 'A payment reaches this point `PROCESSED`: the money has gone to the bank and every system has been told. Two confirmations are still owed. The bank says the money settled, and Accounts Receivable says the payment posted.'},
    {text: 'Both arrive as events, sometimes 1,000 a second, and neither touches Billpay directly. One-Data\'s event handlers store each one in its inbox, a Postgres database of its own, and whichever arrives second marks the payment\'s row `READY`.'},
    {step: 1, text: 'A Schedule starts `ProcessPaidEventsWorkflow` every 30 seconds, and only one run is ever active. Each batch fetches up to 500 `READY` rows through a One-Data function.'},
    {step: 2, text: 'Settle moves the batch from `PROCESSED` to `PAID` in one Oracle transaction, each row by a guarded update, and tags each `PAID` timeline row with the batch\'s ID. A retried Settle finds the payments it already moved by that ID.'},
    {step: 3, text: 'The `PAID` events go to RTF.'},
    {step: 4, text: 'Last, the rows are marked `DONE`, or `UNMATCHED` when Billpay found nothing ready to pay. An `UNMATCHED` row is tried again an hour later, for up to 48 hours, and after that One-Data\'s own scheduled check, `UpdateUnmatchedPayments.v1`, raises an alert. Marking last means a row is `DONE` only once its event has gone out.'},
    {text: 'A split payment turns `PAID` leg by leg: a leg is ready once it has posted and its parent has settled, and the parent stays `PROCESSED`.'},
    {text: 'The drain is the last thing the governor gives budget to, so a burst of events waits in the inbox rather than competing with execution. If a confirmation never arrives, `ProcessMissingPaidEventsWorkflow` finds payments still `PROCESSED` after 48 hours, asks MR/M3 and GAR, and hands any event it finds to One-Data, or raises an alert.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#10-paid-events', label: 'Sequence diagram'}}
/>

### A payment is returned

Days after a payment looks finished, the bank can send the money back. Billpay reverses the payment, then decides whether it is worth presenting again. This journey ends by queueing that second attempt, not by making it.

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
  entry={[
    {kind: 'event', label: 'Money movement handler'},
    {kind: 'inbox', label: 'One-Data\'s inbox'},
  ]}
  core={[{kind: 'dispatcher', label: 'Returns dispatcher'}]}
  workflow={{label: 'ProcessReturnedPaymentWorkflow'}}
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
      caption: 'the money came back',
    },
    {
      icon: 'recheck',
      name: 'Judge',
      mode: 'background',
      caption: 'worth another try',
      exit: {label: 'not eligible, so it stays returned'},
    },
    {
      icon: 'calendar',
      name: 'Queue',
      state: 'REPRESENTING',
      mode: 'background',
      caption: 'the next presentment',
    },
  ]}
  detail={[
    {text: 'Returns come in bursts, up to 100 a second and 100K a day. One-Data keeps each one in its inbox, and the returns dispatcher starts them through the Router at the governor\'s pace, at priority 5, the lowest priority level.'},
    {step: 1, text: 'Only a payment that got far enough can come back. The workflow checks the payment, whole or a leg, and its status: `PROCESSING`, `PROCESSED`, `PAID`, or `REPRESENTED` for a payment returned again.'},
    {step: 2, text: 'The presentment that came back moves to `RETURNED`, and its row stays there.'},
    {step: 3, text: 'Not every return is worth another try. The market\'s representment rules say which return reasons can be represented and how many times a payment can be, and a return that fails either test stays `RETURNED`. The same rules set the representment date: today or later.'},
    {step: 4, text: 'QueueRepresentment writes the next presentment as a new row, numbered one higher, in `REPRESENTING`, with that date as its clearing date and a `REPRESENT` Work Tracker row due on it. A return never starts the representment itself; the date does.'},
    {text: 'What happens on that date is [A payment is represented](#a-payment-is-represented).'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#7-return', label: 'Sequence diagram'}}
/>

### A payment is represented

The second attempt queued by a return, run on the day it falls due. Billpay checks the representment still makes sense before anything goes to clearing, because the reason a payment came back can outlive the return.

<JourneyMap
  kind="system"
  eyebrow="Second attempt"
  title="A payment is represented"
  topLayer="Started on a date"
  origin={{
    channelsLabel: 'Source',
    brandLogo: false,
    channels: [{icon: 'calendar', label: 'REPRESENT rows due today'}],
  }}
  entry={[{kind: 'schedule', label: 'Every few minutes, per market'}]}
  core={[{kind: 'dispatcher', label: 'Representment dispatcher'}]}
  workflow={{label: 'ProcessRepresentmentWorkflow'}}
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
      name: 'Recheck',
      mode: 'background',
      caption: 'still worth sending',
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
    {text: 'A representment is the next presentment of the same payment: a new row with the same payment ID, numbered one higher. [A payment is returned](#a-payment-is-returned) queued it, and it has waited as a Work Tracker row since.'},
    {step: 1, text: 'Each market\'s representment dispatcher runs every few minutes, claims the `REPRESENT` rows that are due and starts `ProcessRepresentmentWorkflow` through the Router.'},
    {step: 2, text: 'Eligibility is checked again before anything goes to clearing. Days may have passed since the return, and the account may have changed.'},
    {step: 3, text: 'The new presentment goes to clearing and lands at `REPRESENTED`. A failed recheck ends it at `DECLINED`, and nothing is sent.'},
    {text: 'If this presentment comes back too, that is a new return, with its own workflow ID, and the next presentment is number 3.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#8-representment', label: 'Sequence diagram'}}
/>

## Other Payments

### A third party pushes a payment

Someone other than the cardmember pushes money at the account. Amex didn't ask for it, so the first question is whether it will be accepted at all.

<JourneyMap
  kind="system"
  title="A third party pushes a payment"
  topLayer=""
  origin={{
    actor: 'A third party',
    icon: 'inbox',
    channelsLabel: null,
    channels: [{icon: 'inbox', label: 'A pushed payment'}],
  }}
  entry={[
    {kind: 'function', label: 'CreateInboundPayment.v1', logo: 'oneData'},
    {kind: 'inbox', label: 'One-Data\'s inbox'},
  ]}
  core={[{kind: 'dispatcher', label: 'Inbound dispatcher'}]}
  workflow={{label: 'ProcessInboundPaymentWorkflow'}}
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
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {text: 'One-Data stores the payment and replies 202 straight away. The inbound dispatcher checks the inbox every minute and starts the workflow through the Router at the governor\'s pace.'},
    {step: 1, text: 'Recorded once. Third parties retry, so the idempotency check matters here.'},
    {step: 2, text: 'A payment American Express doesn\'t accept ends at `DISALLOWED`. That state exists only on this journey.'},
    {text: 'Past that, it is an ordinary payment. The money is applied, every downstream system is told, and it turns `PAID` once both confirmations are in.'},
  ]}
  reference={{to: '/docs/design/sequence-diagrams#9-inbound-payment', label: 'Sequence diagram'}}
/>

### Accounts Receivable initiates a payment

Some payments start inside Amex. Accounts Receivable raises them on the customer's behalf, in bulk, and they run as scheduled payments with nobody on the line.

<JourneyMap
  kind="system"
  title="Accounts Receivable initiates a payment"
  topLayer={null}
  origin={{
    actor: 'Accounts Receivable',
    icon: 'database',
    channelsLabel: null,
    channels: [{icon: 'inbox', label: 'Payments and refunds, in bulk'}],
  }}
  entry={[
    {kind: 'function', label: 'CreateBillpayTransactionFromAccountsReceivable.v1', logo: 'oneData'},
    {kind: 'inbox', label: 'One-Data\'s inbox'},
  ]}
  core={[{kind: 'dispatcher', label: 'AR intake dispatcher'}]}
  workflow={[
    {label: 'CreateScheduledPaymentWorkflow'},
    {label: 'ExecuteScheduledPaymentWorkflow', note: 'on the due date'},
  ]}
  steps={[
    {icon: 'fingerprint', name: 'Capture', state: 'PENDING', mode: 'background'},
    {
      icon: 'shieldCheck',
      name: 'Verify',
      state: 'SCHEDULED',
      mode: 'background',
      systems: ['Payment Instruments', 'Payment Options', 'Plans'],
      parallel: true,
      fanNote: 'at once; Plans for a mandate',
      exit: {state: 'DECLINED'},
    },
    {
      icon: 'clock',
      name: 'Wait',
      state: 'SCHEDULED',
      mode: 'awaiting',
      caption: 'a row in Oracle',
    },
    {
      icon: 'recheck',
      name: 'Reverify',
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
      systems: ['MR/M3', 'GAR', 'Payment Instruments', 'AMP'],
      parallel: true,
      fanNote: 'at once; AMP after Instruments',
    },
    {
      icon: 'broadcast',
      name: 'Fulfil',
      state: 'PROCESSED',
      mode: 'background',
      systems: ['Accounting', 'eBNC', 'Risk', 'TFNE', 'GPHDB', 'B2Notifier', 'RTF', 'Raven'],
    },
    {
      icon: 'doubleCheck',
      name: 'Paid',
      state: 'PAID',
      mode: 'awaiting',
      caption: 'settled and posted',
      systems: ['MR/M3', 'GAR'],
      exit: {state: 'RETURNED'},
    },
  ]}
  detail={[
    {text: 'Accounts Receivable sends payments in bulk, up to a million at 100 a second. One-Data stores each one and answers 202 as soon as it is stored. The AR intake dispatcher pulls them every minute and starts them at the governor\'s pace, at priority 1, the same level as scheduled execution.'},
    {step: 2, text: 'Checked and parked exactly like a customer\'s scheduled payment, with the same `SCHED_EXEC` row. It always clears in batch.'},
    {step: 4, text: 'On the due date the scheduled-payments dispatcher starts it, and Reverify checks it again before any money moves.'},
    {text: 'There is no customer on the line, so no step is marked as waiting, and both workflows run on the Offline cluster. Accounts Receivable learns the outcome from the `SCHEDULED` and `DECLINED` notifications and lifecycle events, or from `GET /payments/{payment-id}`.'},
    {text: 'Accounts Receivable raises credit balance refunds through the same function. Those start `CreateBalanceRefundWorkflow` on the Offline cluster.'},
    {text: 'A request the Router can\'t admit, because nothing live matches its market, account type or API, is marked `REJECTED` in the inbox and operations get an alert. Accounts Receivable isn\'t told.'},
  ]}
/>

## Where to go deeper

- [Payment State Model](../payment-state-model.md): what each state means, and which stage makes each move
- [Core Workflows](../component-model/workflows/core.md): the step-by-step logic behind each journey
- [Stages](../component-model/stages.md): the business steps the workflows compose
- [Pacing](../pacing.md): how dispatchers and the governor decide when offline work runs
- [Corporate Allocations](../corporate-allocations.md): how a corporate payment fetches its allocations before it moves money
- [Sequence Diagrams](../sequence-diagrams.md): the same journeys at engineering resolution
- [Routing](../routing.md): every trigger, the workflow it starts and the cluster it runs on
