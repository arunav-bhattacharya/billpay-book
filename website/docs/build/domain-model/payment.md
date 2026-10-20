---
title: Payment
description: 'One sealed class per lifecycle state, two shapes, and moves between states as functions the compiler checks.'
sidebar_label: Payment
---

import Lead from '@site/src/components/Lead';

# Payment

<Lead>One sealed class per lifecycle state, two shapes, and moves between states as functions the compiler checks. This page is the payment model as Kotlin, top down, from the sources under <code>docs/domainModel</code>.</Lead>

[Design → Domain Model](../../design/domain-model.md) has the map: all fourteen states, what each one guarantees, and the 36 moves between them. This page shows the code a builder works with.

## The root types

`Transaction` is the root, meaning anything that moves value. It has two branches, `Payment` and `Refund`, and `Refund` has no concrete classes yet, because the refund steps are still to be defined.

```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
sealed interface Transaction {
    val id: TransactionId
    val account: Account
    val amount: MonetaryAmount?          // nullable: a PENDING payment may not know it yet
}

sealed interface Payment : Transaction {
    val paymentId: TransactionId
    override val id: TransactionId get() = paymentId

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

`confirmationCode` is the key the customer keeps: it survives an update, which issues a new payment ID, and a representment. `presentmentSequence` numbers the payment's trips to the bank, starting at 1. Every sealed type carries the `type` property, so the JSON says which class, and which state, it holds ([Serialization](../tech-stack/serialization.md)).

## The types the model leans on

The supplied file uses five types it doesn't define. The build takes each one from the current app where it exists there, so it matches production, and otherwise creates it as below.

```kotlin
/** A payment's ID: a ULID, which One-Data makes. A leg's ID is its parent's plus "_{seq}". */
data class TransactionId @JsonCreator(mode = JsonCreator.Mode.DELEGATING) constructor(
    @get:JsonValue val value: String,
) {
    init { require(FORMAT.matches(value)) { "not a payment or leg ID: $value" } }
    fun withSplit(sequenceNumber: Int) = TransactionId("${value}_$sequenceNumber")
    override fun toString() = value
    private companion object { val FORMAT = Regex("[0-9A-HJKMNP-TV-Z]{26}(_[0-9]+)?") }
}

/** The card account, held as its token and never as a card number. */
data class TokenizedAccount(val accountId: String) : Account   // CARD_ACCT.ACCT_ID

/** The Pay & Plan details a payment carries. More fields come with the Installments API. */
data class PlanInfo(val planId: String? = null)

/** Today's payment class. The model uses only these three enums. */
object LegacyPayment {
    enum class PaymentStatus {
        PENDING, SCHEDULED, ACCEPTED, ALLOCATING, ALLOCATED, PROCESSING, PROCESSED,
        PAID, RETURNED, REPRESENTING, REPRESENTED, CANCELLED, DECLINED, DISALLOWED,
    }
    enum class PaymentSource   // the current app's values
    enum class DeclineCode     // the current app's values
}
```

Money is `javax.money.MonetaryAmount` from JSR 354, the Java money API, with Moneta's `Money` behind it, so an amount is never a floating-point number. On the wire it is an amount and a currency code. `PaymentSource` and `DeclineCode` keep the current app's values exactly: they are part of what other systems already read.

## What each state must hold

Two traits narrow what a class has to carry. `VerifiedPayment` is the one that matters most: every class from `SCHEDULED` to `REPRESENTED`, `ALLOCATING` and `ALLOCATED` included, mixes it in.

```kotlin
private interface VerifiedPayment {
    val account: TokenizedAccount        // narrows Transaction.account
    val amount: MonetaryAmount           // non-null, narrows Transaction.amount
    val option: VerifiedPaymentOption    // narrows PaymentOption
    val instrument: VerifiedInstrument   // narrows Instrument
    val timeline: ExecutableTimeline     // knows its clearing date and cancel cutoff
}

interface RepresentmentPayment {         // RETURNED, REPRESENTING and REPRESENTED
    val returnedInfo: ReturnedInfo
}

sealed class AcceptedPayment : Payment, VerifiedPayment {
    override val status = LegacyPayment.PaymentStatus.ACCEPTED
}
```

That single choice encodes a business rule: nothing moves money until Verify has resolved the account, the amount, the option, the instrument and the timeline. Breaking it is a compile error, not a runtime check. Each of the fourteen state classes fixes its own `status` the same way, so the status can't drift from the data.

## Full payments and legs

`FullPayment` marks a payment that settles as one amount. `SplitPayment` is a leg, and carries its link to the parent:

```kotlin
sealed interface SplitPayment : Payment {
    val originalPaymentId: TransactionId     // the parent
    val sequenceNumber: Int
}

data class SplitSlice(
    val sequenceNumber: Int,
    val splitAmount: MonetaryAmount,
    val splitPaymentId: TransactionId,       // the leg's ID, {paymentId}_{seq}
    val account: TokenizedAccount,           // the card account this leg pays
)
```

A leg is made from a parent Verify has already passed, so it starts at `ACCEPTED`, and there is no pending, scheduled, allocating or allocated leg. Two moves make one, and each kind of split uses one of them:

- A consumer split's legs are written by Verify's `ACCEPTED` commit, through `AcceptedFullPayment.toAcceptedSplitPayment(splitSlice)`.
- A corporate payment's legs are written at its release, once its Execute has cleared it, through `ProcessingFullPayment.toAcceptedSplitPayment(splitSlice)`. Each leg pays its own card account, which is why the slice carries one.

## The guard on PendingFullPayment

`PendingFullPayment`, the class every payment starts as, checks itself when it is built:

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

If the customer named the amount, or the option is already verified, the amount must be there. For any other option, Verify works the amount out later, so supplying one up front is an error. The defaults are `presentmentSequence = 1`, `hasMoneyMovement = true`, `planDetailData = null` and `bankConfirmation = null`. A payment that waits for its customer's bank holds a `BankConfirmation`: the provider's reference and the redirect link.

## A move, in code

There is no `setStatus`. Each move is an extension function that takes one class and returns the next, so a move without a function can't happen. The move to the next presentment shows what the types buy:

```kotlin
fun ReturnedFullPayment.toRepresentingFullPayment(representmentDate: LocalDate) =
    RepresentingFullPayment(
        paymentId = paymentId,
        presentmentSequence = presentmentSequence + 1,        // a new presentment, a new row
        timeline = timeline.withClearingDate(representmentDate),
        returnedInfo = returnedInfo,
        /* the rest carried over unchanged */
    )
```

The returned payment isn't moved: its row stays `RETURNED`, and the function builds the next presentment beside it. The arguments of every move say what it needs. The move out of `PENDING` takes what Verify resolved, and every move that records a return takes a `ReturnedInfo`, so a return without its details doesn't compile.

A [stage](../core-build/stages.md) runs one of these moves and commits the result through `PaymentStore`, which is why stage code stays short.

## What the build adds

The file supplied on 2026-10-16 is behind the agreed model in nine places, such as the corporate `ALLOCATING` and `ALLOCATED` classes and the move from `PENDING` to `CANCELLED`. The build makes all nine from the spec's list (agreed 2026-10-18). [Design → Domain Model](../../design/domain-model.md#what-the-code-still-needs) lists them.
