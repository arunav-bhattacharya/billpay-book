---
title: Billpay Core APIs
description: "These are billpay-core's REST APIs, behind One-Data's functions, and every write lands on the Billpay Router first."
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>These are billpay-core's REST APIs, behind One-Data's functions, and every write lands on the Billpay Router first. The endpoint defines the contract. The Router admits the request, picks the workflow and starts it the way its journey needs.</Lead>

## Admission

The Router answers a write before any workflow starts when it can't take it:

- 422 when the market, account type or API is not live in this environment. Senders don't retry a 422.
- 429 with `Retry-After` when an allocations callback arrives over its traffic class's budget. The allocations manager retries. No other API gets a 429.
- 409 when an update or cancel arrives for a payment that is no longer `SCHEDULED`, or after the cancellation window has closed. A corporate payment leaves `SCHEDULED` when its allocations are requested. A confirm gets 409 too when its payment has been cancelled, such as one whose confirmation window closed. A confirm repeated after its workflow has closed gets the payment's current state instead.
- 503 with `Retry-After` for an allocations callback or a provisioning request while the Offline cluster is down.

## Endpoints

| Endpoint | What it does | Start mode | Reply |
| --- | --- | --- | --- |
| `POST /payments` | Pays today or schedules for a future date. The Router picks the workflow from the date and the number of instructions. A payment that needs bank confirmation stops at `PENDING`; a request with several instructions that would need it gets 422 | Update-With-Start | `PENDING`, `ACCEPTED`, `SCHEDULED` or `DECLINED`; `PENDING` with the redirect link when the customer must confirm at their bank |
| `PUT /payments/{payment-id}` | Updates a `SCHEDULED` payment inside the cancellation window, by cancelling it and creating a replacement with the same confirmation number | Update-With-Start | The new payment's result; 409 outside the window |
| `DELETE /payments/{payment-id}` | Cancels a `SCHEDULED` payment inside the cancellation window | Update-With-Start | `CANCELLED`, again for a repeated cancel; 409 otherwise |
| `POST /payments/{payment-id}/confirm` | Confirms a `PENDING` payment once the customer has confirmed their bank details, then executes it | Update-With-Start | `ACCEPTED` or `DECLINED`. A repeated confirm gets the same answer, or the payment's current state once the workflow has closed; 409 for a cancelled payment |
| `POST /payments/{payment-id}/allocations` | Takes one numbered batch of allocations for a corporate payment, from the allocations manager | Stores the batch, then an async start of `ReceiveAllocationsWorkflow` | 202 |
| `POST /refunds` | Refunds a credit balance, from a channel | Update-With-Start | The refund's result |
| `GET /payments/account/{account-id}` | Lists the payments on an account | Reads Oracle | The payments |
| `GET /payments/{payment-id}` | Returns one payment | Reads Oracle | The payment |

`PENDING` in a reply means the payment is captured but not yet decided: the API waits at most 3 seconds for the decision, then replies `PENDING`. The caller learns the outcome from notifications, lifecycle events or `GET /payments/{payment-id}`. For a payment that needs bank confirmation, `PENDING` comes with the provider's redirect link: the customer confirms on the provider's site, and the caller then confirms the payment with the same ID.

One composite API runs core workflows as children:

| Endpoint | What it does | Start mode |
| --- | --- | --- |
| `POST /payment-installments` | Pay & Plan: pays today and creates a plan of future installments | Update-With-Start; its children run on the Online cluster |

[Design → Routing](../../design/routing.md) has the workflow each request starts and the cluster it runs on, and [The Complete Picture](../../design/complete-picture.md) follows every endpoint through its stages to the calls they make. [One-Data Functions](./one-data.md) names the function in front of each endpoint.

## What never reaches these APIs

Payments and refunds that Accounts Receivable (AR) raises, returns and inbound payments never call billpay-core. One-Data stores each one in its inbox (a return arrives as an event, which an event handler stores), and a dispatcher pulls it at the governor's pace and starts its workflow through the Router. A burst of returns waits its turn there instead of competing with a customer who is paying today. AR learns the outcome of a request it sent from the `SCHEDULED` and `DECLINED` notifications and lifecycle events, or from `GET /payments/{payment-id}`.

Nothing passes a return straight to a representment either. Process Returned Payment commits `REPRESENTING` with a `REPRESENT` Work Tracker row, and the representment dispatcher starts Process Representment on the date.

## Idempotency

Every write is safe to send twice. `PaymentStore`, the only code that reaches Oracle, makes each write insert-if-absent or a conditional update on the current state, and the start modes make sure a repeated request finds the workflow it already started.

- A create is captured once. Capture inserts into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, all insert-if-absent, and a repeated request joins the existing workflow (conflict policy `USE_EXISTING`). A duplicate gets the existing payment back.
- An update or cancel is a guarded update on `SCHEDULED`. If a cancel changes no row and the payment is already `CANCELLED`, the API returns that result again; otherwise the answer is 409.
- A confirm is a guarded update on `PENDING`. A repeated confirm joins the running workflow, or once that has closed, gets the payment's current state from Oracle, so a retry after a lost reply never looks like a failure. A confirm for a cancelled payment gets 409.
- An allocations callback stores its batch in `allocation_batch` first, then starts `ReceiveAllocationsWorkflow` with the ID `{paymentId}-allocations-{batch}`, which comes from the request. A repeated batch finds the same workflow: a start that fails as already started counts as done, and reuse policy `REJECT_DUPLICATE` stops a second run after the first one closes. The callback's full contract, including its idempotency rules, is still to be agreed with the allocations manager.

## Provisioning API

Each environment's billpay-core also exposes a provisioning API. Only the market-onboarding control plane (billpay-ui's backend) calls it, with its own service identity.

| Path | What it does |
| --- | --- |
| `/provisioning/releases` | Takes a frozen market release, reports its provisioning progress, records a sign-off and rolls a release back |
| `/provisioning/markets/{market}/{account-type}/pause` | Pauses a live market's dispatchers |
| `/provisioning/markets/{market}/{account-type}/resume` | Resumes them |
| `GET /provisioning/capabilities` | Returns the deployed build's capability manifest: every behavior combination the build can run |

Sending a release is idempotent: one provisioning workflow per market, account type, version and environment. [Market Onboarding → Provisioning](../../onboarding/provisioning.md) follows a release through it.
