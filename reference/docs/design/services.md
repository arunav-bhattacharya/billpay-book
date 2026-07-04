---
id: services
title: Payment Services
sidebar_position: 1
---

# Payment Services

Payment Services are the **activity-level building blocks** that workflows
compose. Each service is owned by a single responsibility — validation, state
transition, side-effect, or notification.

A service is either:

- <span className="bp-pill bp-pill--success">Generic</span> — one implementation, used everywhere.
- A combination of <span className="bp-pill bp-pill--warn">variant</span> chips — different implementations are chosen per `market`, `account-type`, `frequency`, `payment-state`, `payment-method`, `workflow-type` or `api-identifier`. **All listed variant dimensions are required** to pick the right impl — the `+` between chips denotes an AND.

For example, this is a service whose impl varies across three dimensions:

<span className="bp-pillchain">
  <span className="bp-pill bp-pill--warn">frequency</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">acct-type</span>
  <span className="bp-pillchain__plus">+</span>
  <span className="bp-pill bp-pill--warn">market</span>
</span>

## Idempotency

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 1 | `IdempotencyService` | `Input → PENDING` *(create APIs)* / None *(mutate APIs)* | Single idempotency check per Core API call. For **create-payment** APIs, inserts into `idempotency_checker`, `trans_dtl`, `trans_lfcyc_event` and publishes the `PENDING` lifecycle event. For **mutate-payment** APIs (cancel, update, returns, paid events), inserts into `idempotency_checker` only. If the row already exists → duplicate; else idempotent. | <span className="bp-pill bp-pill--warn">api-identifier</span> | Idempotency is a platform contract — semantics differ only by **which API** is calling (full first-write on create vs. checker-only write on mutate); no per-market or per-account variance. |

## Validation

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 2 | `PaymentValidationService` | Per-variant: `PENDING → ACCEPTED / DECLINED` *(immediate, inbound)*, `PENDING → SCHEDULED / DECLINED` *(schedule)*, `SCHEDULED` / `ALLOCATIONS_RECEIVED → ACCEPTED / DECLINED` *(execute-scheduled)* | Validates whether a payment can transition to its next state. Used by the immediate, schedule, execute-scheduled, and inbound-posting workflows. The current `payment-state` and the request's `payment-method` (push or pull) together with `market`, `account-type`, and `frequency` determine the eligibility rules and external-system calls invoked. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">market</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">frequency</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">payment-state</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">payment-method</span></span> | Eligibility rules differ per **market** (regulators, cutoffs, currency), per **account-type** (consumer vs. corporate gates), per **frequency** (immediate/scheduled/recurring relax or tighten checks), per **payment-state** (validates differently on creation vs. on execution vs. on inbound posting — the entry state changes which external systems are consulted), and per **payment-method** (push payments validate the funding instrument; pull payments validate the mandate). |

## State Transition

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 3 | `PaymentStateTransitionService` | Any transition | Updates `trans_dtl.status`, appends to `trans_lfcyc_event`, publishes lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> | The state model is canonical across the platform — same writes, same event contract. |
| 4 | `PaymentSplitStateTransitionService` | Any split-level transition | Same as above but for `split_trans_dtl` / `split_trans_lfcyc_event`. | <span className="bp-pill bp-pill--success">Generic</span> | Same canonical state model applied at split granularity. |
| 5 | `PaymentSplitsCreationService` | `ACCEPTED` (full) → `ACCEPTED` (split) | For each split → insert into `split_trans_dtl` + `split_lfcyc_event` as `ACCEPTED` and publish lifecycle event. | <span className="bp-pill bp-pill--success">Generic</span> | Mechanical fan-out of split rows — allocation values come from GPA upstream. |

## Event Notification

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 6 | `EventNotificationService` | None | Single notification service that emits payment-event notifications (scheduled, declined on creation, declined on execution, invalid return, …) to customers and downstream operational queues. Channel, template, locale, and routing are picked per the resolved variant. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">market</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">payment-state</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">workflow-type</span></span> | Notification channels (push/email/SMS), message templates, and locale differ per **market** and **account-type**. The **payment-state** identifies which event is being notified (SCHEDULED, DECLINED, RETURNED, …) and which audience copy applies. The **workflow-type** distinguishes synchronous declines (`#CreateImmediatePaymentWF`, `#CreateSchedulePaymentWF`) from asynchronous declines (`#ExecuteScheduledPaymentWF`) from notification-only flows like invalid returns (`#ProcessReturnedPaymentWF`) — different audiences, different urgency, different routing. |

