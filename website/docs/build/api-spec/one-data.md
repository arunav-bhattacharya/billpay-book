---
title: One-Data Functions
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';

# One-Data Functions

<Lead>One-Data Functions are the platform's front door. They are versioned, stable contracts — a channel integrates against <code>CreatePayment.v3</code> and keeps working while everything behind it evolves. Each function is thin: it validates the contract and delegates to one Billpay core REST API.</Lead>

## Core functions

| Function | Delegates to | What it's for |
| --- | --- | --- |
| `CreatePayment.v3` | `POST /payments` | Initiate a payment — immediately, or scheduled for a future date. |
| `UpdatePayment.v1` | `PUT /payments/{payment-id}` | Update a scheduled payment (cancel-and-recreate under the hood). |
| `DeletePayment.v1` | `DELETE /payments/{payment-id}` | Cancel a scheduled or accepted payment. |
| `ReadPayments.v1` | `GET /payments/account/{account-id}` | List the payments on an account. |
| `ReadPaymentEventsById.v1` | `GET /payments/{payment-id}` | Read a payment and its lifecycle events. |
| `CreateCreditBalanceRefund.v1` | `POST /refunds` | Send money back to the customer from a credit balance. |
| `CreateInboundPayment.v1` | `POST /payments/inbound` | Post a payment a third party initiated or confirmed. |
| `CreatePaymentIntent.v1` | `POST /payments/intent` | Register an intent that becomes a payment when the customer's bank confirms it. |

## Composite functions

| Function | Delegates to | What it's for |
| --- | --- | --- |
| `CreatePaymentInstallment.v1` | `POST /payment-installments` | A payment plus a future installment plan in one call. |
| `CreateBillpayTransactionFromAccountsReceivable.v1` | `POST /payments` | A future-dated payment originated by the Accounts Receivable platform. |

## Event handlers

Not every function answers a caller. Three are event-driven — they consume the asynchronous outcomes a payment depends on and record them (in the external-events tracker) so the owning workflow can move forward:

| Handler | Brings in |
| --- | --- |
| `MoneyMovementEventHandler.v1` | Money-movement events from the clearing rail (MR/M3) — returns and settlement. |
| `AccountsReceivableTransactionEventHandler.v1` | Accounts Receivable (GAR) posting events. |
| `OpentoBuyUpdatePaymentEventHandler.v1` | Open-To-Buy (AMP) update events — still being defined. |

The settlement and AR-posted events these record are what eventually close a payment out to `PAID` — the [Paid Events Processing](../../design/workflows/periodic.md) sweep needs both before it will call anything paid.

Adding a function? It follows the pattern above: a versioned contract, one delegation target, no business logic at the edge. Breaking changes ship as a new version (`CreatePayment.v3` exists because `.v2` couldn't stretch), and the old version keeps serving until its callers migrate.
