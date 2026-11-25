---
title: One-Data Functions
description: "One-Data functions are the platform's front door: the versioned contracts that channels and other platforms call."
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';
import ApiTable from '@site/src/components/ApiTable';

export const CORE = [
  {fn: 'CreatePayment.v3', method: 'POST', path: '/payments', purpose: 'Pays today or schedules a payment for a future date. A create from a channel carries the payment option ID the customer chose, from `ReadPaymentOptions.v1`. A payment that needs the customer to confirm it at their bank comes back `PENDING` with Amex Pay with Bank Transfer\'s redirect link, or `DECLINED` if none comes back. A debit card payment comes back `PENDING` with the 3D Secure challenge link. A create on a card account that already has a payment in `PENDING` is declined here, with 200 `DECLINED` and a reason, and never reaches billpay-online.'},
  {fn: 'UpdatePayment.v1', method: 'PUT', path: '/payments/{payment-id}', purpose: 'Updates a `SCHEDULED` payment inside the market\'s cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested.'},
  {fn: 'DeletePayment.v1', method: 'DELETE', path: '/payments/{payment-id}', purpose: 'Cancels a `SCHEDULED` payment inside the cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested. It also cancels a `PENDING` payment that waits for a confirmation, when the customer says no.'},
  {fn: 'ReadPayments.v1', method: 'GET', path: '/payments/account/{account-id}', purpose: 'Lists the payments on a card account, from One-Data\'s Redis and billpay-online together, with duplicates removed and Oracle winning.'},
  {fn: 'ReadPaymentEventsById.v1', method: 'GET', path: '/payments/{payment-id}', purpose: 'Lists the lifecycle states one payment has been through.'},
  {fn: 'CreateCreditBalanceRefund.v1', method: 'POST', path: '/refunds', purpose: 'Refunds a credit balance on a card account.'},
  {fn: 'CreateInboundPayment.v1', api: "None (One-Data's inbox)", link: false, purpose: 'Takes a payment a third party pushed. One-Data stores it and replies 202, and the inbound dispatcher starts its workflow.'},
  {fn: 'CreatePaymentSubmission.v1', method: 'POST', path: '/payments/{payment-id}/submission', link: false, purpose: "Tells Billpay the customer is back from their bank, with the same payment ID, once the payer's bank routes them back to the channel. billpay-online sends an update to the payment's waiting workflow, which submits the payment through Amex Pay with Bank Transfer's PaymentSubmission once and answers with the status: PENDING, ACCEPTED or DECLINED. The channel shows the customer that status, and its part ends there; the customer finds the payment later through ReadPayments.v1. Channels call it. It replaces CreateConfirmPendingPayment.v1."},
  {fn: 'CreatePaymentAllocations.v1', method: 'POST', path: '/payments/{payment-id}/allocations', link: false, purpose: 'The allocations callback for corporate payments, one numbered batch at a time. Replies 202 once the batch is stored and its workflow has started.'},
  {fn: 'ReadBillpayInstruments.v1', method: 'GET', path: '/instruments/account/{account-id}?source={source}&journeyContext={journeyContext}', link: false, purpose: 'The instruments a customer can pay from. The channel passes two mandatory filters: the source, `EnrolledInstruments`, `DebitCard` or `PayWithBankTransfer`, and the journey context, `ONE_TIME_DIRECT_DEBIT` or `RECURRING_DIRECT_DEBIT`. billpay-online reads enrolled instruments from Payment Instruments\' `ReadInstruments`, or banks from Amex Pay with Bank Transfer\'s `GET /banks`, and filters them by the market\'s rules and, for enrolled instruments, by the statuses the context allows. A recurring direct debit takes enrolled instruments only, and any other source gets 400 (Proposed). A failed read answers 503, a market that isn\'t live 422 (Proposed). Starts no workflow. The path is Proposed.'},
];

export const COMPOSITE = [
  {fn: 'CreatePaymentInstallment.v1', method: 'POST', path: '/payment-installments', tag: 'Composite', purpose: 'Pays today and creates a plan of future installments (Pay & Plan). Channels call it.'},
  {fn: 'CreateBillpayTransactionFromAccountsReceivable.v1', api: "None (One-Data's inbox)", link: false, tag: 'Composite', purpose: 'Payments and refunds that Accounts Receivable raises, never a corporate payment. One-Data stores each one and replies 202, and the AR intake dispatcher starts its workflow.'},
];

# One-Data Functions

<Lead>One-Data functions are the platform's front door: the versioned contracts that channels and other platforms call. A function either delegates to one API on billpay-online (billpay-offline for the allocations callback) or, for work nobody waits on, stores the request in One-Data's inbox for a dispatcher to pull.</Lead>

Every linked name opens its contract in the One-Data explorer. Names the explorer doesn't list yet are plain text.

