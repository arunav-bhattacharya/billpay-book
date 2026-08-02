---
title: Payment Options
description: 'A payment option is what the customer chose to pay: the minimum due, the full statement balance, an amount they typed in.'
sidebar_label: Payment Options
---

import Lead from '@site/src/components/Lead';

# Payment Options

<Lead>A payment option is <em>what the customer chose to pay</em>: the minimum due, the full statement balance, an amount they typed in. The type system tracks one fact about it, which is whether the system of record has confirmed it yet.</Lead>

## From reference to verified

Every option starts as a **reference**. The customer named an option, but nothing is confirmed. Validation then resolves it into a **verified** option, with an id and amount the system of record stands behind.

```kotlin
sealed interface PaymentOption {
    val id: String?                 // nullable until verified
    val optionType: OptionType
    val value: MonetaryAmount?      // nullable until verified (or user-specified)
}

sealed interface PaymentOptionReference : PaymentOption          // pre-lookup

sealed interface VerifiedPaymentOption : PaymentOption {         // post-lookup
    override val id: String          // now required
    override val value: MonetaryAmount
}
```

The nullability *is* the state. A `PaymentOptionReference` may hold nothing but the option type, and a `VerifiedPaymentOption` cannot exist without a confirmed id and amount. That is why the [Verified payment states](./payment.md) can demand a `VerifiedPaymentOption` and know at compile time that an amount exists.

## The eight option types

| Option type | Meaning |
| --- | --- |
| `MINIMUM_DUE` | The minimum payment the account requires. |
| `OUTSTANDING_BALANCE` | Everything currently owed on the account. |
| `REMAINING_STATEMENT_BALANCE` | What is left of the statement after partial payments. |
| `INITIAL_PAYMENT_AMOUNT` | The up-front payment on a deferred payment plan. |
| `OTHER_AMOUNT` | A custom, user-specified amount. |
| `ADJUSTED_BALANCE` | The balance after credits and adjustments. |
| `TOTAL_BALANCE` | The total balance including all charges. |
| `STATEMENT_BALANCE` | The current statement balance. |

Each type gets a small family: a sealed category class that pins the `optionType`, a `…Reference` data class, and a `Verified…` data class. `MINIMUM_DUE` reads like this, and the other seven are identical in shape:

```kotlin
sealed class MinimumDuePaymentOption : PaymentOptionType {
    override val optionType = OptionType.MINIMUM_DUE
}

data class MinimumDuePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,     // computed later by the system of record
) : MinimumDuePaymentOption(), PaymentOptionReference

data class VerifiedMinimumDuePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : MinimumDuePaymentOption(), VerifiedPaymentOption
```

## The two options that need an amount up front

Six of the eight references take an optional `value`, because the amount is the *system's* to compute: Billpay looks up the minimum due itself. Two require the value at construction.

- `OtherAmountPaymentOptionReference(value: MonetaryAmount)`
- `InitialPaymentAmountPaymentOptionReference(value: MonetaryAmount)`

Those are the user-specified amounts. There is nothing to look up, so a reference without a value would be meaningless. This is the same rule `PendingFullPayment` enforces in its [init guard](./payment.md#the-guard-on-pendingfullpayment): amount present for user-specified options, amount absent for computed ones.
