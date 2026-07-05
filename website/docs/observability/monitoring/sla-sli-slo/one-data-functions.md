---
title: One-Data Functions SLAs
sidebar_label: One-Data Functions
---

import Lead from '@site/src/components/Lead';

# One-Data Functions SLAs

<Lead>The **public contracts** consumers integrate against. SLA targets here are tighter than the underlying APIs because this is the visible surface.</Lead>

For definitions of SLA / SLI / SLO and how to read each entry, see the
[overview page](./index.md).

## Create Payment

**One-Data Function** · `CreatePayment.v3` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 130 ms | 270 ms | 540 ms | 950 ms | 1.6 s |

**SLI:** caller-observed latency at the One-Data edge, including overhead from contract validation. **Error budget:** 0.05% / 30-day window.

## Update Payment

**One-Data Function** · `UpdatePayment.v1` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 170 ms | 340 ms | 700 ms | 1.2 s | 1.9 s |

**SLI:** end-to-end latency for cancel + recreate semantics handled by `UpdatePaymentWF`. **Error budget:** 0.05% / 30-day window.

## Delete Payment

**One-Data Function** · `DeletePayment.v1` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 110 ms | 220 ms | 450 ms | 850 ms | 1.4 s |

**SLI:** ack latency for `CancelPaymentWF` including eligibility checks. **Error budget:** 0.05% / 30-day window.

## Read Payments

**One-Data Function** · `ReadPayments.v1` — SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 50 ms | 100 ms | 210 ms | 420 ms | 750 ms |

**SLI:** account-scoped read latency including pagination. **Error budget:** 0.01% / 30-day window.

## Read Payment Events By Id

**One-Data Function** · `ReadPaymentEventsById.v1` — SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 40 ms | 85 ms | 180 ms | 360 ms | 650 ms |

**SLI:** latency for fetching a single payment + its lifecycle events. **Error budget:** 0.01% / 30-day window.

## Create Credit Balance Refund

**One-Data Function** · `CreateCreditBalanceRefund.v1` — SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 150 ms | 300 ms | 580 ms | 1 s | 1.7 s |

**SLI:** latency through `CreateBalanceRefundWF` up to `ACCEPTED`. **Error budget:** 0.05% / 30-day window.

## Create Payment Installment

**One-Data Function (composite)** · `CreatePaymentInstallment.v1` — SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 240 ms | 480 ms | 950 ms | 1.7 s | 2.5 s |

**SLI:** end-to-end latency for the composite — the child `CreateImmediatePaymentWF`, the installment plan, and optional autopay. **Error budget:** 0.1% / 30-day window.
