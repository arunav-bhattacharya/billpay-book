---
title: Payment Options
sidebar_label: Payment Options
---

import Lead from '@site/src/components/Lead';

# Payment Options

<Lead>A payment option is <em>what the customer chose to pay</em> — the minimum due, the full statement balance, an amount they typed in. The type system tracks one crucial fact about it: whether the system of record has confirmed it yet.</Lead>

## Two phases, one hierarchy

Every option starts as a **reference** — the customer named an option, but nothing is confirmed — and validation resolves it into a **verified** option with an id and amount the system of record stands behind:

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

The nullability *is* the state: a `PaymentOptionReference` may hold nothing but the option type; a `VerifiedPaymentOption` cannot exist without a confirmed id and amount. That's why the [Verified payment states](./payment.md) can demand a `VerifiedPaymentOption` and know — at compile time — that an amount exists.

## The eight option types

| `OptionType` | Meaning |
| --- | --- |
| `MINIMUM_DUE` | The minimum payment the account requires. |
| `OUTSTANDING_BALANCE` | Everything currently owed on the account. |
| `REMAINING_STATEMENT_BALANCE` | What's left of the statement after partial payments. |
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

## The one asymmetry worth remembering

Six of the eight references take an optional `value` — the amount is the *system's* to compute (what **is** the minimum due? Billpay looks it up). Two require it at construction:

- `OtherAmountPaymentOptionReference(value: MonetaryAmount)`
- `InitialPaymentAmountPaymentOptionReference(value: MonetaryAmount)`

Those are the user-specified amounts — there is nothing to look up, so a reference without a value would be meaningless. This is also exactly the rule `PendingFullPayment` enforces in its [init guard](./payment.md#one-guarded-doorway): amount present for user-specified options, amount absent for computed ones.
