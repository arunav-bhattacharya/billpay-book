---
title: One-Data Functions
description: "One-Data functions are the platform's front door: the versioned contracts that channels and other platforms call."
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';
import ApiTable from '@site/src/components/ApiTable';

export const CORE = [
  {fn: 'CreatePayment.v3', method: 'POST', path: '/payments', purpose: 'Pays today or schedules a payment for a future date. A payment that needs the customer to confirm their bank details comes back `PENDING` with the provider\'s redirect link, or `DECLINED` if the provider gives none. A debit card payment comes back `PENDING` with the 3D Secure challenge link. A create on a card account that already has a payment in `PENDING` is declined here, with 200 `DECLINED` and a reason, and never reaches billpay-core.'},
  {fn: 'UpdatePayment.v1', method: 'PUT', path: '/payments/{payment-id}', purpose: 'Updates a `SCHEDULED` payment inside the market\'s cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested.'},
  {fn: 'DeletePayment.v1', method: 'DELETE', path: '/payments/{payment-id}', purpose: 'Cancels a `SCHEDULED` payment inside the cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested. It also cancels a `PENDING` payment that waits for a confirmation, when the customer says no.'},
  {fn: 'ReadPayments.v1', method: 'GET', path: '/payments/account/{account-id}', purpose: 'Lists the payments on a card account, from One-Data\'s Redis and billpay-core together, with duplicates removed and Oracle winning.'},
  {fn: 'ReadPaymentEventsById.v1', method: 'GET', path: '/payments/{payment-id}', purpose: 'Lists the lifecycle states one payment has been through.'},
  {fn: 'CreateCreditBalanceRefund.v1', method: 'POST', path: '/refunds', purpose: 'Refunds a credit balance on a card account.'},
  {fn: 'CreateInboundPayment.v1', api: "None (One-Data's inbox)", link: false, purpose: 'Takes a payment a third party pushed. One-Data stores it and replies 202, and the inbound dispatcher starts its workflow.'},
  {fn: 'CreateConfirmPendingPayment.v1', method: 'POST', path: '/payments/{payment-id}/confirm', link: false, purpose: "Confirms a payment that waited for the customer, with the same payment ID: once the customer has confirmed their bank details on the provider's site. billpay-core sends it to the payment's waiting workflow, which carries on processing the payment. Channels call it."},
  {fn: 'CreatePaymentAllocations.v1', method: 'POST', path: '/payments/{payment-id}/allocations', link: false, purpose: 'The allocations callback for corporate payments, one numbered batch at a time. Replies 202 once the batch is stored and its workflow has started.'},
];

export const COMPOSITE = [
  {fn: 'CreatePaymentInstallment.v1', method: 'POST', path: '/payment-installments', tag: 'Composite', purpose: 'Pays today and creates a plan of future installments (Pay & Plan). Channels call it.'},
  {fn: 'CreateBillpayTransactionFromAccountsReceivable.v1', api: "None (One-Data's inbox)", link: false, tag: 'Composite', purpose: 'Payments and refunds that Accounts Receivable raises, never a corporate payment. One-Data stores each one and replies 202, and the AR intake dispatcher starts its workflow.'},
];

# One-Data Functions

<Lead>One-Data functions are the platform's front door: the versioned contracts that channels and other platforms call. A function either delegates to one billpay-core API or, for work nobody waits on, stores the request in One-Data's inbox for a dispatcher to pull.</Lead>

Every linked name opens its contract in the One-Data explorer. Names the explorer doesn't list yet are plain text.

## Core functions

<ApiTable rows={CORE} />

## Stored creates and the pending check

One-Data makes each payment's ID, a ULID (a unique ID that sorts by time), and every retry of a create carries it, so a retry always lands on the payment billpay-core already has. Two things live in One-Data's Redis, one active-active database across the two sites, IPC1 and IPC2, that each One-Data writes at its own site: every create, stored as Pending, and one hash per card account listing the account's pending payments, each with its amount, date and time created. Persistence is on and eviction is off, so a restart or memory pressure can't drop either.

