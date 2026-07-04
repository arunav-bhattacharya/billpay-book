---
id: billpay-core
title: Billpay Core APIs
sidebar_position: 2
---

# Billpay Core APIs

These are the REST endpoints owned by the Billpay service. Each request flows
through the **Billpay Router**, which mints a `workflow-key` and invokes the
appropriate Temporal workflow.

:::note[Source of truth]
This page summarises the public Billpay Core REST API. The **authoritative reference will be rendered directly from the OpenAPI / Swagger specification embedded in the Billpay-core source code** — once the swagger-rendering build step is wired in, this page will be replaced (or augmented) by an auto-generated reference and a link to the live Swagger UI. Until then, treat the table below as the canonical map from endpoints to workflows.
:::

## Core endpoints

### `POST /payments`
Create a payment. The router branches on three signals:

| Signal | Workflow chosen |
| --- | --- |
| `payment-date = today`, single instruction | [`#CreateImmediatePaymentWF`](../../design/workflows/core.md#1-createimmediatepaymentwf) (realtime) |
| `payment-date = today`, multiple instructions | `#CreatePaymentWithMultipleInstructionsWF` (realtime) — see [Composite](../../design/workflows/composite.md) |
| `payment-date = future` | [`#CreateSchedulePaymentWF`](../../design/workflows/core.md#2-createschedulepaymentwf) (realtime), then [`#ExecuteScheduledPaymentWF`](../../design/workflows/core.md#3-executescheduledpaymentwf) when the schedule fires |

For **corporate** accounts in any of the above, the workflow additionally
triggers [`#GetCorporatePaymentAllocationsWF`](../../design/workflows/core.md#9-getcorporatepaymentallocationswf)
to fetch the split breakdown from GPA.

### `PUT /payments/{payment-id}`
Update a scheduled payment. Internally:

1. Cancel the existing payment ([`#CancelPaymentWF`](../../design/workflows/core.md#5-cancelpaymentwf))
2. Create a fresh scheduled payment ([`#CreateSchedulePaymentWF`](../../design/workflows/core.md#2-createschedulepaymentwf))
3. Map old → new via `MapNewPaymentIdToPreviousIdService`

See [`#UpdatePaymentWF`](../../design/workflows/core.md#6-updatepaymentwf).

### `DELETE /payments/{payment-id}`
Cancels the payment if it is in `SCHEDULED` or `ACCEPTED`. Routes to
[`#CancelPaymentWF`](../../design/workflows/core.md#5-cancelpaymentwf).

### `POST /payments/returns`
Records a return — fired by the **Money Movement Event Handler** when a
return event is received. Routes to
[`#ProcessReturnedPaymentWF`](../../design/workflows/core.md#7-processreturnedpaymentwf).

### `POST /payments/inbound`
Posts an inbound payment from upstream (Batch Gateway). Routes to
[`#ProcessInboundPaymentWF`](../../design/workflows/core.md#10-processinboundpaymentwf).

### `POST /refunds`
Creates a credit-balance refund. Routes to
[`#CreateBalanceRefundWF`](../../design/workflows/core.md#11-createbalancerefundwf).

### `GET /payments/account/{account-id}`
Read all payments for an account.

### `GET /payments/{payment-id}`
Read a single payment **and** its lifecycle events.

## Composite

### `POST /paymentInstallments`
Composite endpoint. Combines:

1. [`#CreateImmediatePaymentWF`](../../design/workflows/core.md#1-createimmediatepaymentwf)
2. A call to the **Installments API**
3. An optional **Update Autopay** call

See [Composite workflows](../../design/workflows/composite.md) for the orchestration
detail.

## Idempotency

Every Core API call passes through `IdempotencyService`. The service variant is
resolved by **API identifier**:

- **Create-payment APIs** (`POST /payments`, `POST /payments/inbound`,
  `POST /refunds`) — first-writes to `idempotency_checker`, `trans_dtl`, and
  `trans_lfcyc_event`; duplicates are rejected.
- **Mutate-payment APIs** (`PUT /payments/{id}`, `DELETE /payments/{id}`,
  `POST /payments/returns`) — writes only to `idempotency_checker` for the
  corresponding API.

See [Payment Services](../../design/services.md#idempotency) for the full
contract.
