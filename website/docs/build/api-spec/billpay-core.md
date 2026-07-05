---
title: Billpay Core APIs
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>The REST surface behind the gateway. Every request lands on the <strong>Billpay Router</strong>, which reads the payment date, the instruction count, and the market's dimensions, then invokes the right workflow with the right stage implementations. The endpoint is the contract; the router is the decision.</Lead>

## Endpoints → workflows

| Endpoint | Routes to |
| --- | --- |
| `POST /payments` | See the branch table below — the create path is where the routing logic earns its keep. |
| `PUT /payments/{payment-id}` | Update Payment — cancels the original scheduled payment and creates a replacement with the same confirmation number. |
| `DELETE /payments/{payment-id}` | Cancel Payment — for a `SCHEDULED` or `ACCEPTED` payment. |
| `POST /payments/returns` | Process Returned Payment, which hands representable returns to Process Representment. |
| `POST /payments/inbound` | Process Inbound Payment. |
| `POST /payments/intent` | Create Payment Intent. |
| `POST /refunds` | Create Balance Refund. |
| `POST /payment-installments` | Create Payment & Installments (composite). |
| `GET /payments/account/{account-id}` | Read the payments on an account. |
| `GET /payments/{payment-id}` | Read one payment and its lifecycle events. |

### How `POST /payments` branches

| Signal on the request | Workflow invoked |
| --- | --- |
| `payment-date` = today, single instruction | Create Immediate Payment *(Online)* |
| `payment-date` = today, multiple instructions | Create Payment with Multiple Instructions *(Online)* |
| `payment-date` = future | Create Schedule Payment *(Online)*, then Execute Scheduled Payment when the date arrives *(Offline)* |

Once a create is accepted, account type decides the fan-out: a consumer split runs one Execute Split Payment per leg, and a corporate payment first runs Get Corporate Payment Allocations for its breakdown, then an Execute Split Payment per allocation. The full picture — every trigger, condition, and child workflow with its worker — is the [Billpay Router table](../../architecture/components.md) in Architecture and the [API journeys map](../../design/journeys/apis.md) in Design.

## Idempotency at the boundary

Every mutating endpoint is idempotency-guarded, and the mechanism is worth knowing because you'll see it in the data:

- **Create paths** don't check-then-write — they *write to check*. `PersistPendingPaymentActivity` inserts the idempotency record, the `trans_dtl` row, and the first `trans_lfcyc_event` row together; if the insert fails on the unique index, this is a repeat request, and the caller gets the **original payment** back, not an error and not a duplicate.
- **Mutate paths** (update, cancel, returns) run `IdempotencyCheckActivity`, which inserts only the idempotency record for that API — a duplicate insert means "already handled", and the previous response is returned.

First write wins, enforced by the database constraint itself — the [Oracle page](../principles/tech-stack/database.md) explains why we lean on the unique index rather than an application-level check.

Field-level request and response schemas are defined as OpenAPI alongside the endpoint code — this page stays at the contract level deliberately.