Before it calls billpay-online, One-Data looks up the card account's market and account type with `ReadCustomerAccountInfo.v1` and passes both on every `/payments` call: the create, the update, the cancel and the confirm. A create also carries each instruction's instrument type, and one payment ID and one idempotency key for each instruction, so a create with several instructions arrives with all its IDs and keys (agreed 2026-11-07). Such a create also carries a group ID, a ULID One-Data makes for the whole request and repeats on every retry, which names the composite's workflow ([Composite Workflows](../../design/component-model/workflows/composite.md#create-payment-with-multiple-instructions)). One-Data passes every ID, and Billpay derives none (agreed 2026-11-07). A create RTF delivers carries an async flag, which One-Data's direct call never does (agreed 2026-11-07). The fields' wire names come with the contracts.

## Core functions

<ApiTable rows={CORE} />

## Stored creates and the pending check

One-Data makes each payment's ID, a ULID (a unique ID that sorts by time), and every retry of a create carries it, so a retry always lands on the payment billpay-online already has. Two things live in One-Data's Redis, one active-active database across the two sites, IPC1 and IPC2, that each One-Data writes at its own site: every create, stored as Pending, and one hash per card account listing the account's pending payments, each with its amount, date and time created. Persistence is on and eviction is off, so a restart or memory pressure can't drop either. A payment that waits for its customer, by Pay with Bank Transfer, Plaid or a debit card, is kept there like any other until it is decided (agreed 2026-11-08). One-Data knows such a create from the instruction the customer chose.

A hash entry stays only while its payment is `PENDING`. On every create from a channel, before it calls billpay-online, One-Data runs the pending check:

- If the account already has a pending payment, One-Data declines the new create there and then. The channel gets 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the code's name is Proposed). billpay-online is never called, so no payment exists in Billpay for the attempt: no Oracle row, no RTF event and no Raven message. The customer can't make another payment until the pending one is decided.
- Otherwise One-Data adds the new payment to the hash and stores the create, then calls billpay-online. A create with several instructions adds one entry for each instruction (agreed 2026-11-07). The check and the add must be one atomic step, so that two creates arriving together can't both pass: a Lua script run through the Java Redis SDK, still one Redis call (Proposed).
- The check covers payments from channels: creates through `CreatePayment.v3`, and Pay & Plan's through `CreatePaymentInstallment.v1`. Payments Accounts Receivable raises, push payments from third parties and refunds never go through it.
- A Pay with Bank Transfer, Plaid or debit card create is checked, added and stored like any other, so while it waits for its customer its entry blocks the account's next payment until it is decided (agreed 2026-11-08).

What happens to a create One-Data lets through:

- If billpay-online doesn't answer within 3 seconds, or answers with a 5xx, One-Data hands the stored create to the Reliable Transaction Framework (RTF), which retries it into billpay-online with exponential backoff and the same payment ID. The channel gets the payment ID and `PENDING`. A `PENDING` reply in time is an answer, so it never goes to RTF.
- The channel's call once the customer is back isn't held for RTF. If billpay-online doesn't answer `POST /payments/{payment-id}/submission` within 3 seconds, or answers with a 5xx, One-Data answers the channel 503 and the channel calls again. A repeated call attaches to the same update and gets the same answer, so it is safe, and if no call ever lands, Amex Pay with Bank Transfer's own confirmation decides the payment, with Billpay's status calls after 2 minutes (TBD) as the fallback. A US payment confirmed through Plaid follows the same rules as Pay with Bank Transfer (agreed 2026-11-08). The customer's no isn't held either. Updates and cancels go straight to billpay-online.
- As soon as a create's payment is decided, when it leaves `PENDING` for `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`, every create workflow calls One-Data's delete API, `DeletePendingPayment.v1`, with the payment and account IDs, and retries until it lands. A composite calls it for every instruction it decides, a declined one included, since a declined instruction gets no child (agreed 2026-11-07). The call is always in the workflow's async part, after the caller's reply. A payment decided after its reply, such as one that got `PENDING` at 2.5 s, is cleared the same way. A payment that waits for its customer makes the call once, when it is decided: by Amex Pay with Bank Transfer's answer, M3's notice, the 3D Secure callback, the no or its window running out, or at the create when it is declined there (agreed 2026-11-08). An inbound payment, which comes through `CreateInboundPayment.v1`, makes no delete. For a create One-Data never stored, such as one from Accounts Receivable, it finds nothing to remove. One-Data removes the stored create and the account's hash entry, so the account can take its next payment. One-Data removes either only on Billpay's word: the delete, or billpay-online refusing the create with a 4xx; or when it answers 503 for a Pay with Bank Transfer, Plaid or debit card create it didn't hold (agreed 2026-11-08). Its contract is still to come.
- `ReadPayments.v1` reads Redis and billpay-online, removes duplicates on payment ID and customer account, and Oracle wins. Every create One-Data stores is in Redis from the start, so a payment shows from the moment it is made, and shows one `PENDING`, whatever it waits for.

