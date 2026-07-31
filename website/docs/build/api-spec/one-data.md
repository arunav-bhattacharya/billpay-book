---
title: One-Data Functions
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';
import ApiTable from '@site/src/components/ApiTable';

export const CORE = [
  {fn: 'CreatePayment.v3', method: 'POST', path: '/payments', purpose: 'Initiate a payment, either immediately or scheduled for a future date.'},
  {fn: 'UpdatePayment.v1', method: 'PUT', path: '/payments/{payment-id}', purpose: 'Update a scheduled payment (cancel-and-recreate under the hood).'},
  {fn: 'DeletePayment.v1', method: 'DELETE', path: '/payments/{payment-id}', purpose: 'Cancel a scheduled or accepted payment.'},
  {fn: 'ReadPayments.v1', method: 'GET', path: '/payments/account/{account-id}', purpose: 'List the payments on an account.'},
  {fn: 'ReadPaymentEventsById.v1', method: 'GET', path: '/payments/{payment-id}', purpose: 'Read a payment and its lifecycle events.'},
  {fn: 'CreateCreditBalanceRefund.v1', method: 'POST', path: '/refunds', purpose: 'Send money back to the customer from a credit balance.'},
  {fn: 'CreateInboundPayment.v1', method: 'POST', path: '/payments/inbound', purpose: 'Post a payment a third party initiated or confirmed.'},
  {fn: 'CreatePaymentIntent.v1', method: 'POST', path: '/payments/intent', purpose: "Register an intent that becomes a payment when the customer's bank confirms it."},
];

export const COMPOSITE = [
  {fn: 'CreatePaymentInstallment.v1', method: 'POST', path: '/payment-installments', purpose: 'A payment plus a future installment plan in one call.', tag: 'Composite'},
  {fn: 'CreateBillpayTransactionFromAccountsReceivable.v1', method: 'POST', path: '/payments', purpose: 'A future-dated payment originated by the Accounts Receivable platform.', tag: 'Composite'},
];

# One-Data Functions

<Lead>One-Data Functions are the platform's front door. They are versioned, stable contracts, so a channel integrates against <code>CreatePayment.v3</code> and keeps working while everything behind it evolves. Each function is thin: it validates the contract and delegates to one Billpay core REST API.</Lead>

This is the full set. Every function name links to its contract in the One-Data explorer.

## Core functions

<ApiTable rows={CORE} />

## Composite functions

<ApiTable rows={COMPOSITE} />

## Event handlers

Not every function answers a caller. Three are event-driven. They consume the asynchronous outcomes a payment depends on and record them in the external-events tracker, so the owning workflow can move forward.

| Handler | Brings in |
| --- | --- |
| `MoneyMovementEventHandler.v1` | Money-movement events from the clearing rail (MR/M3), covering returns and settlement. |
| `AccountsReceivableTransactionEventHandler.v1` | Accounts Receivable (GAR) posting events. |
| `OpentoBuyUpdatePaymentEventHandler.v1` | Open-To-Buy (AMP) update events. Still being defined. |

The settlement and AR-posted events these record are what eventually close a payment out to `PAID`. The [Paid Events Processing](../../design/component-model/workflows/periodic.md) sweep needs both before it will call anything paid.

A new function follows the pattern above: a versioned contract, one delegation target, no business logic at the edge. Breaking changes ship as a new version, which is why `CreatePayment.v3` exists at all, and the old version keeps serving until its callers migrate.
