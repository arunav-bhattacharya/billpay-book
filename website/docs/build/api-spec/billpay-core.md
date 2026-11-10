---
title: Billpay Core APIs
description: "These are the REST APIs of Billpay's two apps, behind One-Data's functions, and every write lands on the Billpay Router first."
sidebar_label: Billpay Core
---

import Lead from '@site/src/components/Lead';

# Billpay Core APIs

<Lead>These are the REST APIs of Billpay's two apps, behind One-Data's functions, and every write lands on the Billpay Router first. The endpoint defines the contract. The Router admits the request, picks the workflow and starts it the way its journey needs.</Lead>

## Admission

The Router answers a write before any workflow starts when it can't take it. It checks the copy of the onboarding config each app caches in its JVM, so admission adds no call.

On every `/payments` call, the create, the update, the cancel and the confirm, One-Data passes the card account's market and account type, which it looks up with `ReadCustomerAccountInfo.v1`; billpay-online makes no lookup of its own. A create also carries each instruction's instrument type and its own payment ID, and a create that RTF delivers carries an async flag that One-Data's direct call never does (agreed 2026-11-07). The wire names of these fields come with the API contracts and are placeholders until then. The 3D Secure callback and the allocations callback carry no market, so they skip the profile check.

- 422 when the market, account type or API is not live in this environment. Senders don't retry a 422. A create One-Data held while billpay-online was slow, which RTF delivers with its async flag after its market was taken out of service, is captured and declined instead, so the customer is told and the delete runs. Its decline code is the placeholder `MARKET_OUT_OF_SERVICE` (Proposed, 2026-11-07).
- 422 too when a request asks for what its way to pay can't do: a future-dated create that pays by Pay with Bank Transfer, debit card, Plaid or MR Points (Proposed for MR Points); a debit card with several instructions, MR Points, Pay & Plan or a corporate payment; bank confirmation with several instructions, Pay & Plan or a corporate payment; and a payment that waits for its customer when its release has no confirmation or authentication window (Proposed).
- 422 with `NOT_ONBOARDED` for a scheduled create, an update or a cancel in a market whose release has no time zone (Proposed, 2026-11-07).
- 429 with `Retry-After` when an allocations callback arrives over its traffic class's budget, `ALLOCATION_CALLBACK` (Proposed). The allocations manager retries. No other API gets a 429.
- 409 when an update or cancel arrives for a payment that is no longer `SCHEDULED`, or after the cancellation window has closed. A corporate payment leaves `SCHEDULED` when its allocations are requested. A confirm gets 409 too for a payment the customer said no to, and so does a cancel of a `PENDING` payment that isn't waiting for a confirmation. Any other confirm that comes after the payment was decided, by the other source's confirm, M3's notice or the end of the wait, or after its workflow has closed, gets the payment's current state instead. Each 409 carries one of the codes `TOO_LATE`, `NOT_ELIGIBLE`, `NOT_WAITING` or `CANCELLED` (Proposed, 2026-11-07).
- 503 with `Retry-After` for an allocations callback or a Market Onboarding API request while the Offline cluster is down. For the callback, Proposed (2026-11-08): `Retry-After: 30` when billpay-offline's Offline health check is down, or the start fails as unavailable or past the 2.5 s; the batch is stored first in every case.
- 400 with `INVALID_REQUEST` for a request that fails validation, and for an allocations callback whose body can't be read (Proposed, 2026-11-08).
- 404 for an update, a cancel, a confirm, a 3D Secure callback or M3's settled notice on a payment billpay-online doesn't have (Proposed).

## Endpoints

billpay-online serves every endpoint here except the allocations callback, which billpay-offline serves, as it does the Market Onboarding API below. Each app serves the APIs whose work runs on its own cluster.