Three edge cases have a working answer:

- If Redis is down, One-Data makes the pending check through `ReadPayments.v1` instead, which then reads billpay-online alone, and declines the create if the account has a `PENDING` payment there. Nothing is stored. A create One-Data held, or one billpay-online hasn't captured yet, isn't in Oracle, so the check can miss it, and that edge is accepted.
- Two creates for one account that reach different Redis sites within the replication lag miss each other, and both go through, though one should have been declined. The window is narrow, so it is accepted, and such pairs are counted from Oracle. Only if they show up does billpay-online add the same check against Oracle, at one query per create.
- A held Pay with Bank Transfer, Plaid or debit card create would get a redirect link, or a 3D Secure challenge link, that nobody sees. So One-Data doesn't hold it: it answers the channel 503, the channel asks the customer to try again, and RTF never retries it (agreed 2026-11-07 for a debit card, 2026-11-08 for bank confirmation). `CreatePayment.v3` knows such a create from the instruction the customer chose (agreed 2026-11-07). One-Data stored the create and its entry before it called billpay-online, and removes both when it answers 503, so the customer's retry is never blocked (agreed 2026-11-08). If billpay-online captured the create after all, that payment waits with no customer, moves no money and is cancelled when its window runs out; its delete then finds nothing to remove.

An entry can be left behind when no delete ever lands: One-Data's delete API keeps failing, billpay-online never got the create, or perhaps a delete reaches one Redis site before the entry has replicated from the other (for One-Data to confirm). While it stays, One-Data declines every create on its account. So One-Data runs a sweep on its own schedule, every hour, and Billpay never calls it. It takes the entries older than their market's sweep age, a market setting (`pendingSweepAfter`, 2 hours unless the market sets it; the name is Proposed), and asks billpay-online about each one through `GET /payments/{payment-id}`. A market whose Pay with Bank Transfer wait runs 48 hours sets it longer, so a payment still inside its wait isn't reported. How One-Data reads each market's value is open:

- The payment is no longer `PENDING`, whatever state it has reached, or billpay-online has no record of it: the sweep removes the entry, and the stored create if it is still there, as the missed delete would have. A create One-Data still holds for RTF is skipped, since it may still land.
- The payment is still `PENDING` in billpay-online: the entry stays, so the account can't take a second payment while this one is undecided.
- A read that fails leaves the entry for the next run (Proposed, 2026-11-07).
- A run that removed or kept any entries raises one alert with two lists, each with its count and payment IDs: the entries it removed, and the payments still `PENDING` whose entries it kept.

The sweep's name, `DeleteStalePendingPayments.v1`, is Proposed.

[When another payment is still pending](../../design/journeys/make-a-payment.md#when-another-payment-is-still-pending) puts the rule in the customer's terms, and [Creates that arrive late or twice](../../design/component-model/workflows/core.md#creates-that-arrive-late-or-twice) covers what billpay-online does with a repeat.

## Composite functions

<ApiTable rows={COMPOSITE} />

## Event handlers

Event handlers take events from other platforms. None of them starts or waits on a workflow: the money movement, AR and settlement handlers store what arrives in One-Data's inbox, and call Billpay to find a payment an event doesn't name. The settlement handler and Amex Pay with Bank Transfer's confirmation call Billpay to tell a waiting payment.

| Handler | What it takes |
| --- | --- |
| `CreateMoneyMovementEventHandler.v1` | Money movement events from MR/M3, the clearing system. A return is stored in the inbox for the returns dispatcher. A settlement is recorded in the inbox against its payment and presentment. A debit card, MR Points or inbound payment gets none: its settlement is known, so Billpay pays it on the AR posting alone and sends no settlement event of its own (agreed 2026-11-24). For Pay with Bank Transfer, M3's notice is the settlement, and it comes through `CreateBillpaySettlementEvent.v1` below. |
| `CreateAccountsReceivableTransactionEventHandler.v1` | Accounts Receivable (GAR) events. An AR posting is recorded in the inbox against its payment, or leg, and presentment. |
| `CreateOpentoBuyUpdatePaymentEventHandler.v1` | Authorizations (AMP) events. It acknowledges them and does nothing else: no inbox row, and no work in Billpay. |
| `CreateBillpaySettlementEvent.v1` | M3's notice that the payer's bank has settled a Pay with Bank Transfer payment, or that the settlement failed (agreed 2026-11-23). It calls billpay-online's `POST /payments/{payment-id}/settlement`, which signals the waiting payment. It records a settled notice in the inbox against its payment, as the settlement for `PAID` (Billpay's side agreed 2026-11-24; One-Data has still to agree). Its contract is a placeholder until the company's repo supplies it. |
| `UpdatePaymentConfirmation.v1` | Amex Pay with Bank Transfer's own answer on a Pay with Bank Transfer payment, confirmed or declined, sent whether or not the channel called `CreatePaymentSubmission.v1` (agreed 2026-11-24). It calls billpay-online's `POST /payments/{payment-id}/confirmation`, which signals the waiting payment; a payment already `ACCEPTED`, or past it, ignores it. It writes nothing to the inbox. Its contract is a placeholder until the company's repo supplies it. |

