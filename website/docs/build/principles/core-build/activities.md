---
title: Building Activities & ActivityGroups
sidebar_label: Activities
---

import Lead from '@site/src/components/Lead';

# Building Activities & ActivityGroups

<Lead>Activities are where the platform touches the world. Every database write, every downstream call, and every event publish is an activity. Everything above them is orchestration. This layer is the I/O. Keep each one small, boring, and safe to run twice.</Lead>

## Activities: one retryable action

An activity does a single side-effecting thing: persist the pending payment, publish a lifecycle event, call clearing. The interface and implementation split is mechanical, `{Action}Activity` and `{Action}ActivityImpl`, in `core/lib/activities/` and its `impl/`.

```kotlin
interface PaymentStateTransitionActivity {
    fun transition(payment: Payment)
}

class PaymentStateTransitionActivityImpl(
    private val db: Database,
) : PaymentStateTransitionActivity {
    override fun transition(payment: Payment) = transaction(db) {
        TransDtl.update({ TransDtl.paymentId eq payment.paymentId }) {
            it[status] = payment.status.name
        }
        TransLfcycEvent.insert { /* new row for the new state */ }
        // publish the lifecycle event to Lumi via RTF
    }
}
```

*(Shape, simplified.)* Three rules make activities safe:

- **Assume Temporal will retry the activity.** An activity that writes half its state and throws gets called again with the same input, so it must not double-write. Idempotent writes are the habit: keyed inserts, and absolute updates like `status = ACCEPTED` rather than increments.
- **Take only the fields you need.** Activities are shared across every market, and their inputs are recorded in workflow history. Pass the payment id and the two fields you use, not the whole `Payment` object.
- **One `transaction { }` per activity.** The activity is the transaction boundary *and* the retry boundary. If it throws, the transaction rolls back and Temporal's retry policy decides what happens next. One clean unit, with no partial commits to reason about.

An activity talks to the world through a [client](./clients.md), never directly. The client owns the protocol, and the activity owns the action.

## ActivityGroups: one business concern

An **ActivityGroup** composes activities for a single concern and is named for it: `{Responsibility}ActivityGroup`, in `core/lib/activityGroups/`, or `market/{m}/activityGroups/` for an override. `PaymentValidationActivityGroup` gathers and evaluates everything validation needs. `PaymentExecutionActivityGroup` runs the three execution actions.

Two responsibilities live at this level and not below:

- **Sequencing and fan-out.** The group decides what runs in parallel and what must wait. Execution fires clearing, the AR balance reduction, and the Open-To-Buy increase *in parallel*, and records each in the notification tracker. Fulfillment notifies accounting, audit, and risk in parallel, and holds customer communications until they are done.
- **Activity options.** Timeouts and retry policies are set by the *composing group*, not defaulted inside the activity. The same activity can run with a tight timeout and two retries on the Online path, and a generous timeout with a long retry tail on the Offline path. The group knows the context. The activity does not.

```kotlin
class PaymentExecutionActivityGroup(/* … */) {
    fun execute(paymentId: String /* + required fields */) {
        val opts = ActivityOptions { startToCloseTimeout = …; retryPolicy = … }
        listOf(
            async { clearingCall(paymentId, opts) },      // to the bank, via MR/M3
            async { arBalanceReduction(paymentId, opts) },// Accounts Receivable
            async { otbIncrease(paymentId, opts) },       // Authorizations (AMP)
        ).awaitAll()
    }
}
```

*(Shape, simplified.)* Which groups carry dimensions and which are generic, all 22 of them with their transitions and invoking stages, is catalogued in [Design → ActivityGroups & Activities](../../../design/component-model/activities.md).

When in doubt about granularity, prefer several short activities composed by a group over one long activity. Short activities retry cheaply. Long ones repeat work.
