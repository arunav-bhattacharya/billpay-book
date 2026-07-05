package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.domain.transaction.directives.Instrument
import com.aexp.billpay.core.domain.transaction.directives.PaymentOption
import com.aexp.billpay.core.domain.transaction.directives.VerifiedInstrument
import com.aexp.billpay.core.domain.transaction.directives.VerifiedPaymentOption
import com.aexp.billpay.core.model.domain.plan.PlanInfo
import com.aexp.billpay.core.primitive.ConfirmationCode
import com.fasterxml.jackson.annotation.JsonTypeInfo
import javax.money.MonetaryAmount
import com.aexp.billpay.core.model.domain.payment.Payment as LegacyPayment

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Payment.PROPERTY_NAME)
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

    companion object {
        const val PROPERTY_NAME = "type"
    }
}

@Suppress("unused")
private interface VerifiedPayment {
    val amount: MonetaryAmount
    val option: VerifiedPaymentOption
    val instrument: VerifiedInstrument
}

sealed class PendingPayment : Payment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.PENDING
}

sealed class ScheduledPayment :
    Payment,
    VerifiedPayment {
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
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.RETURNED
}

sealed class RepresentedPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.REPRESENTED
}

sealed class RepresentingPayment :
    Payment,
    VerifiedPayment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.REPRESENTING
}

sealed class CancelledPayment : Payment {
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.CANCELLED
}

sealed class DeclinedPayment : Payment {
    abstract val declineCode: LegacyPayment.DeclineCode
    override val status: LegacyPayment.PaymentStatus = LegacyPayment.PaymentStatus.DECLINED
}