@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Payment.PROPERTY_NAME)
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

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

@Suppress("unused")
private interface VerifiedPayment {
    val account: TokenizedAccount
    val amount: MonetaryAmount
    val option: VerifiedPaymentOption
    val instrument: VerifiedInstrument
    val timeline: ExecutableTimeline
}

@Suppress("unused")
interface RepresentmentPayment {
    val returnedInfo: ReturnedInfo
}

sealed class PendingPayment : Payment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.PENDING
}

sealed class ScheduledPayment :
    Payment,
    VerifiedPayment {
    abstract override val timeline: ScheduledTimeline
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.SCHEDULED
}

sealed class AcceptedPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.ACCEPTED
}

sealed class ProcessingPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.PROCESSING
}

sealed class ProcessedPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.PROCESSED
}

sealed class PaidPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.PAID
}

sealed class ReturnedPayment :
    Payment,
    VerifiedPayment,
    RepresentmentPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.RETURNED
}

sealed class RepresentingPayment :
    Payment,
    VerifiedPayment,
    RepresentmentPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.REPRESENTING
}

sealed class RepresentedPayment :
    Payment,
    VerifiedPayment,
    RepresentmentPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.REPRESENTED
}

sealed class CancelledPayment : Payment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.CANCELLED
}

sealed class DeclinedPayment : Payment {
    abstract val declineCode: LegacyPayment.DeclineCode
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.DECLINED
}

// TODO: Confirm required properties
data class ReturnedInfo(
    val effectiveDate: LocalDate,
    val returnReason: Return,
    val returnSource: ReturnSourceIdentifier,
    val originalPaymentId: TransactionId,
    val originalPresentmentSequence: Int,
    val originalPaymentDate: LocalDate,
)

data class AcceptedSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
) : AcceptedPayment(),
    SplitPayment

fun AcceptedSplitPayment.toProcessingSplitPayment(): ProcessingSplitPayment =
    ProcessingSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
    )
    
data class AcceptedFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : AcceptedPayment(),
    FullPayment

fun AcceptedFullPayment.toAcceptedSplitPayment(splitSlice: SplitSlice): AcceptedSplitPayment =
    with(splitSlice) {
        AcceptedSplitPayment(
            paymentId = paymentId.withSplit(sequenceNumber),
            confirmationCode = confirmationCode,
            source = source,
            account = account,
            amount = splitAmount,
            timeline = timeline,
            option = option,
            instrument = instrument,
            presentmentSequence = presentmentSequence,
            hasMoneyMovement = hasMoneyMovement,
            planDetailData = planDetailData,
            originalPaymentId = paymentId,
            sequenceNumber = sequenceNumber,
        )
    }

fun AcceptedFullPayment.toProcessingFullPayment(): ProcessingFullPayment =
    ProcessingFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )
    
data class CancelledFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: PaymentOption,
    override val instrument: Instrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : CancelledPayment(),
    FullPayment
    
    
data class DeclinedFullPayment(
    override val paymentId: TransactionId,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount?,
    override val timeline: Timeline,
    override val option: PaymentOption,
    override val instrument: Instrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val declineCode: LegacyPayment.DeclineCode,
) : DeclinedPayment(),
    FullPayment {
    override val confirmationCode: ConfirmationCode? get() = null
}

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = FullPayment.PROPERTY_NAME)
sealed interface FullPayment : Payment {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

data class PaidFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : PaidPayment(),
    FullPayment

fun PaidFullPayment.toReturnedFullPayment(returnedInfo: ReturnedInfo): ReturnedFullPayment =
    ReturnedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )
    
data class PaidSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
) : PaidPayment(),
    SplitPayment

fun PaidSplitPayment.toReturnedSplitPayment(returnedInfo: ReturnedInfo): ReturnedSplitPayment =
    ReturnedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )
    
    
data class PendingFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount?,
    override val timeline: Timeline,
    override val option: PaymentOption,
    override val instrument: InstrumentReference,
    override val presentmentSequence: Int = 1,
    override val hasMoneyMovement: Boolean = true,
    override val planDetailData: PlanInfo? = null,
) : PendingPayment(),
    FullPayment {
    // TODO: Determine if these input state transition guards are necessary domain invariants
    //       or overly restrictive constraints that should be relaxed or removed
    init {
        checkAmountAgainstPaymentOption()
    }

    private fun checkAmountAgainstPaymentOption() {
        when (option) {
            is VerifiedPaymentOption,
            is OtherAmountPaymentOption,
            is InitialPaymentAmountPaymentOption,
            ->
                checkNotNull(amount) {
                    "amount must be present for option type ${option::class.simpleName}"
                }

            else ->
                check(amount == null) {
                    "amount must be unspecified for option type ${option::class.simpleName}"
                }
        }
    }
}

