/**
 * Base interface for all instruments used for the exchange of value in a transaction.
 *
 * This umbrella type covers unverified lookup inputs, trusted provided inputs,
 * and verified canonical instruments.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Instrument.PROPERTY_NAME)
sealed interface Instrument {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Marker interface for instruments that must be resolved before they can be used as verified instruments.
 *
 * These values typically carry only a stable reference, such as an enrollment identifier,
 * and are resolved into a [VerifiedInstrument].
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = InstrumentReference.PROPERTY_NAME)
sealed interface InstrumentReference : Instrument {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * An instrument reference identified by enrollment ID only.
 *
 * Used when only the enrollment identifier is needed to locate the full instrument details.
 *
 * @property id The enrollment identifier of the referenced instrument.
 */
data class EnrollmentInstrument(
    val id: EnrollmentIdentifier,
) : InstrumentReference

/**
 * Resolves an enrollment instrument reference into a verified financial institution instrument.
 */
fun EnrollmentInstrument.toFinancialInstitutionInstrument(
    instrumentToken: InstrumentToken,
    fingerprint: Fingerprint,
    accountType: FIAccountType?,
    fiName: String?,
    fiCode: FinancialInstitutionIdentifier,
    redactedAccountNumber: String,
    identificationSchema: IdentificationSchema,
) = FinancialInstitutionInstrument(
    id = id,
    instrumentToken = instrumentToken,
    fingerprint = fingerprint,
    accountType = accountType,
    fiName = fiName,
    fiCode = fiCode,
    encryptedAccountNumber = null,
    redactedAccountNumber = redactedAccountNumber,
    identificationSchema = identificationSchema,
)

/**
 * Resolves an enrollment instrument reference into a verified debit card instrument.
 */
fun EnrollmentInstrument.toDebitCardInstrument(
    instrumentToken: InstrumentToken,
    fingerprint: Fingerprint,
    redactedCardNumber: String,
    fiName: String?,
    expiryDate: YearMonth?,
) = DebitCardInstrument(
    id = id,
    instrumentToken = instrumentToken,
    fingerprint = fingerprint,
    redactedCardNumber = redactedCardNumber,
    encryptedCardNumber = null,
    fiName = fiName,
    expiryDate = expiryDate,
)

/**
 * Resolves an enrollment instrument reference into a verified loyalty instrument.
 */
fun EnrollmentInstrument.toLoyaltyInstrument() = LoyaltyInstrument(id = id)

/**
 * Marker interface for trusted instrument inputs received from a transaction event.
 *
 * These values are accepted as authoritative input and are not resolved into a different
 * verified instrument instance by the payment flow.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = ProvidedInstrument.PROPERTY_NAME)
sealed interface ProvidedInstrument : Instrument {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Trusted financial institution account details received from a transaction event.
 *
 * @property fiCode The financial institution identifier.
 * @property accountNumber The account number supplied by the upstream event.
 */
data class FinancialInstitutionProvidedInstrument(
    val fiCode: FinancialInstitutionIdentifier,
    val accountNumber: BankAccountNumber,
) : ProvidedInstrument

/**
 * Trusted debit card details received from a transaction event.
 *
 * @property cardNumber The card number supplied by the upstream event.
 */
data class DebitCardProvidedInstrument(
    val cardNumber: DebitCardNumber,
) : ProvidedInstrument

/**
 * Resolves a provided financial institution instrument into a verified financial institution instrument.
 */
fun FinancialInstitutionProvidedInstrument.toFinancialInstitutionInstrument(
    id: EnrollmentIdentifier,
    instrumentToken: InstrumentToken,
    fingerprint: Fingerprint,
    accountType: FIAccountType?,
    fiName: String?,
    encryptedAccountNumber: BankAccountToken?,
    redactedAccountNumber: String,
    identificationSchema: IdentificationSchema,
) = FinancialInstitutionInstrument(
    id = id,
    instrumentToken = instrumentToken,
    fingerprint = fingerprint,
    accountType = accountType,
    fiName = fiName,
    fiCode = fiCode,
    encryptedAccountNumber = encryptedAccountNumber,
    redactedAccountNumber = redactedAccountNumber,
    identificationSchema = identificationSchema,
)

/**
 * Resolves a provided debit card instrument into a verified debit card instrument.
 */
fun DebitCardProvidedInstrument.toDebitCardInstrument(
    id: EnrollmentIdentifier,
    instrumentToken: InstrumentToken,
    fingerprint: Fingerprint,
    redactedCardNumber: String,
    encryptedCardNumber: DebitCardToken?,
    fiName: String?,
    expiryDate: YearMonth?,
) = DebitCardInstrument(
    id = id,
    instrumentToken = instrumentToken,
    fingerprint = fingerprint,
    redactedCardNumber = redactedCardNumber,
    encryptedCardNumber = encryptedCardNumber,
    fiName = fiName,
    expiryDate = expiryDate,
)