| Endpoint | What it does | Start mode | Reply |
| --- | --- | --- | --- |
| `POST /payments` | Pays today or schedules for a future date. A create from a channel carries the chosen payment option ID, which Verify validates through `ReadPaymentOptionByIdentifier.v1`. The Router picks the workflow from the date and the number of instructions. A payment that needs bank confirmation, or that pays by debit card, runs as `CreatePaymentIntentWorkflow` and stops at `PENDING`; a request with several instructions, or a Pay & Plan request, that would need bank confirmation gets 422, and so does a debit card create that is future-dated, has several instructions or carries MR Points, a corporate create that pays by debit card or needs bank confirmation, and a Pay & Plan request that pays by debit card | Update-With-Start | `PENDING`, `ACCEPTED`, `SCHEDULED` or `DECLINED`; `PENDING` with the redirect link when the customer must confirm at their bank, or with the 3D Secure challenge link (or none, Proposed) for a debit card, and the same reply, link included, on a repeated create; `DECLINED` if Amex Pay with Bank Transfer gives no link, or the card provider no answer (Proposed). A create on an account that already has a payment in `PENDING` never gets here: One-Data declines it |
| `PUT /payments/{payment-id}` | Updates a `SCHEDULED` payment inside the cancellation window, by cancelling it and creating a replacement with the same confirmation number. The replacement comes as a create's body, future-dated only, with its new ID in the payment-IDs header (Proposed, 2026-11-07) | Update-With-Start | The new payment's result, or 202 if it isn't decided within 2.5 seconds (Proposed); 409 outside the window |
| `DELETE /payments/{payment-id}` | Cancels a `SCHEDULED` payment inside the cancellation window, or a `PENDING` payment that waits for a confirmation when the customer says no. It reads the payment's status first to tell the two apart (Proposed, 2026-11-07) | Update-With-Start; for a `PENDING` payment, an update to its waiting `CreatePaymentIntentWorkflow`, with the update ID `{paymentId}-no` | `CANCELLED`, again for a repeated cancel; 202 if it isn't decided within 2.5 seconds (Proposed); 409 otherwise |
| `POST /payments/{payment-id}/confirm` | The channel's confirm for a `PENDING` payment that waits for its bank. It carries the bank's answer, and the payment is `ACCEPTED` or `DECLINED` on it | An update to the payment's waiting `CreatePaymentIntentWorkflow`, with the update ID `{paymentId}-confirm` | `ACCEPTED`, `DECLINED`, or `PENDING` if it isn't decided within 2.5 seconds. A second confirm, from either source, gets the same answer, and a confirm after the payment was decided another way, or after the workflow closed, gets its current state; 409 for a payment the customer said no to |
| `POST /payments/{payment-id}/bank-confirmation` | Amex Pay with Bank Transfer's own confirm, with the bank's answer. Amex Pay with Bank Transfer, the PISP (Payment Initiation Service Provider) interface, calls it directly, not through One-Data, with mutual TLS (the path and mutual TLS are Proposed). Billpay acts on whichever confirm comes first | The same update as the channel's confirm, ID `{paymentId}-confirm`, so the second attaches to the first (Proposed) | As the channel's confirm |
| `POST /payments/{payment-id}/settlement` | M3's notice that the bank has settled a Pay with Bank Transfer payment in real time: the bank tells Amex, and M3 intercepts the message and calls billpay-online directly (the path is Proposed). It lets Execute and Fulfil run, and accepts a payment that has had no confirm | A signal, `settled`, to the payment's waiting `CreatePaymentIntentWorkflow` | 202 (Proposed); 404 for a payment billpay-online doesn't have. For a payment that was already `DECLINED` or `CANCELLED`, the exception list and an alert, for now (open) |
| `POST /payments/{payment-id}/authentication` | The 3D Secure callback. The market's card provider calls it directly, not through One-Data, once the customer's debit card is authenticated or authentication has failed. Verify then authorizes the payment, which debits the customer's account, or the card's bank declines it. The provider and billpay-online authenticate each other with mutual TLS (the path and mutual TLS are Proposed) | An update to the payment's waiting `CreatePaymentIntentWorkflow`, with the update ID `{paymentId}-authentication` | `ACCEPTED` or `DECLINED` once the authorization decides; a repeated callback gets the same answer; 409 once the workflow no longer waits |
| `POST /payments/{payment-id}/allocations` | Takes one numbered batch of allocations for a corporate payment, from the allocations manager | Stores the batch, then an async start of `ReceiveAllocationsWorkflow` | 202 |
| `POST /refunds` | Refunds a credit balance, from a channel | Update-With-Start | The refund's result. Until refunds are defined, 501 with `NOT_DEFINED` and the refund's ID in the payment-IDs header (Proposed, 2026-11-07) |
| `GET /payments/account/{account-id}` | Lists the payments on an account | Reads Oracle | The payments |
| `GET /payments/{payment-id}` | Returns one payment and its lifecycle events; `ReadPaymentEventsById.v1` calls it | Reads Oracle | The payment and its lifecycle events; with its redirect or challenge link while it waits for bank confirmation or 3D Secure |
| `GET /instruments/account/{account-id}?source={source}&journeyContext={journeyContext}` | Behind `ReadBillpayInstruments.v1`: the instruments the customer can pay from. Two mandatory filters: the source, `EnrolledInstruments`, `DebitCard` or `PayWithBankTransfer`, and the journey context, `ONE_TIME_DIRECT_DEBIT` or `RECURRING_DIRECT_DEBIT` (the path is Proposed) | Calls `ReadInstruments` for enrolled instruments, or `ReadBanksForRealtimePayments.v1` for a debit card or Pay with Bank Transfer, then filters the list by the market's rules and, for enrolled instruments, by the statuses `enrolledInstrumentStatuses` gives the context. No workflow | The list the payment page may offer; 400 for a missing filter, or a recurring direct debit from any source but enrolled instruments; 503 if a read fails, 422 for a market that isn't live (Proposed) |