fun PendingFullPayment.toAcceptedFullPayment(
    account: TokenizedAccount,
    amount: MonetaryAmount,
    timeline: ExecutableTimeline,
    option: VerifiedPaymentOption,
    instrument: VerifiedInstrument,
): AcceptedFullPayment =
    AcceptedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )

fun PendingFullPayment.toScheduledFullPayment(
    account: TokenizedAccount,
    amount: MonetaryAmount,
    timeline: ScheduledTimeline,
    option: VerifiedPaymentOption,
    instrument: VerifiedInstrument,
): ScheduledFullPayment =
    ScheduledFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )

fun PendingFullPayment.toDeclinedFullPayment(
    // TODO: Determine which properties should default to previous property values of pending payment state.
    option: PaymentOption = this.option,
    instrument: Instrument = this.instrument,
    declineCode: LegacyPayment.DeclineCode,
): DeclinedFullPayment =
    DeclinedFullPayment(
        paymentId = paymentId,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        declineCode = declineCode,
    )
    
data class ProcessedFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : ProcessedPayment(),
    FullPayment

fun ProcessedFullPayment.toPaidFullPayment(): PaidFullPayment =
    PaidFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )

fun ProcessedFullPayment.toReturnedFullPayment(returnedInfo: ReturnedInfo): ReturnedFullPayment =
    ReturnedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )
    
data class ProcessedSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
) : ProcessedPayment(),
    SplitPayment

fun ProcessedSplitPayment.toPaidSplitPayment(): PaidSplitPayment =
    PaidSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
    )

fun ProcessedSplitPayment.toReturnedSplitPayment(returnedInfo: ReturnedInfo): ReturnedSplitPayment =
    ReturnedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )
    
data class ProcessingFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : ProcessingPayment(),
    FullPayment

fun ProcessingFullPayment.toAcceptedSplitPayment(splitSlice: SplitSlice): AcceptedSplitPayment =
    with(splitSlice) {
        AcceptedSplitPayment(
            paymentId = paymentId.withSplit(sequenceNumber),
            confirmationCode = confirmationCode,
            source = source,
            account = account,
            amount = splitAmount,
            timeline = timeline,
            option = option,
            instrument = instrument,
            presentmentSequence = presentmentSequence,
            hasMoneyMovement = hasMoneyMovement,
            planDetailData = planDetailData,
            originalPaymentId = paymentId,
            sequenceNumber = sequenceNumber,
        )
    }

fun ProcessingFullPayment.toProcessedFullPayment(): ProcessedFullPayment =
    ProcessedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )
    
data class ProcessingSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
) : ProcessingPayment(),
    SplitPayment

fun ProcessingSplitPayment.toProcessedSplitPayment(): ProcessedSplitPayment =
    ProcessedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
    )
    
    
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Refund.PROPERTY_NAME)
sealed interface Refund : Transaction {
    val refundId: TransactionId
    override val id: TransactionId get() = refundId

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

data class RepresentedFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val returnedInfo: ReturnedInfo,
) : RepresentedPayment(),
    FullPayment

fun RepresentedFullPayment.toReturnedFullPayment(): ReturnedFullPayment =
    ReturnedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )
    
data class RepresentedSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
    override val returnedInfo: ReturnedInfo,
) : RepresentedPayment(),
    SplitPayment

fun RepresentedSplitPayment.toReturnedSplitPayment(): ReturnedSplitPayment =
    ReturnedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )
    
    
data class RepresentingFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val returnedInfo: ReturnedInfo,
) : RepresentingPayment(),
    FullPayment

fun RepresentingFullPayment.toRepresentedFullPayment(): RepresentedFullPayment =
    RepresentedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )

fun RepresentingFullPayment.toReturnedFullPayment(): ReturnedFullPayment =
    ReturnedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )
    
data class RepresentingSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
    override val returnedInfo: ReturnedInfo,
) : RepresentingPayment(),
    SplitPayment