The inbox lives in One-Data's Postgres database, not in Billpay's Oracle. One-Data only stores: a handler fills the event's timestamp on the payment's, or leg's, row and marks it `READY`, which means an event came in for Billpay to look at. Billpay decides `PAID`: `ProcessPaidEventsWorkflow` reads the `READY` rows, pairs the events and sets each payment or leg `PAID` once it has what it needs (agreed 2026-11-24).

- The money movement and AR handlers write the raw event and upsert the payment's inbox row in one transaction, and acknowledge the sender only after the commit. If the database is down, the sender gets an error and retries.
- There is one row per payment or leg, under the ID the event carries. A leg's ID is `{paymentId}_{seq}`. Billpay pairs a corporate leg's AR posting with the settlement of the payment named before the `_`, because a corporate payment settles once, as a whole. A consumer split's leg clears on its own, so its posting pairs with its own settlement (agreed 2026-11-07).
- An event without a payment ID is matched through `ReadPayments.v1`, by its account ID: to the account's one payment in a fitting status, `PROCESSED` for a settlement or a posting, and `PROCESSING`, `PROCESSED`, `PAID` or `REPRESENTED` for a return (Proposed, 2026-11-07). Most events carry the ID, so the lookup is rare. If it finds no single payment, the raw event stays in `billpay_extnl_event` and an alert names it.
- An event that fills an empty timestamp marks the row `READY`, whichever event it is, and a repeated event changes nothing. The handlers take no lock per payment and pair nothing (agreed 2026-11-24).
- Handlers never pace anything or run on a schedule.

## How Billpay reaches the inbox

billpay-offline reads and updates One-Data's two inbox tables itself, `billpay_paid_ready` and `billpay_start_rqst`, with plain JDBC through its own pool, `onedata`, of 8 connections, set through `billpay.onedata.db.*`. There is no One-Data function in between, and no push from One-Data: Billpay reads new rows at fixed intervals (agreed 2026-11-24). The five inbox functions are gone: `ReadPaidReadyPayments.v1`, `UpdatePaidReadyPayments.v1`, `ReadStartRequests.v1`, `UpdateStartRequests.v1` and `UpdateUnmatchedPayments.v1`.

| Who | What it reads and updates |
| --- | --- |
| The PAID drain | Moves `UNMATCHED` rows last tried over an hour ago, and under 48 hours old, back to `READY`, then reads up to 500 of the oldest `READY` rows, each with its `stlmt_ts` and `ar_pstd_ts`, and for a corporate leg its payment's settlement. Once Settle has decided, it marks each row `DONE`, `WAITING` or `UNMATCHED`, and wakes a corporate payment's legs that posted first once its settlement is in. |
| The AR intake, returns and inbound dispatchers | Read up to a tick of the oldest `READY` requests of their type, and mark each `DONE` once started, or `REJECTED`. A body that can't be read, or a return for a payment Billpay doesn't have, is `REJECTED` (Proposed, 2026-11-07). |

- Every update is guarded on `READY` and on the row's timestamps as Billpay read them, so an event that comes in meanwhile leaves the row `READY` for the next batch, and setting a status twice does no harm.
- `billpay_paid_unmatched_stale`, a gauge of the rows `UNMATCHED` for 48 hours, raises the alert One-Data's function used to.
- At each read, the returns dispatcher and the `PAID` drain check the age of the oldest `READY` row in their table, and bump `billpay_inbox_over_age_total{queue}` past 6 hours for returns or 1 hour for `PAID` (both Proposed), which raises the backlog-age alerts (agreed 2026-11-24). Held at a rate of zero, each still makes one fetch, and the held drain checks the age again once a minute, so its alert can't clear while it stays held. A row's age counts from when it last became `READY`, so a row back from `UNMATCHED` doesn't look old (agreed 2026-11-07).

One-Data still has to agree: the two tables as a contract, with the wiki's names and columns; a database user for billpay-offline that may read both tables and update `sta_cd` and `lst_updt_ts`; a row marked `READY` whenever an event fills an empty timestamp; and M3's settled notice stored as the payment's settlement.

`ProcessMissingPaidEventsWorkflow` hands an event it finds to its One-Data handler, the same way MR/M3 and GAR send events. [Periodic Workflows](../../design/component-model/workflows/periodic.md) has both `PAID` workflows.
