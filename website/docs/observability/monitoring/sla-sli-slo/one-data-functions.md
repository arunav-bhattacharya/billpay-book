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

## Confirm Pending Payment

**One-Data Function** · `CreateConfirmPendingPayment.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 130 ms | 270 ms | 540 ms | 950 ms | 1.6 s |

**SLI:** caller-observed latency for a confirm, from a bank confirmation or a go-ahead, until its answer. If billpay-core doesn't answer within 3 seconds, One-Data holds the confirm for RTF and answers `PENDING`, the same ceiling a create has. Targets Proposed (2026-10-20). **Error budget:** 0.05% / 30-day window.

## Create Payment Allocations

**One-Data Function** · `CreatePaymentAllocations.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 60 ms | 120 ms | 250 ms | 500 ms | 900 ms |

**SLI:** time to the 202, which goes out once the batch is stored and its workflow has started. A 429 with `Retry-After` while the traffic class is over budget is pacing, not an error. Targets Proposed (2026-10-20). **Error budget:** 0.05% / 30-day window.

## Inbound Payment and AR Intake

**One-Data Functions** · `CreateInboundPayment.v1` · `CreateBillpayTransactionFromAccountsReceivable.v1` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 80 ms | 200 ms | 500 ms | 900 ms | 1.5 s |

**SLI:** time to the 202, once the request is stored in One-Data's inbox. Load-test run 6 holds the p99 under 500 ms for AR intake; the other cells are Proposed (2026-10-20). After the 202 the measure is how long a request waits for its dispatcher ([Work nobody waits for](./index.md#work-nobody-waits-for)). **Error budget:** 0.05% / 30-day window.

## Event Handlers

**One-Data Functions** · `CreateMoneyMovementEventHandler.v1` · `CreateAccountsReceivableTransactionEventHandler.v1` · `CreateOpentoBuyUpdatePaymentEventHandler.v1` · SLA availability: **99.99%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 30 ms | 70 ms | 150 ms | 300 ms | 600 ms |

**SLI:** time to the acknowledgement, which goes out only after the raw event and the payment's inbox row commit together. A sender that gets an error retries, so a failed acknowledgement delays an event but never loses it. Targets Proposed (2026-10-20). **Error budget:** 0.01% / 30-day window.

## Delete Pending Payment

**One-Data Function** · `DeletePendingPayment.v1` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 20 ms | 40 ms | 100 ms | 200 ms | 400 ms |

**SLI:** latency of the call billpay-core makes at the end of each create's workflow to remove the stored create and the account's pending entry. billpay-core retries until it lands, so a breach shows up as entries that stay in Redis longer. Targets Proposed (2026-10-20). **Error budget:** 0.1% / 30-day window.

## Read Inbox

**One-Data Functions** · `ReadPaidReadyPayments.v1` · `ReadStartRequests.v1` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 50 ms | 120 ms | 300 ms | 600 ms | 1 s |

**SLI:** latency for one batch of `READY` rows, up to 500 for the `PAID` drain or a dispatcher's tick for start requests. A miss only delays the next tick. Targets Proposed (2026-10-20). **Error budget:** 0.1% / 30-day window.

## Update Inbox

**One-Data Functions** · `UpdatePaidReadyPayments.v1` · `UpdateStartRequests.v1` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 40 ms | 100 ms | 250 ms | 500 ms | 900 ms |

**SLI:** latency for setting one batch of rows `DONE`, `UNMATCHED` or `REJECTED` in one transaction. Setting a status twice does no harm, so a retry is safe. Targets Proposed (2026-10-20). **Error budget:** 0.1% / 30-day window.

## Not Targeted

`UpdateUnmatchedPayments.v1` has no SLA. One-Data runs it on a cron schedule and nobody calls it, so the measure is the alert it raises for a row `UNMATCHED` for 48 hours.