/**
 * Marker interface for instruments capable of executing money and other value exchanges.
 *
 * Instruments implementing this interface can be used to transfer funds or other forms of value
 * for payments, refunds, and other money movement operations. This includes both fiat currency
 * transfers (via [RegulatedInstrument]) and non-fiat value transfers (via [ContractInstrument]),
 * such as loyalty rewards used to pay an American Express card balance.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = VerifiedInstrument.PROPERTY_NAME)
sealed interface VerifiedInstrument : Instrument {
    val id: EnrollmentIdentifier

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Interface for financial instruments subject to regulatory requirements.
 *
 * Regulated instruments require secure tokenization and fingerprinting for compliance
 * with financial regulations and security standards. These instruments handle sensitive
 * payment data and must include tokens and fingerprints for secure identification.
 *
 * @property instrumentToken Secure token representing the instrument.
 * @property fingerprint Unique fingerprint for instrument identification.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = RegulatedInstrument.PROPERTY_NAME)
sealed interface RegulatedInstrument : VerifiedInstrument {
    val instrumentToken: InstrumentToken
    val fingerprint: Fingerprint

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Represents a bank account or financial institution account instrument.
 *
 * This instrument type is used for bank-to-bank transfers and supports various international
 * banking identification schemas (e.g., routing numbers, IBAN, BSB, IFSC, etc.).
 * Contains both encrypted and redacted account information for security compliance.
 *
 * @property id The enrollment identifier.
 * @property instrumentToken Secure token for the account.
 * @property fingerprint Unique fingerprint for the account.
 * @property accountType Type of financial institution account, if known.
 * @property fiName Name of the financial institution, if known.
 * @property fiCode Institution identifier code such as a routing number or sort code.
 * @property encryptedAccountNumber Encrypted account number for secure storage.
 * @property redactedAccountNumber Masked account number for display purposes.
 * @property identificationSchema The banking identification schema used.
 */
data class FinancialInstitutionInstrument(
    override val id: EnrollmentIdentifier,
    override val instrumentToken: InstrumentToken,
    override val fingerprint: Fingerprint,
    val accountType: FIAccountType? = null,
    val fiName: String? = null,
    val fiCode: FinancialInstitutionIdentifier,
    val encryptedAccountNumber: BankAccountToken? = null,
    val redactedAccountNumber: String,
    val identificationSchema: IdentificationSchema,
) : RegulatedInstrument {
    /**
     * Types of financial institution accounts supported for money movement.
     *
     * Includes consumer and business variants of common account types across different regions.
     */
    enum class FIAccountType {
        SAVINGS,
        CHECKING,
        CURRENT,
        CONSUMER_SAVINGS,
        CONSUMER_CHECKING,
        BUSINESS_SAVINGS,
        BUSINESS_CHECKING,
    }

    /**
     * Banking identification schemas used internationally to identify financial institutions and accounts.
     *
     * Different countries and regions use different combinations of codes to identify banks and accounts.
     */
    enum class IdentificationSchema {
        /**
         * UK banking system
         */
        SORT_CODE_AND_BANK_ACCOUNT_NUMBER,

        /**
         * US banking system
         */
        ROUTING_NUMBER_AND_BANK_ACCOUNT_NUMBER,

        /**
         * Canadian banking system
         */
        TRANSIT_NUMBER_AND_BANK_ACCOUNT_NUMBER,

        /**
         * Indian banking system
         */
        IFSC_CODE_AND_BANK_ACCOUNT_NUMBER,

        /**
         * Australian banking system
         */
        BSB_NUMBER_AND_BANK_ACCOUNT_NUMBER,

        /**
         * Generic international banking
         */
        BANK_CODE_AND_BANK_ACCOUNT_NUMBER,

        /**
         * SEPA / Europe / International banking - Bank Identifier Code (BIC) & International Bank Account Number (IBAN)
         */
        BANK_IDENTIFIER_CODE_AND_INTERNATIONAL_BANK_ACCOUNT_NUMBER,

        /**
         * Mexican banking system - Clave Bancaria Estandarizada (CLABE)
         */
        CLABE,
    }
}

/**
 * Represents a debit card payment instrument.
 *
 * This instrument type enables debit card-based payments and refunds.
 * Contains both encrypted and redacted card information for security compliance.
 *
 * @property id The enrollment identifier.
 * @property instrumentToken Secure token for the card.
 * @property fingerprint Unique fingerprint for the card.
 * @property redactedCardNumber Masked card number for display purposes, e.g. "****1234".
 * @property encryptedCardNumber Encrypted full card number for secure storage.
 * @property fiName Name of the card-issuing financial institution, if known.
 * @property expiryDate Card expiration date.
 */
data class DebitCardInstrument(
    override val id: EnrollmentIdentifier,
    override val instrumentToken: InstrumentToken,
    override val fingerprint: Fingerprint,
    val redactedCardNumber: String,
    val encryptedCardNumber: DebitCardToken? = null,
    val fiName: String? = null,
    @field:JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "MM/yyyy")
    val expiryDate: YearMonth? = null,
) : RegulatedInstrument

/**
 * Marker interface for contract-based payment instruments.
 *
 * These instruments are based on contractual agreements or programs rather than traditional
 * financial accounts or cards.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = ContractInstrument.PROPERTY_NAME)
sealed interface ContractInstrument : VerifiedInstrument {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

/**
 * Represents a loyalty program-based payment instrument.
 *
 * This instrument type enables payments and refunds using loyalty program balances or rewards points
 * through contractual arrangements.
 *
 * @property id The enrollment identifier for the loyalty instrument.
 */
data class LoyaltyInstrument(
    override val id: EnrollmentIdentifier,
) : ContractInstrument