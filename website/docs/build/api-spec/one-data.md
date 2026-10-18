---
title: One-Data Functions
description: "One-Data functions are the platform's front door: the versioned contracts that channels and other platforms call."
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';
import ApiTable from '@site/src/components/ApiTable';

export const CORE = [
  {fn: 'CreatePayment.v3', method: 'POST', path: '/payments', purpose: 'Pays today or schedules a payment for a future date. A payment that needs the customer to confirm their bank details comes back `PENDING` with the provider\'s redirect link.'},
  {fn: 'UpdatePayment.v1', method: 'PUT', path: '/payments/{payment-id}', purpose: 'Updates a `SCHEDULED` payment inside the market\'s cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested.'},
  {fn: 'DeletePayment.v1', method: 'DELETE', path: '/payments/{payment-id}', purpose: 'Cancels a `SCHEDULED` payment inside the cancellation window; after it, 409. A corporate payment leaves `SCHEDULED` when its allocations are requested.'},
  {fn: 'ReadPayments.v1', method: 'GET', path: '/payments/account/{account-id}', purpose: 'Lists the payments on a card account.'},
  {fn: 'ReadPaymentEventsById.v1', method: 'GET', path: '/payments/{payment-id}', purpose: 'Lists the lifecycle states one payment has been through.'},
  {fn: 'CreateCreditBalanceRefund.v1', method: 'POST', path: '/refunds', purpose: 'Refunds a credit balance on a card account.'},
  {fn: 'CreateInboundPayment.v1', api: "None (One-Data's inbox)", link: false, purpose: 'Takes a payment a third party pushed. One-Data stores it and replies 202, and the inbound dispatcher starts its workflow.'},
  {fn: 'ConfirmPendingPayment.v1', method: 'POST', path: '/payments/{payment-id}/confirm', link: false, purpose: "Confirms a payment that waited for the customer's bank, with the same payment ID, once the customer has confirmed their bank details on the provider's site. It starts processing the payment. Channels call it."},
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

## Composite functions

<ApiTable rows={COMPOSITE} />

## Event handlers

Event handlers take events from other platforms. None of them starts or waits on a workflow: they store what arrives in One-Data's inbox, and call Billpay only to find a payment an event doesn't name.

| Handler | What it takes |
| --- | --- |
| `CreateMoneyMovementEventHandler.v1` | Money movement events from MR/M3. A return is stored in the inbox for the returns dispatcher. A settlement is recorded in the inbox against its payment and presentment. |
| `CreateAccountsReceivableTransactionEventHandler.v1` | Accounts Receivable (GAR) events. An AR posting is recorded in the inbox against its payment, or leg, and presentment. |
| `CreateOpentoBuyUpdatePaymentEventHandler.v1` | Authorizations (AMP) events, stored by One-Data. Details are still to be defined. |

The inbox lives in One-Data's Postgres database, not in Billpay's Oracle. For `PAID`, One-Data marks a payment's row `READY` once it has both an AR posting and a settlement, and `ProcessPaidEventsWorkflow` reads only `READY` rows and sets each payment or leg `PAID`.

- Each handler writes the raw event and upserts the payment's inbox row in one transaction, and acknowledges the sender only after the commit. If the database is down, the sender gets an error and retries.
- There is one row per payment or leg, under the ID the event carries. A leg's ID is `{paymentId}_{seq}`, and its AR posting pairs with the settlement of the payment named before the `_`: a split payment settles once, as a whole, while each leg posts on its own.
- An event without a payment ID is matched through `ReadPayments.v1`, by its account ID. Most events carry the ID, so the lookup is rare. If it finds no single payment, the raw event stays in `billpay_extnl_event` and an alert names it.
- Whichever event arrives second sets the row `READY`, in the same transaction. A lock per payment ID makes a settlement and its legs' postings that arrive together see each other, and a repeated event can't set a row twice.
- Handlers never pace anything or run on a schedule.

## Inbox functions

Billpay reaches the inbox only through four functions, never through the database. `ProcessPaidEventsWorkflow` calls the first two, and the AR intake, returns and inbound dispatchers call the other two. All four names are placeholders.

| Function | What it does |
| --- | --- |
| `ReadPaidReadyPayments.v1` | Puts `UNMATCHED` rows last tried over an hour ago, and under 48 hours old, back to `READY`, then returns up to 500 of the oldest `READY` rows. It changes nothing else, so a repeat returns the same rows. |
| `UpdatePaidReadyPayments.v1` | Sets the listed rows `DONE` or `UNMATCHED` in one transaction and returns the counts. Setting a status twice does no harm, so a retry is safe. |
| `ReadStartRequests.v1` | Returns up to a dispatcher's tick of the oldest `READY` requests for that dispatcher: AR intake (payments and refunds), returns or inbound. It changes nothing, so a repeat returns the same requests. |
| `UpdateStartRequests.v1` | Sets the listed requests `DONE` or `REJECTED` in one transaction. Setting a status twice does no harm. |

`ProcessMissingPaidEventsWorkflow` hands an event it finds to its One-Data handler, the same way MR/M3 and GAR send events. [Periodic Workflows](../../design/component-model/workflows/periodic.md) has both `PAID` workflows.
