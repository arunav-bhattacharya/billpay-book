---
title: Payment Options
description: 'A payment option is what the customer chose to pay: the minimum due, the full statement balance, an amount they typed in.'
sidebar_label: Payment Options
---

import Lead from '@site/src/components/Lead';

# Payment Options

<Lead>A payment option is <em>what the customer chose to pay</em>: the minimum due, the full statement balance, an amount they typed in. The type system tracks one fact about it, which is whether the system of record has confirmed it yet.</Lead>

## From reference to verified

Every option starts as a **reference**. The customer named an option, but nothing is confirmed. Verify then resolves it into a **verified** option, with an ID and an amount the system of record stands behind.

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

A `PaymentOptionReference` may hold nothing but the option type, while a `VerifiedPaymentOption` can't exist without a confirmed ID and amount. The nullable fields are the state, which is why [every state that can move money](./payment.md#what-each-state-must-hold) can demand a `VerifiedPaymentOption` and know at compile time that an amount exists.

## The option ID

The channel's payment page reads the customer's options from Payment Options' `ReadPaymentOptions.v1`, and each comes with a payment option ID, unique to that option and the balance it pays. The create carries the ID of the option the customer chose, so the reference holds it from the start (Proposed: in the `id` the reference already has). Verify's Options check validates it through `ReadPaymentOptionByIdentifier.v1`, and the answer turns the reference into a verified option.

A scheduled payment is checked again on its due date. Reverify calls `ReadPaymentOptions.v1` to confirm the customer still owes money and the chosen option still holds, and declines the payment if not. For an option whose amount follows a balance, such as the statement balance or the total balance, the amount is taken again that day, so the payment can pay a different amount from the one it showed at the create. A payment with several instructions carries one option ID for the whole payment. Proposed: the composite checks it once for all its instructions, and an option that no longer holds declines every instruction with `PAYMENT_OPTION_INVALID`. Payments from Accounts Receivable, corporate payments and Pay with MR Points alone carry no option ID.

## The eight option types

| Option type | Meaning |
| --- | --- |
| `MINIMUM_DUE` | The minimum payment the account requires. |
| `OUTSTANDING_BALANCE` | Everything currently owed on the account. |
| `REMAINING_STATEMENT_BALANCE` | What is left of the statement after partial payments. |
| `INITIAL_PAYMENT_AMOUNT` | The up-front payment on a deferred payment plan. |
| `OTHER_AMOUNT` | An amount the customer typed in. |
| `ADJUSTED_BALANCE` | The balance after credits and adjustments. |
| `TOTAL_BALANCE` | The total balance including all charges. |
| `STATEMENT_BALANCE` | The current statement balance. |

Each type gets a small family: a sealed class that pins the `optionType`, a `...Reference` data class, and a `Verified...` data class. `MINIMUM_DUE` reads like this, and the other seven are identical in shape:

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

The customer named these amounts, so there is nothing to look up, and a reference without a value would mean nothing. This is the same rule `PendingFullPayment` enforces in its [init guard](./payment.md#the-guard-on-pendingfullpayment): amount present for user-specified options, amount absent for computed ones.
