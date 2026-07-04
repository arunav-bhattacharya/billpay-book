---
title: Billpay Core APIs
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>The REST surface behind the gateway. Each endpoint is received by the Billpay Router, which reads the request and the market's dimensions and invokes the right workflow. Request and response schemas come from the OpenAPI definitions and are not reproduced here.</Lead>

| Endpoint | Routes to |
| --- | --- |
| `POST /payments` | Create Immediate Payment (today, single) · Create Payment with Multiple Instructions (today, multiple) · Create Schedule Payment → Execute Scheduled Payment (future-dated) |
| `PUT /payments/{payment-id}` | Update Payment |
| `DELETE /payments/{payment-id}` | Cancel Payment |
| `POST /payments/returns` | Process Returned Payment → Process Representment |
| `POST /payments/inbound` | Process Inbound Payment |
| `POST /payments/intent` | Create Payment Intent |
| `POST /refunds` | Create Balance Refund |
| `POST /payment-installments` | Create Payment & Installments (composite) |
| `GET /payments/account/{account-id}` | Read the payments on an account |
| `GET /payments/{payment-id}` | Read a single payment |

A create request fans out once it's accepted — a consumer split runs one Execute Split Payment per leg; a corporate payment first runs Get Corporate Payment Allocations. The full branch logic, with the Online / Offline worker per step, is the [Billpay Router](../../architecture/components.md) in Architecture and the [Journeys → APIs](../../design/journeys/apis.md) map in Design.
