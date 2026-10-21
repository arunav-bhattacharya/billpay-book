---
title: Billpay Core APIs
description: "These are billpay-core's REST APIs, behind One-Data's functions, and every write lands on the Billpay Router first."
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>These are billpay-core's REST APIs, behind One-Data's functions, and every write lands on the Billpay Router first. The endpoint defines the contract. The Router admits the request, picks the workflow and starts it the way its journey needs.</Lead>

## Admission

The Router answers a write before any workflow starts when it can't take it. It checks billpay-core's in-memory copy of the onboarding config, so admission adds no call.

- 422 when the market, account type or API is not live in this environment. Senders don't retry a 422. A create One-Data held while billpay-core was slow, which RTF delivers after its market was taken out of service, is captured and declined instead, so the customer is told and the delete runs.
- 429 with `Retry-After` when an allocations callback arrives over its traffic class's budget. The allocations manager retries. No other API gets a 429.
- 409 when an update or cancel arrives for a payment that is no longer `SCHEDULED`, or after the cancellation window has closed. A corporate payment leaves `SCHEDULED` when its allocations are requested. A confirm gets 409 too once its payment's workflow no longer waits, such as when the payment was cancelled because its confirmation window closed, and so does a cancel of a `PENDING` payment that isn't waiting for a confirmation. A confirm repeated after its workflow has closed gets the payment's current state instead.
- 503 with `Retry-After` for an allocations callback or a Market Onboarding API request while the Offline cluster is down.

## Endpoints

| Endpoint | What it does | Start mode | Reply |
| --- | --- | --- | --- |
| `POST /payments` | Pays today or schedules for a future date. The Router picks the workflow from the date and the number of instructions. A payment that needs bank confirmation, or that One-Data sends with other pending payments' IDs for the customer's go-ahead in a market that has it turned on, runs as `CreatePaymentIntentWorkflow` and stops at `PENDING`; a request with several instructions, or a Pay & Plan request, that would need bank confirmation gets 422 | Update-With-Start | `PENDING`, `ACCEPTED`, `SCHEDULED` or `DECLINED`; `PENDING` with the redirect link when the customer must confirm at their bank, and the same reply, link included, on a repeated create; `DECLINED` if the provider gives no link. One-Data adds the pending payments when the payment waits for a go-ahead |
| `PUT /payments/{payment-id}` | Updates a `SCHEDULED` payment inside the cancellation window, by cancelling it and creating a replacement with the same confirmation number | Update-With-Start | The new payment's result; 409 outside the window |
| `DELETE /payments/{payment-id}` | Cancels a `SCHEDULED` payment inside the cancellation window, or a `PENDING` payment that waits for a confirmation when the customer says no | Update-With-Start; for a `PENDING` payment, an update to its waiting `CreatePaymentIntentWorkflow`, with the update ID `{paymentId}-no` | `CANCELLED`, again for a repeated cancel; 409 otherwise |
| `POST /payments/{payment-id}/confirm` | Confirms a `PENDING` payment that waits for the customer: once they have confirmed their bank details, or given the go-ahead for a payment made while another was pending. Then executes it, or for a scheduled payment, schedules it for its date | An update to the payment's waiting `CreatePaymentIntentWorkflow`, with the update ID `{paymentId}-confirm` | `ACCEPTED`, `SCHEDULED` for a scheduled payment's go-ahead, `DECLINED`, or `PENDING` if it isn't decided within 2.5 seconds. A repeated confirm gets the same answer, or the payment's current state once the workflow has closed; 409 for a cancelled payment |
| `POST /payments/{payment-id}/allocations` | Takes one numbered batch of allocations for a corporate payment, from the allocations manager | Stores the batch, then an async start of `ReceiveAllocationsWorkflow` | 202 |
| `POST /refunds` | Refunds a credit balance, from a channel | Update-With-Start | The refund's result |
| `GET /payments/account/{account-id}` | Lists the payments on an account | Reads Oracle | The payments |
| `GET /payments/{payment-id}` | Returns one payment | Reads Oracle | The payment; with its redirect link while it waits for bank confirmation |

`PENDING` in a reply means the payment is captured but not yet decided: the API waits at most 2.5 seconds for the decision, then replies `PENDING`, so its answer reaches One-Data inside One-Data's own 3 seconds. The caller learns the outcome from notifications, lifecycle events or `GET /payments/{payment-id}`. For a payment that needs bank confirmation, `PENDING` comes with the provider's redirect link: the customer confirms on the provider's site, and the caller then confirms the payment with the same ID. A caller that loses the link gets it again from a repeated create or from `GET /payments/{payment-id}`, while the payment waits. A payment held for a go-ahead comes back `PENDING` too, and One-Data adds the pending payments to the reply. [Stored creates and the pending check](./one-data.md#stored-creates-and-the-pending-check) has One-Data's side.

One composite API runs core workflows as children:

