---
title: One-Data Functions
sidebar_label: One-Data Functions
---

import Lead from '@site/src/components/Lead';

# One-Data Functions

<Lead>One-Data Functions are the versioned, stable contracts Amex's channels call. They sit at the edge of the platform and delegate to the Billpay core REST APIs — a channel never calls Billpay's internals directly.</Lead>

## Core functions

| Function | Purpose |
| --- | --- |
| `CreatePayment.v3` | Initiate a payment — immediately, or scheduled for a future date. |
| `UpdatePayment.v1` | Update a scheduled payment. |
| `DeletePayment.v1` | Cancel a scheduled or accepted payment. |
| `ReadPayments.v1` | List the payments on an account. |
| `ReadPaymentEventsById.v1` | Read a payment's lifecycle events. |
| `CreateCreditBalanceRefund.v1` | Send money back to the customer from a credit balance. |
| `CreateInboundPayment.v1` | Post a third-party-initiated payment. |
| `CreatePaymentIntent.v1` | Register a payment intent. |

## Composite functions

| Function | Purpose |
| --- | --- |
| `CreatePaymentInstallment.v1` | A payment plus a future installment plan. |
| `CreateBillpayTransactionFromAccountsReceivable.v1` | A payment originated by the Accounts Receivable platform. |

## Event handlers

Event-driven functions bring asynchronous outcomes back into the platform, recording them so the right workflow can advance.

| Handler | Brings in |
| --- | --- |
| `MoneyMovementEventHandler.v1` | Money-movement events — returns and settlement. |
| `AccountsReceivableTransactionEventHandler.v1` | Accounts-Receivable posting events. |
| `OpentoBuyUpdatePaymentEventHandler.v1` | Open-To-Buy update events (still being defined). |

The [API Spec](./api-spec/one-data.md) covers the function-to-endpoint mapping; the [core APIs](./api-spec/billpay-core.md) show how each request reaches a workflow.
