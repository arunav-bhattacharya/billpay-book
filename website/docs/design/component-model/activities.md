---
title: Activities
description: "An activity makes the calls to one system, on that system's task queue. Every system has one activity interface, shared by every market."
sidebar_label: Activities
---

import Lead from '@site/src/components/Lead';
import ActivityTable from '@site/src/components/ActivityTable';

export const ACTIVITIES = [
  {
    name: 'PaymentStore',
    system: 'Oracle',
    queue: 'A local activity on the first attempt, then a regular activity for every retry',
    calledBy: "Every stage's commit; Capture's insert-if-absent; the leg writes at release; the guarded cancel; the ID map in Update",
  },
  {
    name: 'InstrumentActivities',
    system: 'Payment Instruments',
    queue: "Verify's calls on the Online cluster: a local activity. Otherwise the workflow's queue: Payment Instruments has no rate limit",
    calledBy: "Verify, Reverify; at confirm, Verify also asks it whether the instrument's verification token is valid; Execute, for the instrument's clear-text data, before the open-to-buy call",
  },
  {
    name: 'OptionsActivities',
    system: 'Payment Options: `ReadPaymentOptionByIdentifier.v1` and `ReadPaymentOptions.v1`',
    queue: "Verify's calls on the Online cluster: a local activity. Otherwise the workflow's queue: Payment Options has no rate limit",
    calledBy: "Verify, to validate the create's payment option ID through `ReadPaymentOptionByIdentifier.v1`; Reverify, through `ReadPaymentOptions.v1`, to confirm the customer still owes and the option still holds",
  },
  {
    name: 'PlansActivities',
    system: "Plans, which holds the payment's mandate details; the verification rules check them where the profile requires mandate authorization",
    queue: "Like Payment Instruments and Payment Options: a local activity in Verify on the Online cluster, otherwise the workflow's queue",
    calledBy: "Verify and Reverify",
  },
  {
    name: 'ClearingActivities',
    system: 'MR/M3',
    queue: 'ds-clearing',
    calledBy: "Execute (at payment level, and for consumer legs), except for Pay with Bank Transfer and a debit card, whose money has already moved; Represent; `ProcessMissingPaidEventsWorkflow`, for a payment's state, but never for those two",
  },
  {
    name: 'ReceivablesActivities',
    system: 'Accounts Receivable (GAR)',
    queue: 'ds-receivables',
    calledBy: "Execute, except a corporate parent's, and every leg; `ProcessMissingPaidEventsWorkflow`, for a payment's state",
  },
  {
    name: 'AuthorizationActivities',
    system: 'Authorizations (AMP), open-to-buy',
    queue: 'ds-authorization',
    calledBy: "Execute, except a corporate parent's, and every leg",
  },
  {
    name: 'AccountingActivities',
    system: 'Accounting',
    queue: 'ds-accounting',
    calledBy: 'Fulfil, and every leg',
  },
  {
    name: 'BalanceControlActivities',
    system: 'eBNC (Balance & Control)',
    queue: 'ds-ebnc',
    calledBy: 'Fulfil, and every leg',
  },
  {
    name: 'RiskActivities',
    system: 'Risk',
    queue: 'ds-risk',
    calledBy: 'Fulfil, and every leg',
  },
  {
    name: 'TransactionNotificationActivities',
    system: 'Three systems told when a payment is processed: TFNE, the Transaction Notification Engine; GPHDB, the legacy Payments History Database; and B2Notifier, which tells other downstream systems',
    queue: 'ds-tfne, ds-gphdb and ds-b2notifier, one per system',
    calledBy: 'Fulfil, and every leg',
  },
  {
    name: 'AllocationActivities',
    system: 'Allocations manager',
    queue: 'ds-allocations',
    calledBy: 'RequestAllocations',
  },
  {
    name: 'BankConfirmationActivities',
    system: "The market's bank-confirmation provider, such as Plaid in the US or Pay with Bank Transfer in the UK",
    queue: "A local activity, inside the create's first workflow task: only the Online cluster calls it",
    calledBy: "RequestConfirmation, for the redirect link, with one try. Verify doesn't call it for the bank details, which the provider verifies itself. In GB, Verify asks it whether the customer's bank account holds enough money for the payment",
  },
  {
    name: 'CardActivities',
    system: "The market's card provider, for a debit card's 3D Secure and its authorization: Checkout.com in the UK; other markets' providers will be added over time",
    queue: 'A local activity inside the decision, as for the bank-confirmation provider: only the Online cluster calls it. The authorization carries the payment ID as its idempotency key, so a retry never debits twice (Proposed)',
    calledBy: "RequestConfirmation, to start 3D Secure with Billpay's callback URL and get the challenge link; Verify's card authorization check, last, which debits the customer's account or is declined",
  },
  {
    name: 'InboxActivities',
    system: "One-Data's inbox functions, event handlers and delete API",
    queue: "The workflow's own queue",
    calledBy: '`ProcessPaidEventsWorkflow`, to fetch and mark; `ProcessMissingPaidEventsWorkflow`, to hand a found event to its handler; the AR intake, returns and inbound dispatchers, to fetch and mark their requests; every create workflow once its payment is decided, and `CreatePaymentIntentWorkflow` once after its reply and again once its payment is decided, for the delete: One-Data\'s one activity interface makes this call too; Execute, to hand One-Data the settlement event Billpay creates for a Pay with Bank Transfer or debit card payment (Proposed)',
  },
  {
    name: 'LifecycleEventActivities',
    system: "RTF: Billpay's lifecycle events, which other systems subscribe to",
    queue: "The workflow's own queue",
    calledBy: "Every stage's announcement; Fulfil and the corporate completion check, before their commit; the PAID events after Settle",
  },
  {
    name: 'CommunicationActivities',
    system: 'Raven, customer messages',
    queue: 'ds-comms',
    calledBy: 'Announcements the customer is told about; Fulfil and the corporate completion check, before their commit',
  },
];