fun RepresentingSplitPayment.toRepresentedSplitPayment(): RepresentedSplitPayment =
    RepresentedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )

fun RepresentingSplitPayment.toReturnedSplitPayment(): ReturnedSplitPayment =
    ReturnedSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )
    
data class ReturnedFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val returnedInfo: ReturnedInfo,
) : ReturnedPayment(),
    FullPayment

fun ReturnedFullPayment.toRepresentingFullPayment(): RepresentingFullPayment =
    RepresentingFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        returnedInfo = returnedInfo,
    )
    
data class ReturnedSplitPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: TransactionId,
    override val sequenceNumber: Int,
    override val returnedInfo: ReturnedInfo,
) : ReturnedPayment(),
    SplitPayment

fun ReturnedSplitPayment.toRepresentingSplitPayment(): RepresentingSplitPayment =
    RepresentingSplitPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        originalPaymentId = originalPaymentId,
        sequenceNumber = sequenceNumber,
        returnedInfo = returnedInfo,
    )
    
data class ScheduledFullPayment(
    override val paymentId: TransactionId,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: TokenizedAccount,
    override val amount: MonetaryAmount,
    override val timeline: ScheduledTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : ScheduledPayment(),
    FullPayment

fun ScheduledFullPayment.toAcceptedFullPayment(): AcceptedFullPayment =
    AcceptedFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )

fun ScheduledFullPayment.toDeclinedFullPayment(declineCode: LegacyPayment.DeclineCode): DeclinedFullPayment =
    DeclinedFullPayment(
        paymentId = paymentId,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
        declineCode = declineCode,
    )

fun ScheduledFullPayment.toCancelledFullPayment(): CancelledFullPayment =
    CancelledFullPayment(
        paymentId = paymentId,
        confirmationCode = confirmationCode,
        source = source,
        account = account,
        amount = amount,
        timeline = timeline,
        option = option,
        instrument = instrument,
        presentmentSequence = presentmentSequence,
        hasMoneyMovement = hasMoneyMovement,
        planDetailData = planDetailData,
    )
    
@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = SplitPayment.PROPERTY_NAME)
sealed interface SplitPayment : Payment {
    val originalPaymentId: TransactionId
    val sequenceNumber: Int
    override val amount: MonetaryAmount

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

data class SplitSlice(
    val sequenceNumber: Int,
    val splitAmount: MonetaryAmount,
)

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Timeline.PROPERTY_NAME)
sealed interface Timeline {
    val captureTimestamp: Instant
    val transactionDate: LocalDate
    val transactionTimestamp: Instant

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = ExecutableTimeline.PROPERTY_NAME)
sealed interface ExecutableTimeline : Timeline {
    val clearingDate: LocalDate
    val executionTimestamp: Instant
    val cancelCutoffTimestamp: Instant
    val frequency: Frequency

    enum class Frequency {
        ONCE,
        RECURRING,
    }

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

data class InitialTimeline(
    override val captureTimestamp: Instant,
    override val transactionDate: LocalDate,
    override val transactionTimestamp: Instant,
) : Timeline {
    constructor(
        captureTimestamp: Instant,
        transactionDate: LocalDate,
        marketZone: ZoneId,
    ) : this(
        captureTimestamp = captureTimestamp,
        transactionDate = transactionDate,
        transactionTimestamp = transactionDate.atStartOfDay(marketZone).toInstant(),
    )
}

data class ImmediateTimeline(
    override val captureTimestamp: Instant,
    override val transactionDate: LocalDate,
    override val transactionTimestamp: Instant,
    override val clearingDate: LocalDate,
    override val executionTimestamp: Instant,
    override val cancelCutoffTimestamp: Instant,
) : ExecutableTimeline {
    override val frequency: Frequency = Frequency.ONCE
}

data class ScheduledTimeline(
    override val captureTimestamp: Instant,
    override val transactionDate: LocalDate,
    override val transactionTimestamp: Instant,
    val scheduleDate: LocalDate,
    override val clearingDate: LocalDate,
    override val executionTimestamp: Instant,
    override val cancelCutoffTimestamp: Instant,
    override val frequency: Frequency,
) : ExecutableTimeline

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Transaction.PROPERTY_NAME)
sealed interface Transaction {
    val id: TransactionId
    val account: Account
    val amount: MonetaryAmount?

    companion object {
        const val PROPERTY_NAME = "type"
    }
}