A hash entry stays only while its payment is `PENDING`. On every create from a channel, before it calls billpay-core, One-Data runs the pending check:

- If the account already has a pending payment, One-Data declines the new create there and then. The channel gets 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the code's name is Proposed). billpay-core is never called, so no payment exists in Billpay for the attempt: no Oracle row, no RTF event and no Raven message. The customer can't make another payment until the pending one is decided.
- Otherwise One-Data adds the new payment to the hash and stores the create, then calls billpay-core. The check and the add must be one atomic step, so that two creates arriving together can't both pass: a Lua script run through the Java Redis SDK, still one Redis call (Proposed).
- The check covers payments from channels: creates through `CreatePayment.v3`, and Pay & Plan's through `CreatePaymentInstallment.v1`. Payments Accounts Receivable raises, push payments from third parties and refunds never go through it.

What happens to a create One-Data lets through:

- If billpay-core doesn't answer within 3 seconds, or answers with a 5xx, One-Data hands the stored create to the Reliable Transaction Framework (RTF), which retries it into billpay-core with exponential backoff and the same payment ID. The channel gets the payment ID and `PENDING`. A `PENDING` reply in time is an answer, so it never goes to RTF.
- A confirm is held the same way. If billpay-core doesn't answer `POST /payments/{payment-id}/confirm` within 3 seconds, or answers with a 5xx, RTF retries the confirm with the same update ID, `{paymentId}-confirm`, and the channel gets `PENDING`. RTF retries a held confirm at least once a minute (Proposed), so it lands in the extra window that a late timer gives ([Create Payment Intent](../../design/component-model/workflows/core.md#create-payment-intent)). The customer's no isn't held, because the payment is cancelled when its window ends anyway. Updates and cancels go straight to billpay-core.
- As soon as a create's payment is decided, when it leaves `PENDING` for `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`, billpay-core calls One-Data's delete API, `DeletePendingPayment.v1`, with the payment and account IDs, and retries until it lands. One-Data removes the stored create and the account's hash entry, so the account can take its next payment. A payment that waits for its customer keeps its entry while it waits: after its reply, billpay-core calls the delete saying the payment still waits, so One-Data removes only the stored create, and calls it again once the payment is decided, which removes the entry. One-Data removes either only on billpay-core's word: the delete, or billpay-core refusing the create with a 4xx. Its contract is still to come.
- `ReadPayments.v1` reads Redis and billpay-core, removes duplicates on payment ID and customer account, and Oracle wins. Every create One-Data lets through is in Redis from the start, so a payment shows from the moment it is made, and shows one `PENDING`, whatever it waits for.

Three edge cases have a working answer:

- If Redis is down, One-Data makes the pending check through `ReadPayments.v1` instead, which then reads billpay-core alone, and declines the create if the account has a `PENDING` payment there. Nothing is stored. A create One-Data held, or one billpay-core hasn't captured yet, isn't in Oracle, so the check can miss it, and that edge is accepted.
- Two creates for one account that reach different Redis sites within the replication lag miss each other, and both go through, though one should have been declined. The window is narrow, so it is accepted, and such pairs are counted from Oracle. Only if they show up does billpay-core add the same check against Oracle, at one query per create.
- A held pay-by-bank create would get a redirect link nobody sees. One-Data can probably tell such a create from its instrument type, when it carries bank details, which One-Data is to confirm. Proposed: One-Data doesn't hold it, and the channel asks the customer to try again. If billpay-core never got the create, no delete comes, and the alert on the age of pending entries finds it.

A pending entry left behind blocks its account, because One-Data declines every create while it stays. billpay-core retries the delete until it lands, and the alert on the age of pending entries finds one that stays too long. Whether One-Data should ever drop an old entry on its own, and after how long, is still open.

