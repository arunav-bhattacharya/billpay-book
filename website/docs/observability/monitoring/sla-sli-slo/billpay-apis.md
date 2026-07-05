---
title: Billpay Core API SLAs
sidebar_label: Billpay Core APIs
---

import Lead from '@site/src/components/Lead';

# Billpay Core API SLAs

<Lead>These sit one layer below the One-Data functions. Latency targets are slightly tighter because the API removes the function-edge overhead.</Lead>

For definitions of SLA / SLI / SLO and how to read each entry, see the
[overview page](./index.md).

## Create Payment

**Billpay Core API** · `POST /payments` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 120 ms | 250 ms | 500 ms | 900 ms | 1.5 s |

**SLI:** request-to-response latency at the Billpay Core ingress, excluding client network. **Error budget:** 0.05% / 30-day window.

## Update Payment

**Billpay Core API** · `PUT /payments/{payment-id}` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 160 ms | 320 ms | 650 ms | 1.1 s | 1.8 s |

**SLI:** total time for the `UpdatePaymentWF` round-trip (cancel + recreate + mapping). **Error budget:** 0.05% / 30-day window.

## Cancel Payment

**Billpay Core API** · `DELETE /payments/{payment-id}` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 100 ms | 200 ms | 420 ms | 800 ms | 1.3 s |

**SLI:** `CancelPaymentWF` round-trip including external eligibility checks. **Error budget:** 0.05% / 30-day window.

## Record Return

**Billpay Core API** · `POST /payments/returns` — SLA availability: **99.9%** (async)

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 80 ms | 180 ms | 380 ms | 700 ms | 1.2 s |

**SLI:** handler ack latency — measured from event receipt to workflow enqueue. `ProcessReturnedPaymentWF` runs asynchronously after this. **Error budget:** 0.1% / 30-day window.

## Inbound Payment

**Billpay Core API** · `POST /payments/inbound` — SLA availability: **99.9%** (async)

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 90 ms | 200 ms | 400 ms | 750 ms | 1.3 s |

**SLI:** ack latency to the upstream third-party sender. Full posting completes asynchronously via `ProcessInboundPaymentWF`. **Error budget:** 0.1% / 30-day window.

## Credit Balance Refund

**Billpay Core API** · `POST /refunds` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 140 ms | 280 ms | 550 ms | 950 ms | 1.6 s |

**SLI:** request-to-response latency for `CreateBalanceRefundWF` entry through `ACCEPTED`. **Error budget:** 0.05% / 30-day window.

## List Payments by Account

**Billpay Core API** · `GET /payments/account/{account-id}` — SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 45 ms | 95 ms | 200 ms | 400 ms | 700 ms |

**SLI:** read latency from primary store; cached reads should be substantially faster. **Error budget:** 0.01% / 30-day window.

## Read Payment

**Billpay Core API** · `GET /payments/{payment-id}` — SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 35 ms | 80 ms | 170 ms | 350 ms | 600 ms |

**SLI:** read latency for a single payment + its lifecycle events. **Error budget:** 0.01% / 30-day window.

## Payment Installments

**Billpay Core API (composite)** · `POST /payment-installments` — SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 220 ms | 450 ms | 900 ms | 1.6 s | 2.4 s |

**SLI:** end-to-end latency for the composite — the child `CreateImmediatePaymentWF`, the installment plan, and optional autopay. **Error budget:** 0.1% / 30-day window.
