---
title: One-Data Functions SLAs
description: 'The public contracts consumers integrate against.'
sidebar_label: One-Data Functions
---

import Lead from '@site/src/components/Lead';

# One-Data Functions SLAs

<Lead>The public contracts consumers integrate against. SLA targets here are tighter than the underlying APIs because this is the visible surface.</Lead>

For definitions of SLA, SLI and SLO, and how to read each entry, see the [overview page](./index.md).

## Create Payment

**One-Data Function** · `CreatePayment.v3` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 130 ms | 270 ms | 540 ms | 950 ms | 1.6 s |

**SLI:** caller-observed latency at the One-Data edge, including the contract validation and the pending check in Redis. If billpay-core doesn't answer within 3 seconds, One-Data holds the create for RTF and answers `PENDING`, so a caller's wait has a ceiling even when the core is slow. **Error budget:** 0.05% / 30-day window.

## Update Payment

**One-Data Function** · `UpdatePayment.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 170 ms | 340 ms | 700 ms | 1.2 s | 1.9 s |

**SLI:** end-to-end latency for the cancel and re-create that `UpdatePaymentWorkflow` runs. Outside the cancellation window the answer is 409. **Error budget:** 0.05% / 30-day window.

## Delete Payment

**One-Data Function** · `DeletePayment.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 110 ms | 220 ms | 450 ms | 850 ms | 1.4 s |

**SLI:** the round trip to `CANCELLED` through `CancelPaymentWorkflow`, or 409 outside the cancellation window. **Error budget:** 0.05% / 30-day window.

## Read Payments

**One-Data Function** · `ReadPayments.v1` · SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 50 ms | 100 ms | 210 ms | 420 ms | 750 ms |

**SLI:** account-scoped read latency. The function reads Redis and billpay-core together and removes duplicates, so a payment shows from the moment it is made. **Error budget:** 0.01% / 30-day window.

## Read Payment Events By Id

**One-Data Function** · `ReadPaymentEventsById.v1` · SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 40 ms | 85 ms | 180 ms | 360 ms | 650 ms |

**SLI:** latency for fetching one payment and the lifecycle states it has been through. **Error budget:** 0.01% / 30-day window.

## Create Credit Balance Refund

**One-Data Function** · `CreateCreditBalanceRefund.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 150 ms | 300 ms | 580 ms | 1 s | 1.7 s |

**SLI:** latency through `CreateBalanceRefundWorkflow` until the refund's result. **Error budget:** 0.05% / 30-day window.

## Create Payment Installment

**One-Data Function (composite)** · `CreatePaymentInstallment.v1` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 240 ms | 480 ms | 950 ms | 1.7 s | 2.5 s |

**SLI:** end-to-end latency at the function edge, covering the child `CreateImmediatePaymentWorkflow`, the installment plan, and the optional Autopay update. **Error budget:** 0.1% / 30-day window.

## Functions that store and reply 202

`CreateInboundPayment.v1` and `CreateBillpayTransactionFromAccountsReceivable.v1` store the request in One-Data's inbox and reply 202. They have no latency targets yet. Load-test run 6 holds One-Data to a p99 under 500 ms for storing AR intake, and after the 202 the measure is how long a request waits for its dispatcher ([Work nobody waits for](./index.md#work-nobody-waits-for)).
