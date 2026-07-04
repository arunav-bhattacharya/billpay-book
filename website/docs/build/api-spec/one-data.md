---
title: One-Data Functions API
sidebar_label: One-Data
---

import Lead from '@site/src/components/Lead';

# One-Data Functions API

<Lead>Each One-Data Function maps to a Billpay core REST API. The functions are versioned contracts; the detailed request and response schemas come from the OpenAPI definitions and are not reproduced here.</Lead>

| Function | Core API |
| --- | --- |
| `CreatePayment.v3` | `POST /payments` |
| `UpdatePayment.v1` | `PUT /payments/{payment-id}` |
| `DeletePayment.v1` | `DELETE /payments/{payment-id}` |
| `ReadPayments.v1` | `GET /payments/account/{account-id}` |
| `ReadPaymentEventsById.v1` | `GET /payments/{payment-id}` |
| `CreateCreditBalanceRefund.v1` | `POST /refunds` |
| `CreateInboundPayment.v1` | `POST /payments/inbound` |
| `CreatePaymentIntent.v1` | `POST /payments/intent` |
| `CreatePaymentInstallment.v1` | `POST /payment-installments` |
| `MoneyMovementEventHandler.v1` | `POST /payments/returns` |

See [One-Data Functions](../one-data.md) for each function's purpose, and [Billpay Core APIs](./billpay-core.md) for the endpoint-to-workflow routing.
