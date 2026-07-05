package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class AcceptedFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
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
            paymentId = "${paymentId}_$sequenceNumber",
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class AcceptedSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.Instrument
import com.aexp.billpay.core.domain.transaction.directives.PaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class CancelledFullPayment(
    override val paymentId: String,
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.Instrument
import com.aexp.billpay.core.domain.transaction.directives.PaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class DeclinedFullPayment(
    override val paymentId: String,
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

package com.aexp.billpay.core.domain.transaction

import com.fasterxml.jackson.annotation.JsonTypeInfo

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = FullPayment.PROPERTY_NAME)
sealed interface FullPayment : Payment {
    companion object {
        const val PROPERTY_NAME = "type"
    }
}

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class PaidFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
) : PaidPayment(),
    FullPayment

fun PaidFullPayment.toReturnedFullPayment(): ReturnedFullPayment =
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class PaidSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
    override val sequenceNumber: Int,
) : PaidPayment(),
    SplitPayment

fun PaidSplitPayment.toReturnedSplitPayment(): ReturnedSplitPayment =
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.InitialPaymentAmountPaymentOption
import com.aexp.billpay.core.domain.transaction.directives.Instrument
import com.aexp.billpay.core.domain.transaction.directives.InstrumentReference
import com.aexp.billpay.core.domain.transaction.directives.OtherAmountPaymentOption
import com.aexp.billpay.core.domain.transaction.directives.PaymentOption
import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class PendingFullPayment(
    override val paymentId: String,
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ProcessedFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
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

fun ProcessedFullPayment.toReturnedFullPayment(): ReturnedFullPayment =
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
    )
    
package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ProcessedSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
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

fun ProcessedSplitPayment.toReturnedSplitPayment(): ReturnedSplitPayment =
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
    )
    
package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ProcessingFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
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
            paymentId = "${paymentId}_$sequenceNumber",
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ProcessingSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
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

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class RepresentedFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class RepresentedSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
    override val sequenceNumber: Int,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class RepresentingFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class RepresentingSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
    override val sequenceNumber: Int,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ReturnedFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ReturnedSplitPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
    override val amount: MonetaryAmount,
    override val timeline: ExecutableTimeline,
    override val option: VerifiedPaymentOption,
    override val instrument: VerifiedInstrument,
    override val presentmentSequence: Int,
    override val hasMoneyMovement: Boolean,
    override val planDetailData: PlanInfo?,
    override val originalPaymentId: String,
    override val sequenceNumber: Int,
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
    )

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.account.Account
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

data class ScheduledFullPayment(
    override val paymentId: String,
    override val confirmationCode: ConfirmationCode,
    override val source: LegacyPayment.PaymentSource,
    override val account: Account,
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

package com.aexp.billpay.core.domain.transaction

import com.fasterxml.jackson.annotation.JsonTypeInfo

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = SplitPayment.PROPERTY_NAME)
sealed interface SplitPayment : Payment {
    val originalPaymentId: String
    val sequenceNumber: Int

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

package com.aexp.billpay.core.domain.transaction

import javax.money.MonetaryAmount

data class SplitSlice(
    val sequenceNumber: Int,
    val splitAmount: MonetaryAmount,
)

package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.ExecutableTimeline.Frequency
import com.fasterxml.jackson.annotation.JsonTypeInfo
import java.time.Instant
import java.time.LocalDate

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
) : Timeline

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