# Activities

<Lead>An activity makes the calls to one system, on that system's task queue. Every system has one activity interface, shared by every market, and none of them vary by behavior.</Lead>

The task queue is how Billpay throttles. A downstream system with an agreed rate gets its own `ds-*` queue, and the queue's server-side rate limit holds across every pod, so the system never sees more than it agreed to. Calls that nobody throttles run on the workflow's own queue, and Oracle is reached only through `PaymentStore`, which runs inside the workflow task itself. [Throttling](../throttling.md) covers how the limits are set and changed.

Activities take IDs, not payment objects, and load what they need. Capture's write is where a payment starts: `PaymentStore` takes the request the workflow was started with and writes it with insert-if-absent, so nothing reaches Oracle before the workflow starts. Data from Payment Options and Payment Instruments is the one other exception: what a stage gets there, clear text included, travels in the workflow to the later calls that need it, such as Execute's open-to-buy call and Fulfil's notifications. Workflow history keeps it encrypted by the payload codec. RTF lifecycle events and Raven messages are activities like the rest: there is no outbox.

## The catalogue

<ActivityTable rows={ACTIVITIES} />

`BankConfirmationActivities` asks the provider for the redirect link, and in GB, for the Funds check. The provider verifies the customer's bank details itself, and for Pay with Bank Transfer the money moves at the bank during the customer's bank connection.

`CardActivities` makes two calls for a debit card. RequestConfirmation starts 3D Secure and gets the challenge link, and Verify's card authorization check authorizes the payment last, which debits the customer's account. The card provider's answer to 3D Secure doesn't come back through an activity at all: the provider calls billpay-online's callback, and the waiting workflow takes it as an update.

`TransactionNotificationActivities` is the one interface that spans systems. TFNE, GPHDB and B2Notifier are all told the same news at the same moment, so they share an interface, but each gets a method of its own, and each method runs on its own system's queue, so every system keeps its own rate limit: `ds-tfne`, `ds-gphdb` and `ds-b2notifier`.

A corporate payment is never declined because its allocations are slow. It waits in `ALLOCATING`, where nothing clears and no leg runs until the last batch arrives, and an alert fires at the market's alert point.

## The stores, the way into Oracle

Every store reads and writes Oracle directly, called from an activity: `PaymentStore` for payment state, and `WorkTrackerStore`, `AllocationBatchStore`, `ConfigStore` and `ControlStore` for the Work Tracker, allocation batches, the published market config and the control tables. Each operation is one transaction. `PaymentStore`'s are:

