---
title: Payment
sidebar_label: Payment
---

import Lead from '@site/src/components/Lead';

# Payment

<Lead>One type per lifecycle state, one marker per shape, and transitions as compiler-checked functions. This page walks the hierarchy top-down — read it against the sources under `docs/domainModel` once, and the naming does the rest.</Lead>

## The roots

`Transaction` is the platform root — anything that moves value. `Payment` is its (currently only) family:

```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Transaction.PROPERTY_NAME)
sealed interface Transaction {
    val id: String
    val account: Account
    val amount: MonetaryAmount?   // nullable — PENDING may not know it yet
}
```

```kotlin
sealed interface Payment : Transaction {
    val paymentId: String
    override val id: String get() = paymentId

    val confirmationCode: ConfirmationCode?
    val status: LegacyPayment.PaymentStatus
    val source: LegacyPayment.PaymentSource
    val timeline: Timeline
    val option: PaymentOption
    val instrument: Instrument
    val presentmentSequence: Int
    val hasMoneyMovement: Boolean
    val planDetailData: PlanInfo?
}
```

Amounts are `javax.money.MonetaryAmount` throughout. `confirmationCode` is the customer-stable key — it survives an update (which issues a new `paymentId`) and representment. `presentmentSequence` counts settlement attempts: `1` for the original presentment, bumped when a return is re-presented. `planDetailData` carries the installment-plan linkage for *Pay & Plan* flows.

## The Verified narrowing

A file-private interface does the model's sharpest work:

```kotlin
private interface VerifiedPayment {
    val amount: MonetaryAmount          // non-null — narrows Transaction.amount
    val option: VerifiedPaymentOption   // narrows PaymentOption
    val instrument: VerifiedInstrument  // narrows Instrument
}
```

Every in-flight status type mixes it in; the entry and terminal-failure types don't. That single choice encodes the business rule "nothing moves money until validation has resolved the amount, the option, and the instrument" — as a compile error, not a runtime check.

## The eleven status types

Each status is a `sealed class` that pins `status` to one constant:

| Status type | `status` | Verified? | Notes |
| --- | --- | --- | --- |
| `PendingPayment` | `PENDING` | — | May carry a null amount and unverified directives. |
| `ScheduledPayment` | `SCHEDULED` | ✓ | |
| `AcceptedPayment` | `ACCEPTED` | ✓ | |
| `ProcessingPayment` | `PROCESSING` | ✓ | |
| `ProcessedPayment` | `PROCESSED` | ✓ | |
| `PaidPayment` | `PAID` | ✓ | |
| `ReturnedPayment` | `RETURNED` | ✓ | |
| `RepresentingPayment` | `REPRESENTING` | ✓ | |
| `RepresentedPayment` | `REPRESENTED` | ✓ | |
| `CancelledPayment` | `CANCELLED` | — | |
| `DeclinedPayment` | `DECLINED` | — | Adds `abstract val declineCode` — a decline always says why. |

## Shape: Full and Split

Two marker interfaces cut across the statuses. `FullPayment` adds nothing — it's the "settles as one amount" marker. `SplitPayment` carries the linkage back to its parent:

```kotlin
sealed interface SplitPayment : Payment {
    val originalPaymentId: String
    val sequenceNumber: Int
}
```

The concrete classes are the cross-product — 18 immutable `data class`es:

| Status | Full | Split |
| --- | --- | --- |
| `PENDING` | ✓ | — |
| `SCHEDULED` | ✓ | — |
| `ACCEPTED` | ✓ | ✓ |
| `PROCESSING` | ✓ | ✓ |
| `PROCESSED` | ✓ | ✓ |
| `PAID` | ✓ | ✓ |
| `RETURNED` | ✓ | ✓ |
| `REPRESENTING` | ✓ | ✓ |
| `REPRESENTED` | ✓ | ✓ |
| `CANCELLED` | ✓ | — |
| `DECLINED` | ✓ | — |

The gaps in the Split column are deliberate: **splitting begins at `ACCEPTED`.** A split leg is born from an already-accepted parent (`SplitSlice` in hand), so a pending, scheduled, cancelled, or declined split can't exist — and therefore doesn't compile.

```kotlin
data class SplitSlice(
    val sequenceNumber: Int,
    val splitAmount: MonetaryAmount,
)
```