A create's 200 reply, through `CreatePayment.v3`, carries a `payments` array, one entry per instruction, each with its `status`, its `identifier` (the payment ID) and its `enrollmentIdentifier` (the instrument's enrollment ID), and the request's `confirmationCode`:

```json
{
  "payments": [
    { "status": "ACCEPTED", "identifier": "01JVTBBGZQ1HEM0W7NRMM6MSQ1", "enrollmentIdentifier": "ae21fbc5-88df-44fe-8ce1-c422f273f06" },
    { "status": "ACCEPTED", "identifier": "01JVTBBGZQ1HEM0W7NRMM6MSQ2", "enrollmentIdentifier": "be21fbc5-88df-44fe-8ce1-c422f273f06" }
  ],
  "confirmationCode": "W1642926062"
}
```

A decline uses the same shape, and its exact fields come later. A `PENDING` entry that waits for bank confirmation or 3D Secure carries its link in an optional field, absent everywhere else (its name, `confirmationUrl`, is Proposed). One-Data sends one payment ID and one idempotency key for each instruction, so a create with several instructions arrives with all of them (agreed 2026-11-07). Its composite makes every decision itself, so the reply carries each instruction's decision, or `PENDING` for one not decided within 2.5 seconds (agreed 2026-11-07).

`PENDING` in a reply means the payment is captured but not yet decided: the API waits at most 2.5 seconds for the decision, then replies `PENDING`, so its answer reaches One-Data inside One-Data's own 3 seconds. The caller learns the outcome from notifications, lifecycle events or `GET /payments/{payment-id}`. For a payment that needs bank confirmation, `PENDING` comes with Amex Pay with Bank Transfer's redirect link: the customer confirms the payment at their bank, and the caller then confirms it with the same ID, unless Amex Pay with Bank Transfer's own confirm got there first. A caller that loses the link gets it again from a repeated create or from `GET /payments/{payment-id}`, while the payment waits. A debit card payment comes back `PENDING` with the 3D Secure challenge link, or with none when the card's bank needs no challenge; the card provider's callback, not the channel, then brings the decision. billpay-online knows the callback comes from the card provider because the two authenticate each other with mutual TLS: each side presents a certificate the other trusts (Proposed). Amex Pay with Bank Transfer's confirm and M3's settled notice come straight to billpay-online the same way. [Stored creates and the pending check](./one-data.md#stored-creates-and-the-pending-check) has One-Data's side.

