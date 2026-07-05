package com.aexp.billpay.core.domain.transaction

import com.aexp.billpay.core.model.domain.account.Account
import com.fasterxml.jackson.annotation.JsonTypeInfo
import javax.money.MonetaryAmount

@JsonTypeInfo(use = JsonTypeInfo.Id.SIMPLE_NAME, include = JsonTypeInfo.As.PROPERTY, property = Transaction.PROPERTY_NAME)
sealed interface Transaction {
    val id: String
    val account: Account
    val amount: MonetaryAmount?

    companion object {
        const val PROPERTY_NAME = "type"
    }
}