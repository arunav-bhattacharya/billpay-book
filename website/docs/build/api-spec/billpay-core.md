---
title: Billpay Core APIs
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>The REST surface behind the gateway. Every request lands on the <strong>Billpay Router</strong>, which reads the payment date, the instruction count, and the market's behaviors, then invokes the right workflow with the right stage implementations. The endpoint defines the contract, and the router decides what runs.</Lead>

## Endpoints → workflows

| Endpoint | Routes to |
| --- | --- |
| `POST /payments` | Create Immediate Payment, Create Payment with Multiple Instructions, or Create Schedule Payment, depending on the payment date and the instruction count. |
| `PUT /payments/{payment-id}` | Update Payment, which cancels the original scheduled payment and creates a replacement with the same confirmation number. |
| `DELETE /payments/{payment-id}` | Cancel Payment, for a `SCHEDULED` or `ACCEPTED` payment. |
| `POST /payments/returns` | Process Returned Payment, which hands representable returns to Process Representment. |
| `POST /payments/inbound` | Process Inbound Payment. |
| `POST /payments/intent` | Create Payment Intent. |
| `POST /refunds` | Create Balance Refund. |
| `POST /payment-installments` | Create Payment & Installments (composite). |
| `GET /payments/account/{account-id}` | Read the payments on an account. |
| `GET /payments/{payment-id}` | Read one payment and its lifecycle events. |

Every condition the router reads, the worker each workflow runs on, and the account-type fan-out into child workflows are in [Design → Routing](../../design/routing.md). [Payment Journeys](../../design/journeys/index.md) follows the same flows end to end.

## Idempotency at the boundary

Every mutating endpoint is idempotency-guarded, and the mechanism is worth knowing because you will see it in the data.

- **Create paths** do not check and then write. The write *is* the check. `PersistPendingPaymentActivity` inserts the idempotency record, the `trans_dtl` row, and the first `trans_lfcyc_event` row together. If the insert fails on the unique index, this is a repeat request, and the caller gets the **original payment** back, not an error and not a duplicate.
- **Mutate paths** (update, cancel, returns) run `IdempotencyCheckActivity`, which inserts only the idempotency record for that API. A duplicate insert means the request was already handled, and the previous response is returned.

Both paths rest on the same [unique-index guarantee](../database.md) in Oracle.

Field-level request and response schemas are defined as OpenAPI alongside the endpoint code. This page stays at the contract level on purpose.
