/**
 * Represents a payment option for bill payment transactions.
 *
 * Payment options follow a two-phase workflow:
 * 1. **Reference Phase** ([PaymentOptionReference]): The option is identified by name/type, but not yet validated
 * 2. **Verified Phase** ([VerifiedPaymentOption]): The option has been confirmed as valid and active by the system of record
 *
 * @property id Optional identifier for the payment option. Required in verified phase.
 * @property optionType The type of payment option (e.g., MINIMUM_DUE, TOTAL_BALANCE)
 * @property value Optional payment amount value. Required in verified phase or when user-specified.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = PaymentOption.PROPERTY_NAME)
sealed interface PaymentOption {
    val id: String?
    val optionType: OptionType
    val value: MonetaryAmount?

    /**
     * Payment option types supported by the bill payment system.
     */
    enum class OptionType {
        /** Minimum payment amount required */
        MINIMUM_DUE,

        /** Total outstanding balance on the account */
        OUTSTANDING_BALANCE,

        /** Statement balance remaining after partial payments */
        REMAINING_STATEMENT_BALANCE,

        /** Initial payment amount for deferred payment plans */
        INITIAL_PAYMENT_AMOUNT,

        /** Custom user-specified payment amount */
        OTHER_AMOUNT,

        /** Adjusted balance after applying credits or adjustments */
        ADJUSTED_BALANCE,

        /** Total balance including all charges */
        TOTAL_BALANCE,

        /** Current statement balance */
        STATEMENT_BALANCE,
    }

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Base type for categorizing payment options by their option type.
 * Used as a common parent for sealed classes representing each payment option category.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = PaymentOptionType.PROPERTY_NAME)
sealed interface PaymentOptionType : PaymentOption {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Payment option for minimum due amount.
 */
sealed class MinimumDuePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.MINIMUM_DUE
}

/**
 * Payment option for outstanding balance amount.
 */
sealed class OutstandingBalancePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.OUTSTANDING_BALANCE
}

/**
 * Payment option for remaining statement balance after partial payments.
 */
sealed class RemainingStatementBalancePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.REMAINING_STATEMENT_BALANCE
}

/**
 * Payment option for initial payment amount in deferred payment plans.
 */
sealed class InitialPaymentAmountPaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.INITIAL_PAYMENT_AMOUNT
}

/**
 * Payment option for custom user-specified amounts.
 */
sealed class OtherAmountPaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.OTHER_AMOUNT
}

/**
 * Payment option for adjusted balance after credits or adjustments.
 */
sealed class AdjustedBalancePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.ADJUSTED_BALANCE
}

/**
 * Payment option for total balance including all charges.
 */
sealed class TotalBalancePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.TOTAL_BALANCE
}

/**
 * Payment option for current statement balance.
 */
sealed class StatementBalancePaymentOption : PaymentOptionType {
    override val optionType: PaymentOption.OptionType = PaymentOption.OptionType.STATEMENT_BALANCE
}

/**
 * Pre-lookup payment option reference where the option name/type is known but not yet validated.
 *
 * Used in scenarios where:
 * - The payment option identifier has not been confirmed as valid and active
 * - The amount may need to be computed by the system of record (except for user-specified amounts)
 *
 * Fields:
 * - [id]: Optional - not yet verified against system of record
 * - [value]: Optional for most types; required only for [InitialPaymentAmountPaymentOptionReference] and [OtherAmountPaymentOptionReference]
 *
 * After validation, convert to [VerifiedPaymentOption] with confirmed id and amount from system of record.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = PaymentOptionReference.PROPERTY_NAME)
sealed interface PaymentOptionReference : PaymentOption {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Reference to minimum due payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class MinimumDuePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : MinimumDuePaymentOption(),
    PaymentOptionReference

/**
 * Reference to outstanding balance payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class OutstandingBalancePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : OutstandingBalancePaymentOption(),
    PaymentOptionReference

/**
 * Reference to remaining statement balance payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class RemainingStatementBalancePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : RemainingStatementBalancePaymentOption(),
    PaymentOptionReference

/**
 * Reference to initial payment amount option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Required user-specified amount for the initial payment
 */
data class InitialPaymentAmountPaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount,
) : InitialPaymentAmountPaymentOption(),
    PaymentOptionReference

/**
 * Reference to custom amount payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Required user-specified custom payment amount
 */
data class OtherAmountPaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount,
) : OtherAmountPaymentOption(),
    PaymentOptionReference

/**
 * Reference to adjusted balance payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class AdjustedBalancePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : AdjustedBalancePaymentOption(),
    PaymentOptionReference

/**
 * Reference to total balance payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class TotalBalancePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : TotalBalancePaymentOption(),
    PaymentOptionReference

/**
 * Reference to statement balance payment option before verification.
 *
 * @property id Optional payment option identifier, not yet verified
 * @property value Optional amount value, will be provided by system of record after verification
 */
data class StatementBalancePaymentOptionReference(
    override val id: String? = null,
    override val value: MonetaryAmount? = null,
) : StatementBalancePaymentOption(),
    PaymentOptionReference

/**
 * Post-lookup payment option with verified identifier and amount from the system of record.
 *
 * Used after validation confirms that:
 * - The payment option is valid and currently active
 * - The payment option identifier is confirmed
 * - The payment amount has been computed or verified by the system of record
 *
 * All fields are required:
 * - [id]: Confirmed valid payment option identifier
 * - [value]: Amount value provided/verified by system of record
 *
 * This represents the final state after successful lookup and validation of a [PaymentOptionReference].
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = VerifiedPaymentOption.PROPERTY_NAME)
sealed interface VerifiedPaymentOption : PaymentOption {
    override val id: String
    override val value: MonetaryAmount

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Verified minimum due payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedMinimumDuePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : MinimumDuePaymentOption(),
    VerifiedPaymentOption

/**
 * Verified outstanding balance payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedOutstandingBalancePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : OutstandingBalancePaymentOption(),
    VerifiedPaymentOption

/**
 * Verified remaining statement balance payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedRemainingStatementBalancePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : RemainingStatementBalancePaymentOption(),
    VerifiedPaymentOption

/**
 * Verified initial payment amount option with confirmed id and validated amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount valuevalidated by system of record
 */
data class VerifiedInitialPaymentAmountPaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : InitialPaymentAmountPaymentOption(),
    VerifiedPaymentOption

/**
 * Verified custom amount payment option with confirmed id and validated amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount valuevalidated by system of record
 */
data class VerifiedOtherAmountPaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : OtherAmountPaymentOption(),
    VerifiedPaymentOption

/**
 * Verified adjusted balance payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedAdjustedBalancePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : AdjustedBalancePaymentOption(),
    VerifiedPaymentOption

/**
 * Verified total balance payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedTotalBalancePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : TotalBalancePaymentOption(),
    VerifiedPaymentOption

/**
 * Verified statement balance payment option with confirmed id and amount from system of record.
 *
 * @property id Confirmed payment option identifier
 * @property value Payment amount value provided by system of record
 */
data class VerifiedStatementBalancePaymentOption(
    override val id: String,
    override val value: MonetaryAmount,
) : StatementBalancePaymentOption(),
    VerifiedPaymentOption