A leg's identity is derived, not invented: `paymentId = "${parent.paymentId}_$sequenceNumber"`, with `originalPaymentId` pointing back at the parent.

## One guarded doorway

`PendingFullPayment` — the type every API-created payment starts as — checks its own consistency at construction:

```kotlin
init { checkAmountAgainstPaymentOption() }

private fun checkAmountAgainstPaymentOption() {
    when (option) {
        is VerifiedPaymentOption, is OtherAmountPaymentOption, is InitialPaymentAmountPaymentOption ->
            checkNotNull(amount) { "amount must be present for option type ${option::class.simpleName}" }
        else ->
            check(amount == null) { "amount must be unspecified for option type ${option::class.simpleName}" }
    }
}
```

In words: if the customer named the amount (`OTHER_AMOUNT`, `INITIAL_PAYMENT_AMOUNT`) or the option is already verified, an amount must be present; for every other option the amount is *computed later* by the system of record, so supplying one up front is an error. Defaults on this type: `presentmentSequence = 1`, `hasMoneyMovement = true`, `planDetailData = null`.

## Timelines

Dates and times live in their own small hierarchy rather than as loose fields:

| Type | Adds | Used by |
| --- | --- | --- |
| `Timeline` *(sealed)* | `captureTimestamp` · `transactionDate` · `transactionTimestamp` | the base — `PENDING`, `DECLINED` |
| `ExecutableTimeline` *(sealed)* | `clearingDate` · `executionTimestamp` · `cancelCutoffTimestamp` · `frequency` (`ONCE` / `RECURRING`) | every state that can move money |
| `InitialTimeline` | — | the plain concrete base |
| `ImmediateTimeline` | `frequency` fixed to `ONCE` | pay-today payments |
| `ScheduledTimeline` | `scheduleDate` | future-dated payments (`SCHEDULED` requires it) |

Same trick as the Verified narrowing: a payment can't reach an executable state without a timeline that knows its clearing date and cancel cutoff, because the types won't line up otherwise.

## Transitions: the state machine as functions

There's no `setStatus`. Each legal edge is a top-level extension function that consumes one immutable type and returns the next — 26 of them:

| From | To |
| --- | --- |
| `PendingFullPayment` | `toAcceptedFullPayment(amount, timeline, option, instrument)` · `toScheduledFullPayment(…)` · `toDeclinedFullPayment(declineCode)` |
| `ScheduledFullPayment` | `toAcceptedFullPayment()` · `toDeclinedFullPayment(declineCode)` · `toCancelledFullPayment()` |
| `AcceptedFullPayment` | `toProcessingFullPayment()` · `toAcceptedSplitPayment(splitSlice)` |
| `ProcessingFullPayment` | `toProcessedFullPayment()` · `toAcceptedSplitPayment(splitSlice)` |
| `ProcessedFullPayment` | `toPaidFullPayment()` · `toReturnedFullPayment()` |
| `PaidFullPayment` | `toReturnedFullPayment()` |
| `ReturnedFullPayment` | `toRepresentingFullPayment()` |
| `RepresentingFullPayment` | `toRepresentedFullPayment()` · `toReturnedFullPayment()` |
| `RepresentedFullPayment` | `toReturnedFullPayment()` |
| `AcceptedSplitPayment` | `toProcessingSplitPayment()` |
| `ProcessingSplitPayment` | `toProcessedSplitPayment()` |
| `ProcessedSplitPayment` | `toPaidSplitPayment()` · `toReturnedSplitPayment()` |
| `PaidSplitPayment` / `ReturnedSplitPayment` / `RepresentingSplitPayment` / `RepresentedSplitPayment` | mirror the Full edges at the split level |

Notice the pending→accepted edge *demands* the verified pieces as arguments — validation's outputs are the transition's inputs. And note `ProcessingFullPayment.toAcceptedSplitPayment(splitSlice)`: that's the corporate fan-out edge, where an already-processing parent spawns `ACCEPTED` split legs once its allocations arrive.

A [stage](../principles/core-build/stages.md) is essentially one of these functions plus the persistence and event publication around it — which is why stage signatures are so clean.

:::note[Still to be modelled]
No types yet for `DISALLOWED`, `ALLOCATING`, or `ALLOCATED`; no first-class Allocation entity (splits + `SplitSlice` carry that today); the processing dimensions ride in the routing context, not on these types. The [spec's state model](../../design/payment-state-model.md) remains the target picture.
:::
