---
title: Billpay Core API SLAs
description: 'These sit one layer below the One-Data functions.'
sidebar_label: Billpay Core APIs
---

import Lead from '@site/src/components/Lead';

# Billpay Core API SLAs

<Lead>These sit one layer below the One-Data functions. Latency targets are slightly tighter because the API removes the function-edge overhead.</Lead>

For definitions of SLA, SLI and SLO, and how to read each entry, see the [overview page](./index.md).

Every write from a channel answers through Update-With-Start: the caller gets the payment's state back as soon as the decision is made. Returns, inbound payments and the requests Accounts Receivable (AR) raises don't reach these APIs at all. One-Data stores them, and their measure is the time to One-Data's 202 and then the backlog age ([Work nobody waits for](./index.md#work-nobody-waits-for)).

## Create Payment

**Billpay Core API** · `POST /payments` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 120 ms | 250 ms | 500 ms | 900 ms | 1.5 s |

**SLI:** request-to-response latency at the Billpay Core ingress, excluding client network. The API waits at most 2.5 seconds for a decision and then replies `PENDING`, so its answer reaches One-Data inside One-Data's own 3 seconds. **Error budget:** 0.05% / 30-day window.

## Update Payment

**Billpay Core API** · `PUT /payments/{payment-id}` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 160 ms | 320 ms | 650 ms | 1.1 s | 1.8 s |

**SLI:** the round trip through `UpdatePaymentWorkflow`, which cancels the scheduled payment and creates its replacement with the same confirmation number. Outside the cancellation window the answer is 409. **Error budget:** 0.05% / 30-day window.

## Cancel Payment

**Billpay Core API** · `DELETE /payments/{payment-id}` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 100 ms | 200 ms | 420 ms | 800 ms | 1.3 s |

**SLI:** the round trip through `CancelPaymentWorkflow` to `CANCELLED`. Outside the cancellation window the answer is 409. **Error budget:** 0.05% / 30-day window.

## Credit Balance Refund

**Billpay Core API** · `POST /refunds` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 140 ms | 280 ms | 550 ms | 950 ms | 1.6 s |

**SLI:** request-to-response latency for a refund from a channel, through `CreateBalanceRefundWorkflow` on the Online cluster until its result. Refunds AR raises take the other road: they wait in One-Data's inbox and run on the Offline cluster. **Error budget:** 0.05% / 30-day window.

## List Payments by Account

**Billpay Core API** · `GET /payments/account/{account-id}` · SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 45 ms | 95 ms | 200 ms | 400 ms | 700 ms |

**SLI:** read latency from Oracle. **Error budget:** 0.01% / 30-day window.

## Read Payment

**Billpay Core API** · `GET /payments/{payment-id}` · SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 35 ms | 80 ms | 170 ms | 350 ms | 600 ms |

**SLI:** read latency for one payment from Oracle, with its redirect link while it waits for bank confirmation. **Error budget:** 0.01% / 30-day window.

## Payment Installments

**Billpay Core API (composite)** · `POST /payment-installments` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 220 ms | 450 ms | 900 ms | 1.6 s | 2.4 s |

**SLI:** end-to-end latency at the core API, covering the child `CreateImmediatePaymentWorkflow`, the installment plan, and the optional Autopay update. **Error budget:** 0.1% / 30-day window.

## Not yet targeted

Two APIs have no targets yet:

- `POST /payments/{payment-id}/confirm`, which confirms a payment that waited for its customer. It answers through Update-With-Start like a create.
- `POST /payments/{payment-id}/allocations`, the allocations callback. It replies 202 once the batch is stored and its workflow has started, or 429 with `Retry-After` when its traffic class is over budget.
