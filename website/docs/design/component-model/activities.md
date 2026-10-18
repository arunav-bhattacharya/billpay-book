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
    queue: 'Local activity',
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
    system: 'Payment Options',
    queue: "Verify's calls on the Online cluster: a local activity. Otherwise the workflow's queue: Payment Options has no rate limit",
    calledBy: 'Verify, Reverify',
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
    calledBy: "Execute (at payment level, and for consumer legs), Represent; `ProcessMissingPaidEventsWorkflow`, for a payment's state",
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
    calledBy: "RequestConfirmation, for the redirect link, with one try. Verify doesn't call it: the provider verifies the customer's bank details itself",
  },
  {
    name: 'InboxActivities',
    system: "One-Data's inbox functions, event handlers and delete API",
    queue: "The workflow's own queue",
    calledBy: '`ProcessPaidEventsWorkflow`, to fetch and mark; `ProcessMissingPaidEventsWorkflow`, to hand a found event to its handler; the AR intake, returns and inbound dispatchers, to fetch and mark their requests; every create from a channel at its end, and `CreatePaymentIntentWorkflow` once after its reply and again at its end, for the delete (Proposed: One-Data\'s one activity interface makes this call too)',
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

`BankConfirmationActivities` asks the provider only for the redirect link: the provider verifies the customer's bank details itself.

`TransactionNotificationActivities` is the one interface that spans systems. TFNE, GPHDB and B2Notifier are all told the same news at the same moment, so they share an interface, but each gets a method of its own, and each method runs on its own system's queue, so every system keeps its own rate limit. The queue names are Proposed.

A corporate payment is never declined because its allocations are slow. It waits in `ALLOCATING`, where nothing clears and no leg runs until the last batch arrives, and an alert fires at the market's alert point.

## PaymentStore, the only way into Oracle

`PaymentStore` is the only code that reads or writes Oracle. Each of its operations is one transaction:

| Operation | What it writes |
| --- | --- |
| Capture | Insert-if-absent into `trans_dtl`, `trans_lfcyc_event` and the idempotency table. A duplicate means the request was seen before |
| A stage commit | The guarded status update, the timeline entry with the cluster, and any Work Tracker rows the step creates or closes |
| Writing legs | A batch's split rows in 1,000-row array inserts, each with its `ALLOC_LEG` row, in the transaction that records on the batch when its legs were written, so each batch is written once |
| Bank confirmation | The redirect link and the provider's reference, or for a go-ahead the IDs the customer was shown, guarded on `PENDING` |
| Cancel | The guarded update to `CANCELLED`, and the cancellation of the payment's Work Tracker rows |
| Mapping a replacement | The old and new payment IDs in `ORIG_TRANS_REFER_MAP` |
| Settle | A batch of inbox rows as JDBC batches in one transaction: a guarded update from `PROCESSED` to `PAID` on `trans_dtl` for a payment or on `split_trans_dtl` for a leg, and a `PAID` timeline row tagged with the batch ID wherever the update changed a row. Then a read-back by batch ID |
| Reads | The fields an activity or stage needs, by ID |

It runs as a local activity, which is what lets a payment ride out an Oracle outage or a patching window without anyone stepping in:

- Short blips retry inside the same workflow task.
- Once the wait between retries passes the local retry threshold (three times the workflow task timeout, 30 seconds by default in the Java SDK), the SDK schedules a durable timer and retries in a later task. The payment pauses and resumes when Oracle is back, even across a worker restart.
- `PaymentStore` gets a schedule-to-close timeout of a few hours and a maximum retry interval of about a minute. A Java local activity with neither a schedule-to-close nor a maximum number of attempts is not retried at all, so both are set.
- During an outage the governor sees the Oracle errors and stops dispatching, so only the payments already in flight wait.

## Where each call runs

| Call | Runs as | Why |
| --- | --- | --- |
| Oracle reads and writes | A local activity (`PaymentStore`) | No task round trip, and one marker in history when the workflow task completes |
| The decision's calls on the Online cluster: Payment Instruments, Payment Options and Plans in Verify, and the provider in RequestConfirmation | A local activity | The caller's answer comes out of the workflow's first task, with no task round trip. None of these systems has a rate limit, which a local activity would skip |
| Calls a downstream may throttle | A regular activity on that system's `ds-*` queue | The queue's server-side rate limit is the throttle, and priority and fairness apply there |
| Slow calls nobody throttles | A regular activity on the workflow's queue, with eager dispatch on | Eager dispatch skips matching and saves writes |

Throttled calls stay off eager dispatch, because it hands the task straight back to the worker and skips the queue's limit. RTF calls fall in the last row, since nobody throttles them, and so do calls to Payment Instruments, Payment Options and Plans everywhere except Verify on the Online cluster. Raven has an agreed rate, so its calls run on `ds-comms`.

## Retries and timeouts

- Business failures that Verify or Reverify find, such as a closed account, insufficient funds or a mandate that fails its check, are not retried. The payment goes to `DECLINED`, its Work Tracker row to `DONE`, and the workflow stops.
- A 429 with `Retry-After` throws `ApplicationFailure.newFailureWithCauseAndDelay(...)` with that delay plus a little jitter. Temporal uses it in place of the retry policy's interval for that attempt.
- Other errors retry from 1 second, doubling, capped at 60 seconds, within a schedule-to-close limit per activity. After that the Work Tracker row goes to `FAILED`, and the payment goes on the exception list in its last state.
- RTF and Raven get a long schedule-to-close, like `PaymentStore`. Both must succeed, so an outage pauses payments where they are instead of sending them to the exception list.
- Start-to-close is about two to three times the call's p99, so a hung call frees its slot quickly.
- HTTP clients inside activities don't retry on their own (no MicroProfile `@Retry`, for example). One task is one call, so a queue's limit stays the real call rate.
- Every HTTP call carries an idempotency key, such as `{paymentId}-{step}`, because any activity can run twice.
