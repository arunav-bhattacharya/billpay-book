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

## Confirm Payment

**Billpay Core API** · `POST /payments/{payment-id}/confirm` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 120 ms | 250 ms | 500 ms | 900 ms | 1.5 s |

**SLI:** request-to-response latency for a confirm. It answers through an update to the payment's waiting workflow, so no workflow starts, and like a create it waits at most 2.5 seconds for a decision before it replies `PENDING`. Targets Proposed (2026-10-20). **Error budget:** 0.05% / 30-day window.

## Allocations Callback

**Billpay Core API** · `POST /payments/{payment-id}/allocations` · SLA availability: **99.95%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 50 ms | 110 ms | 230 ms | 450 ms | 800 ms |

**SLI:** time to the 202, once the batch is stored and its workflow has started. A 429 with `Retry-After` while the traffic class is over budget is pacing, not an error. Targets Proposed (2026-10-20). **Error budget:** 0.05% / 30-day window.

## Market Onboarding API Writes

**Billpay Core API** · `POST /market-onboarding/releases` · `.../sign-off` · `.../rollback` · `.../pause` · `.../resume` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 80 ms | 150 ms | 300 ms | 600 ms | 1 s |

**SLI:** time to the 202, once `MarketOnboardingWorkflow` has the call. Only the Market Onboarding UI calls these, a few times a day. While the Offline cluster is down they answer 503 with `Retry-After`, and that counts against availability. Targets Proposed (2026-10-20). **Error budget:** 0.1% / 30-day window.

## Market Onboarding API Reads

**Billpay Core API** · `GET /market-onboarding/releases/{market}/{account-type}/{version}` · `GET /market-onboarding/capabilities` · SLA availability: **99.9%**

| P50 | P90 | P99 | P99.9 | P99.99 |
| --- | --- | --- | --- | --- |
| 30 ms | 60 ms | 150 ms | 300 ms | 500 ms |

**SLI:** read latency for a release's status and step, and for the build's capability manifest, which the registries worked out when the app started. Targets Proposed (2026-10-20). **Error budget:** 0.1% / 30-day window.