| Operation | What it writes |
| --- | --- |
| Capture | Insert-if-absent into `trans_dtl`, `trans_lfcyc_event` and the idempotency table. A duplicate means the request was seen before |
| A stage commit | The guarded status update, the timeline entry with the cluster, and any Work Tracker rows the step creates or closes |
| Writing legs | A batch's split rows in 1,000-row array inserts, each with its `ALLOC_LEG` row, in the transaction that records on the batch when its legs were written, so each batch is written once |
| Bank confirmation or 3D Secure | The redirect or challenge link and the provider's reference, guarded on `PENDING` |
| Cancel | The guarded update to `CANCELLED`, and the cancellation of the payment's Work Tracker rows |
| Mapping a replacement | The old and new payment IDs in `ORIG_TRANS_REFER_MAP` |
| Settle | A batch of inbox rows as JDBC batches in one transaction: a guarded update from `PROCESSED` to `PAID` on `trans_dtl` for a payment or on `split_trans_dtl` for a leg, and a `PAID` timeline row tagged with the batch ID wherever the update changed a row. Then a read-back by batch ID |
| Reads | The fields an activity or stage needs, by ID |

Every database activity runs local first, which is what lets a payment ride out an Oracle outage or a patching window without anyone stepping in:

- The first attempt runs as a local activity, inside the workflow task, so a healthy read or write costs no task round trip.
- If it fails, the retry runs as a regular activity with the full retry policy: a schedule-to-close of a few hours and a maximum retry interval of about a minute. The payment pauses and resumes when Oracle is back, even across a worker restart, and no workflow task waits while it does.
- During an outage the governor sees the Oracle errors and stops dispatching, so only the payments already in flight wait.

## Where each call runs

| Call | Runs as | Why |
| --- | --- | --- |
| Oracle reads and writes, through the stores | A local activity on the first attempt; a regular activity for every retry | The first try needs no task round trip; a retry runs on a worker like any activity, with the full retry policy |
| The decision's calls on the Online cluster: Payment Instruments, Payment Options and Plans in Verify, the card provider's authorization in Verify for a debit card, and the provider in RequestConfirmation | A local activity. A Verify call that fails 3 times runs again as a regular activity on `online-wf`, for up to 24 hours | The caller's answer comes out of the workflow's first task, with no task round trip. None of these systems has a rate limit, which a local activity would skip |
| Calls a downstream may throttle, Execute's and Fulfil's on both clusters | A regular activity on that system's `ds-*` queue | The queue's server-side rate limit is the throttle, and priority and fairness apply there. The governor sets the limits on both clusters (agreed 2026-11-07) |
| Slow calls nobody throttles | A regular activity on the workflow's queue, with eager dispatch on | Eager dispatch skips matching and saves writes |

Throttled calls stay off eager dispatch, because it hands the task straight back to the worker and skips the queue's limit. RTF calls fall in the last row, since nobody throttles them, and so do calls to Payment Instruments, Payment Options and Plans everywhere except Verify on the Online cluster. Raven has an agreed rate, so its calls run on `ds-comms`.

## Retries and timeouts

- Business failures that Verify or Reverify find, such as a closed account, insufficient funds or a mandate that fails its check, are not retried. The payment goes to `DECLINED`, its Work Tracker row to `DONE`, and the workflow stops.
- A 429 with `Retry-After` throws `ApplicationFailure.newFailureWithCauseAndDelay(...)` with that delay plus a little jitter. Temporal uses it in place of the retry policy's interval for that attempt.
- Other errors retry from 1 second, doubling, capped at 60 seconds, within a schedule-to-close limit per activity. After that the Work Tracker row goes to `FAILED`, and the payment goes on the exception list in its last state.
- RTF and Raven get a long schedule-to-close, like the database activities. Both must succeed, so an outage pauses payments where they are instead of sending them to the exception list.
- Every downstream HTTP call in Execute and Fulfil times out at 5 seconds, and its activity's start-to-close sits just above that (Proposed: 6 seconds), so the HTTP timeout fires first and a hung call frees its slot (agreed 2026-11-07). Verify's calls stay shorter, at about two to three times the call's p99.
- HTTP clients inside activities don't retry on their own (no MicroProfile `@Retry`, for example). One task is one call, so a queue's limit stays the real call rate.
- Every HTTP call carries an idempotency key, such as `{paymentId}-{step}`, because any activity can run twice.