## Allocations (Corporate)

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 7 | `PaymentAllocationsRequestService` | `PENDING → ALLOCATIONS_REQUESTED` | Request allocations from GPA. | <span className="bp-pill bp-pill--success">Generic</span> | GPA's contract is platform-wide — same request shape for all corporate accounts. |
| 8 | `PaymentAllocationsReceivedService` | `ALLOCATIONS_REQUESTED → ALLOCATIONS_RECEIVED` | Receive allocations from GPA. (Receipt-side validation TBD.) | <span className="bp-pill bp-pill--success">Generic</span> | Same — receipt-side validation may add per-market checks later. |

## Execution / Clearing / Posting / Fulfillment

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 9 | `PaymentExecutionService` *(Clearing + Posting)* | `ACCEPTED → PROCESSING` | In parallel: send to Clearing, decrement AR balance, increase Authorization OTB. Each side-effect tracked in `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">market</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span></span> | Clearing network and message format vary per market; AR + OTB posting integrations differ per account-type. |
| 10 | `PaymentClearingService` | `ACCEPTED → PROCESSING` | Send to clearing only. Logged to `notification_tracker`. | <span className="bp-pill bp-pill--warn">market</span> | Each market uses its own clearing network — different protocol, message format, and operating hours. |
| 11 | `PaymentPostingService` | `ACCEPTED → PROCESSING` | Send to AR + OTB in parallel. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | AR and OTB systems differ per account-type (consumer card vs corporate card), and rules differ per market. |
| 12 | `PaymentFulfillmentService` | `PROCESSING → PROCESSED` | In parallel: notify Accounting, B&C, then Communications. Logged to `notification_tracker`. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Accounting integration, B&C reconciliation cadence, and communications templates all differ per market and account-type. |

## Cancellation

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 13 | `PaymentCancelValidationService` | None | Check current state + external eligibility. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">frequency</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Cancel-eligibility windows differ per market (regulator cut-offs); corporate vs consumer have different cancel rights; immediate/scheduled/recurring frequencies have different cancel windows. |
| 14 | `PaymentCancellationService` | `SCHEDULED` / `ACCEPTED → CANCELLED` | Notify external systems of cancellation. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Downstream cancellation notifications are routed differently per market regulator and account-type. |

## Returns & Representment

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 15 | `PaymentReturnValidationService` | None | Validate current state for a return. | <span className="bp-pill bp-pill--success">Generic</span> | Validity is determined by canonical state — same logic everywhere. |
| 16 | `PaymentReturnExecutionService` | `PROCESSING` / `PROCESSED` / `PAID → RETURNED` | Notify external systems of return. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Reversal flows touch different AR systems per account-type and follow market-specific regulator notifications. |
| 17 | `PaymentRepresentmentEligibilityService` | None | Determine if a returned payment is representable. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Representment is governed by clearing-network rules (market) and contractual policy (account-type). |
| 18 | `PaymentRepresentmentCreationService` | `RETURNED` (Pres-seq-1) → `REPRESENTING` (Pres-seq-2) | New row in `trans_dtl` + `trans_lfcyc_event` for representment. | <span className="bp-pill bp-pill--success">Generic</span> | Mechanical — same insert path regardless of market. |
| 19 | `PaymentRepresentmentValidationService` | None | On the representment day, re-check validity. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | Re-applies the same market / account-type validity rules used at origination. |
| 20 | `PaymentRepresentmentExecutionService` | `REPRESENTING → REPRESENTED` | Send to clearing; notify external systems. | <span className="bp-pillchain"><span className="bp-pill bp-pill--warn">acct-type</span><span className="bp-pillchain__plus">+</span><span className="bp-pill bp-pill--warn">market</span></span> | AR system (per account-type) and downstream notification routing (per market regulator) vary; the clearing-network differences are already captured by the `market` axis applied at execution time. |

## Inbound rejection

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 21 | `PaymentRejectionService` | `DECLINED → REJECTED` | Used by `#ProcessInboundPaymentWF` when a posting fails validation. | <span className="bp-pill bp-pill--muted">TBD</span> | Spec pending — rejection-routing rules per market under design. |

## Cross-reference

| # | Service | Transitions | Description | Variants | Variance Reason |
| -- | --- | --- | --- | --- | --- |
| 22 | `MapNewPaymentIdToPreviousIdService` | None | Insert `(old, new)` into `ORIG_TRANS_REFER_MAP` — used by `#UpdatePaymentWF`. | <span className="bp-pill bp-pill--success">Generic</span> | Pure mapping insert — no business rule variance. |

:::tip
**State-transition pairings**: any service that changes state is always paired
with `PaymentStateTransitionService` (or its split-level twin). This is the
contract that keeps `trans_dtl`, `trans_lfcyc_event` and downstream event
streams in sync.
:::