One composite API makes the decision itself and hands Execute and Fulfil to a child:

| Endpoint | What it does | Start mode |
| --- | --- | --- |
| `POST /payment-installments` | Pay & Plan: pays today and creates a plan of future installments | Update-With-Start, as `{paymentId}-plan`. The composite replies once the decision, the plan and the Autopay update are in, and its child, `CreateImmediatePaymentWorkflow` started with the decision, runs Execute and Fulfil on the Online cluster (agreed 2026-11-07) |

[Design → Routing](../../design/routing.md) has the workflow each request starts and the cluster it runs on, and [The Complete Picture](../../design/journeys/complete-picture.md) follows every endpoint through its stages to the calls they make. [One-Data Functions](./one-data.md) names the function in front of each endpoint.

## What never reaches these APIs

Payments and refunds that Accounts Receivable (AR) raises, returns and inbound payments never call either app. One-Data stores each one in its inbox (a return arrives as an event, which an event handler stores), and a dispatcher pulls it at the governor's pace and starts its workflow through the Router. A burst of returns waits its turn there instead of competing with a customer who is paying today. AR learns the outcome of a request it sent from the `SCHEDULED` and `DECLINED` notifications and lifecycle events, or from `GET /payments/{payment-id}`.

Nothing passes a return straight to a representment either. Process Returned Payment commits `REPRESENTING` with a `REPRESENT` Work Tracker row, and the representment dispatcher starts Process Representment on the date.

## Idempotency

Every write is safe to send twice. Billpay's stores, the only code that reaches Oracle, make each write insert-if-absent or a conditional update on the current state, and the start modes make sure a repeated request finds the workflow it already started.

- A create is captured once. Capture inserts into `trans_dtl`, `trans_lfcyc_event` and the idempotency table, all insert-if-absent, and a repeated request joins the existing workflow (conflict policy `USE_EXISTING`). A duplicate gets the existing payment back. In a create with several instructions, each instruction is its own capture, under the idempotency key One-Data sends for that instruction (agreed 2026-11-07). A repeat that comes after the workflow has closed starts a new run under the default reuse policy: Capture finds the payment, and the run carries on only if the payment is still `PENDING` with nothing waiting on it, because the last run died before deciding. Otherwise it returns the payment as it stands, so no stage runs twice.
- As soon as a create's payment is decided, its workflow calls One-Data's delete API, `DeletePendingPayment.v1`, after the caller's reply. Every create workflow makes the call, in either app. It clears the payment from One-Data's Redis, so the account can take its next payment. It retries until the call lands. `CreatePaymentIntentWorkflow` calls it once, when its payment is decided by the confirm, the 3D Secure callback, the no or the timer, or at the create when it is declined there (agreed 2026-11-08).
- An update or cancel is a guarded update on `SCHEDULED`. If a cancel changes no row and the payment is already `CANCELLED`, the API returns that result again; otherwise the answer is 409.
- A confirm is an update to the payment's waiting workflow, and Verify's commit is guarded on `PENDING`. A repeated confirm carries the same update ID and gets the same answer, or once the workflow has closed, gets the payment's current state from Oracle, so a retry after a lost reply never looks like a failure. A confirm the workflow turns away, because it already has an answer or no longer waits, gets 409.
- An allocations callback stores its batch in `allocation_batch` first, then starts `ReceiveAllocationsWorkflow` with the ID `{paymentId}-allocations-{batch}`, which comes from the request. A repeated batch finds the same workflow: a start that fails as already started counts as done, and reuse policy `REJECT_DUPLICATE` stops a second run after the first one closes. The callback's full contract, including its idempotency rules, is still to be agreed with the allocations manager.

## Market Onboarding API

Each environment's billpay-offline exposes the Market Onboarding API, because the onboarding workflow runs on the Offline cluster. Only the market-onboarding control plane, the Market Onboarding UI's backend, calls it, with its own service identity. The work runs in `MarketOnboardingWorkflow`, so every call but the two reads answers `202` as soon as the workflow has it.

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