| Endpoint | What it does | Start mode |
| --- | --- | --- |
| `POST /payment-installments` | Pay & Plan: pays today and creates a plan of future installments | Update-With-Start; its children run on the Online cluster |

[Design → Routing](../../design/routing.md) has the workflow each request starts and the cluster it runs on, and [The Complete Picture](../../design/journeys/complete-picture.md) follows every endpoint through its stages to the calls they make. [One-Data Functions](./one-data.md) names the function in front of each endpoint.

## What never reaches these APIs

Payments and refunds that Accounts Receivable (AR) raises, returns and inbound payments never call billpay-core. One-Data stores each one in its inbox (a return arrives as an event, which an event handler stores), and a dispatcher pulls it at the governor's pace and starts its workflow through the Router. A burst of returns waits its turn there instead of competing with a customer who is paying today. AR learns the outcome of a request it sent from the `SCHEDULED` and `DECLINED` notifications and lifecycle events, or from `GET /payments/{payment-id}`.

Nothing passes a return straight to a representment either. Process Returned Payment commits `REPRESENTING` with a `REPRESENT` Work Tracker row, and the representment dispatcher starts Process Representment on the date.

## Idempotency

Every write is safe to send twice. `PaymentStore`, the only code that reaches Oracle, makes each write insert-if-absent or a conditional update on the current state, and the start modes make sure a repeated request finds the workflow it already started.

- A create is captured once. Capture inserts into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, all insert-if-absent, and a repeated request joins the existing workflow (conflict policy `USE_EXISTING`). A duplicate gets the existing payment back. A repeat that comes after the workflow has closed starts a new run under the default reuse policy: Capture finds the payment, and the run carries on only if the payment is still `PENDING` with nothing waiting on it, because the last run died before deciding. Otherwise it returns the payment as it stands, so no stage runs twice.
- Every create from a channel ends its workflow with a call to One-Data's delete API, `DeletePendingPayment.v1`, which clears the payment from One-Data's Redis. It retries until the call lands. `CreatePaymentIntentWorkflow` calls it twice: after its reply, saying the payment still waits, and at its end.
- An update or cancel is a guarded update on `SCHEDULED`. If a cancel changes no row and the payment is already `CANCELLED`, the API returns that result again; otherwise the answer is 409.
- A confirm is an update to the payment's waiting workflow, and Verify's commit is guarded on `PENDING`. A repeated confirm carries the same update ID and gets the same answer, or once the workflow has closed, gets the payment's current state from Oracle, so a retry after a lost reply never looks like a failure. A confirm the workflow turns away, because it already has an answer or no longer waits, gets 409.
- An allocations callback stores its batch in `allocation_batch` first, then starts `ReceiveAllocationsWorkflow` with the ID `{paymentId}-allocations-{batch}`, which comes from the request. A repeated batch finds the same workflow: a start that fails as already started counts as done, and reuse policy `REJECT_DUPLICATE` stops a second run after the first one closes. The callback's full contract, including its idempotency rules, is still to be agreed with the allocations manager.

## Market Onboarding API

Each environment's billpay-core also exposes the Market Onboarding API. Only the market-onboarding control plane, the Market Onboarding UI's backend, calls it, with its own service identity. The work runs in `MarketOnboardingWorkflow`, so every call but the two reads answers `202` as soon as the workflow has it.

The bodies are Proposed (2026-10-18), for the Market Onboarding UI team to confirm. E3 is production, the one environment that needs a change request (RFC). To keep the table readable, `{release}` stands for `/market-onboarding/releases/{market}/{account-type}/{version}` and `{live}` for `/market-onboarding/markets/{market}/{account-type}`.

| Call | Request | Response |
| --- | --- | --- |
| `POST /market-onboarding/releases` | `market`, `accountType`, `version`, `checksum`, `config` (the frozen profile as JSON), `author`, `approver` | `202` with the workflow ID and status `REQUESTED`; the same reply when the release is sent again |
| `GET {release}` | No body | The status (`REQUESTED`, `RUNNING`, `WAITING_FOR_SIGN_OFF`, `ACTIVE` or `FAILED`), the step the workflow is on, and for a failure, the step and the reason |
| `POST {release}/sign-off` | `signedOffBy`, `signedOffAt`, and in E3 the RFC number | `202`; `409` when the release isn't waiting for a sign-off |
| `POST {release}/rollback` | `requestedBy`, `reason` | `202`; the version before it becomes active again |
| `POST {live}/pause` and `POST {live}/resume` | `requestedBy`, `reason` | `202` |
| `GET /market-onboarding/capabilities` | No body | `buildVersion`, and `combinations`: one entry per combination the build can run, an account type with Y or N for each of the other four behaviors |

Sending a release is idempotent: one onboarding workflow per market, account type, version and environment. [Market Onboarding API](../../onboarding/market-onboarding-api.md) follows a release through it.