[When another payment is still pending](../../design/journeys/make-a-payment.md#when-another-payment-is-still-pending) puts the rule in the customer's terms, and [Creates that arrive late or twice](../../design/component-model/workflows/core.md#creates-that-arrive-late-or-twice) covers what billpay-core does with a repeat.

## Composite functions

<ApiTable rows={COMPOSITE} />

## Event handlers

Event handlers take events from other platforms. None of them starts or waits on a workflow: they store what arrives in One-Data's inbox, and call Billpay only to find a payment an event doesn't name.

| Handler | What it takes |
| --- | --- |
| `CreateMoneyMovementEventHandler.v1` | Money movement events from MR/M3, the clearing system. A return is stored in the inbox for the returns dispatcher. A settlement is recorded in the inbox against its payment and presentment. For a Pay with Bank Transfer or debit card payment, which MR/M3 never settles, Billpay's Execute sends the settlement event here itself, dated when the money moved (Proposed). |
| `CreateAccountsReceivableTransactionEventHandler.v1` | Accounts Receivable (GAR) events. An AR posting is recorded in the inbox against its payment, or leg, and presentment. |
| `CreateOpentoBuyUpdatePaymentEventHandler.v1` | Authorizations (AMP) events. It acknowledges them and does nothing else: no inbox row, and no work in Billpay. |

The inbox lives in One-Data's Postgres database, not in Billpay's Oracle. For `PAID`, One-Data marks a payment's row `READY` once it has both an AR posting and a settlement, whether the settlement came from MR/M3 or from Billpay, and `ProcessPaidEventsWorkflow` reads only `READY` rows and sets each payment or leg `PAID`.

- The money movement and AR handlers write the raw event and upsert the payment's inbox row in one transaction, and acknowledge the sender only after the commit. If the database is down, the sender gets an error and retries.
- There is one row per payment or leg, under the ID the event carries. A leg's ID is `{paymentId}_{seq}`, and its AR posting pairs with the settlement of the payment named before the `_`: a split payment settles once, as a whole, while each leg posts on its own.
- An event without a payment ID is matched through `ReadPayments.v1`, by its account ID. Most events carry the ID, so the lookup is rare. If it finds no single payment, the raw event stays in `billpay_extnl_event` and an alert names it.
- Whichever event arrives second sets the row `READY`, in the same transaction. A lock per payment ID makes a settlement and its legs' postings that arrive together see each other, and a repeated event can't set a row twice.
- Handlers never pace anything or run on a schedule.

## Inbox functions

Billpay reaches the inbox only through four functions, never through the database. `ProcessPaidEventsWorkflow` calls the first two, and the AR intake, returns and inbound dispatchers call the other two. One-Data runs a fifth on its own schedule. Every One-Data function's name starts with Create, Read, Update or Delete, by what it does, and these are the real names.

| Function | What it does |
| --- | --- |
| `ReadPaidReadyPayments.v1` | Puts `UNMATCHED` rows last tried over an hour ago, and under 48 hours old, back to `READY`, then returns up to 500 of the oldest `READY` rows, each with its `stlmt_ts` and `ar_pstd_ts`, which Settle writes onto the payment. It changes nothing else, so a repeat before the status update returns the same rows. Proposed: `UpdateUnmatchedPayments.v1` takes over the move back to `READY`, so this one only reads. |
| `UpdatePaidReadyPayments.v1` | Sets the listed rows `DONE` or `UNMATCHED` in one transaction and returns the counts. Setting a status twice does no harm, so a retry is safe. |
| `ReadStartRequests.v1` | Returns up to a dispatcher's tick of the oldest `READY` requests for that dispatcher: AR intake (payments and refunds), returns or inbound. It changes nothing, so a repeat returns the same requests. |
| `UpdateStartRequests.v1` | Sets the listed requests `DONE` or `REJECTED` in one transaction. Setting a status twice does no harm. |
| `UpdateUnmatchedPayments.v1` | One-Data runs it on a cron schedule; Billpay never calls it. It raises an alert for each row that has stayed `UNMATCHED` for 48 hours. Proposed: it runs every 15 minutes, takes over the move back to `READY`, and checks the age of the oldest waiting row in each inbox, for the returns and `PAID` backlog-age alerts. |

`ProcessMissingPaidEventsWorkflow` hands an event it finds to its One-Data handler, the same way MR/M3 and GAR send events. [Periodic Workflows](../../design/component-model/workflows/periodic.md) has both `PAID` workflows.
