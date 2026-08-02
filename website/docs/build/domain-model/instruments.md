---
title: Instruments
description: 'An instrument is where the money comes from: a bank account, a debit card, or a loyalty balance.'
sidebar_label: Instruments
---

import Lead from '@site/src/components/Lead';

# Instruments

<Lead>An instrument is <em>where the money comes from</em>: a bank account, a debit card, or a loyalty balance. Like payment options, instruments follow a resolve-then-trust pattern. Inputs arrive as references or provided details, and only a <strong>verified</strong> instrument can fund a payment.</Lead>

## The instrument hierarchy

```kotlin
sealed interface Instrument                                  // the umbrella

sealed interface InstrumentReference : Instrument            // must be resolved first
sealed interface ProvidedInstrument : Instrument             // trusted upstream input

sealed interface VerifiedInstrument : Instrument {           // can move value
    val id: EnrollmentIdentifier
}
sealed interface RegulatedInstrument : VerifiedInstrument {  // fiat: token + fingerprint required
    val instrumentToken: InstrumentToken
    val fingerprint: Fingerprint
}
sealed interface ContractInstrument : VerifiedInstrument     // non-fiat (contractual value)
```

Three ways in, one way to fund:

- **`EnrollmentInstrument`** *(reference)* carries just an enrollment id. The full details live in the enrollment system and get resolved from there.
- **`FinancialInstitutionProvidedInstrument`** and **`DebitCardProvidedInstrument`** *(provided)* carry account or card details that arrived on a trusted transaction event, the inbound path, and are taken as authoritative input.
- Resolution functions (`toFinancialInstitutionInstrument(…)`, `toDebitCardInstrument(…)`, `toLoyaltyInstrument()`) turn either of those into a **verified** instrument. The [Verified payment states](./payment.md) accept nothing less.

The `RegulatedInstrument` split matters for compliance. Anything that touches real money must carry a secure **token** and a **fingerprint**, and sensitive numbers are encrypted or redacted, never raw. `ContractInstrument` covers value that is not fiat, like loyalty points paying down a card balance.

## The three verified instruments

**`FinancialInstitutionInstrument`** is a bank account. It carries the institution code, redacted and optionally encrypted account numbers, and two enums that make it work internationally: `FIAccountType` and `IdentificationSchema`.

| Account type | How the account is identified |
| --- | --- |
| `SAVINGS` | `SORT_CODE_AND_BANK_ACCOUNT_NUMBER` (UK) |
| `CHECKING` | `ROUTING_NUMBER_AND_BANK_ACCOUNT_NUMBER` (US) |
| `CURRENT` | `TRANSIT_NUMBER_AND_BANK_ACCOUNT_NUMBER` (Canada) |
| `CONSUMER_SAVINGS` | `IFSC_CODE_AND_BANK_ACCOUNT_NUMBER` (India) |
| `CONSUMER_CHECKING` | `BSB_NUMBER_AND_BANK_ACCOUNT_NUMBER` (Australia) |
| `BUSINESS_SAVINGS` | `BANK_CODE_AND_BANK_ACCOUNT_NUMBER` (generic international) |
| `BUSINESS_CHECKING` | `BANK_IDENTIFIER_CODE_AND_INTERNATIONAL_BANK_ACCOUNT_NUMBER` (SEPA, BIC plus IBAN) |
| | `CLABE` (Mexico) |

*(These are two independent enums. The columns are not paired.)* A new market usually adds one `IdentificationSchema` value rather than a new instrument type.

**`DebitCardInstrument`** is a debit card. It holds a redacted card number for display, optionally an encrypted card number, and an expiry serialized as `MM/yyyy` (`@field:JsonFormat(shape = STRING, pattern = "MM/yyyy") val expiryDate: YearMonth?`).

**`LoyaltyInstrument`** is the contract instrument. It holds an enrollment id and nothing else, because the loyalty program owns the balance.

:::warning[Two different "account types"]
`FIAccountType` here describes the **funding bank account**, savings versus checking. It is *not* the `accountType` **behavior** (`CONSUMER`, `CORPORATE`, `BUSINESS_TRAVEL`) that routes processing. That one lives on the Amex `Account`, not on the instrument. Conflating them is the easiest mistake to make in this part of the codebase.
:::
