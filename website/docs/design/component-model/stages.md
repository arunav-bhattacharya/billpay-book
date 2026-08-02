---
title: Stages
---

import Lead from '@site/src/components/Lead';

# Stages

<Lead>A stage is one state-transition decision point: a Kotlin class with a single function that does the validation, persistence, and event publication for that transition. It consumes one payment state and emits the next. Workflows call stages, and a stage never calls a workflow or an external system directly.</Lead>

Sixteen stages cover every workflow. Most are shared, so the same stage runs in several workflows and behaves the same way in each. Which implementation runs is chosen from the market's behaviors.

Every stage writes its new state to the transaction-detail table, adds a row to the transaction-lifecycle-event table, and publishes a lifecycle event to Lumi (the analytics platform) via RTF (the Reliable Transaction Framework). The sections below note only what each stage does on top of that.

## Which workflow runs which stages

| Workflow | Stages, in the order the workflow calls them |
| --- | --- |
| Create Immediate Payment | `InitiatedToPendingStage`, `PendingToAcceptedStage`, `AcceptedToProcessingStage`, `ProcessingToProcessedStage`. On invalid: `PendingToDeclinedStage` |
| Create Schedule Payment | `InitiatedToPendingStage`, `PendingToScheduledStage`. On invalid: `PendingToDeclinedStage` |
| Execute Scheduled Payment | `ScheduledToAcceptedStage`, `AcceptedToProcessingStage`, `ProcessingToProcessedStage`. On invalid: `PendingToDeclinedStage` |
| Execute Split Payment | `AcceptedToProcessingStage`, `ProcessingToProcessedStage` |
| Cancel Payment | `ScheduledToCancelledStage` or `AcceptedToCancelledStage` |
| Update Payment | `ScheduledToCancelledStage`, `PendingToScheduledStage`. On invalid: `PendingToDeclinedStage` |
| Process Returned Payment | `ToReturnedStage`, `ReturnedToRepresentingStage` |
| Process Representment | `RepresentingToRepresentedStage` or `RepresentingToDeclinedStage` |
| Get Corporate Payment Allocations | `ToAllocatingStage`, `AllocatingToAllocatedStage` |
| Process Inbound Payment | `InitiatedToPendingStage`, `PendingToAcceptedStage`, `AcceptedToProcessingStage`, `ProcessingToProcessedStage`. On invalid: `PendingToDisallowedStage` |

## InitiatedToPendingStage

Run by Create Immediate Payment, Create Schedule Payment and Process Inbound Payment.

- Persists the payment in the transaction-detail, transaction-lifecycle-event, and idempotency tables.
- If the insert fails on a duplicate index the request is a repeat rather than a new payment, and the workflow returns the existing payment.
- On success the payment is stored as `PENDING`.

## PendingToAcceptedStage

Run by Create Immediate Payment and Process Inbound Payment.

- Moves the payment from `PENDING` to `ACCEPTED`, enriching the attributes an accepted payment needs.
- Publishes the `ACCEPTED` event with the enriched data.
- In Process Inbound Payment it runs once `PaymentValidationActivityGroup` confirms Amex accepts the third-party payment.

## PendingToScheduledStage

Run by Create Schedule Payment and Update Payment.

- Books the payment for a future run date. `PaymentValidationActivityGroup` has already confirmed the payment is valid before this stage runs.
- Notifies the systems that need to know a payment is booked, via `PaymentScheduledNotificationActivityGroup`.
- In Update Payment the replacement carries a new payment id, the same confirmation number, and the updated details.

## PendingToDeclinedStage

Run by Create Immediate Payment, Create Schedule Payment, Execute Scheduled Payment and Update Payment.

- Records a payment that failed validation, so nothing downstream runs.
- Account-type-specific implementations may add a notification to AR or other systems, via `PaymentDeclinedNotificationActivityGroup`.
- In Create Schedule Payment the payment is never scheduled. In Execute Scheduled Payment the run-date re-validation did not pass. In Update Payment the replacement was invalid, and the original stays cancelled.

## PendingToDisallowedStage

Run by Process Inbound Payment.

- Records an inbound, third-party-initiated payment that American Express does not accept. `DISALLOWED` is the terminal state specific to inbound payments.
- Runs when `PaymentValidationActivityGroup` finds the inbound payment invalid.

## ScheduledToAcceptedStage

Run by Execute Scheduled Payment.

- Runs on the payment's scheduled date. Before it, `PaymentValidationOnExecutionActivityGroup` re-validates the payment, fetching the current information it needs from external systems, sometimes one call after another, to confirm the scheduled payment is still valid.
- Moves the payment from `SCHEDULED` to `ACCEPTED`, enriching the attributes an accepted payment needs.
- Publishes the `ACCEPTED` event with the enriched data.

## AcceptedToProcessingStage

Run by Create Immediate Payment, Execute Scheduled Payment, Execute Split Payment and Process Inbound Payment.

- Sends the payment for clearing to the bank (via MR/M3).
- Sends it to Accounts Receivable (AR) to reduce the statement balance.
- Sends it to Authorizations (AMP) to increase Open-To-Buy.
- In the generic case these three run in parallel, but this varies by `accountType` and `requiresRealtimeClearing`. The logic can also differ for RTP versus non-RTP payments.
- For corporate payments AR and AMP are **not** notified here. That happens per allocation in Execute Split Payment.

In Execute Split Payment the stage runs at the split level, on one allocation rather than the whole payment:

- A corporate leg updates the AR statement balance and increases Open-To-Buy in AMP only. The corporate parent was already sent for clearing in the workflow that spawned the splits, so the allocation does not clear again.
- A consumer leg also sends the allocation for clearing to the bank, on top of updating the balance and Open-To-Buy.
- The split's state and event go to the split transaction-detail and split transaction-lifecycle-event tables.

## ProcessingToProcessedStage

Run by Create Immediate Payment, Execute Scheduled Payment, Execute Split Payment and Process Inbound Payment.

- Sends the payment to the downstream systems that fulfill it: accounting, audit (Balance & Control, or eBNC), risk, and communications (Raven).
- Communications comes last. The other notifications can run in parallel, and once they all complete the customer communication is triggered.
- Audit makes sure every payment is processed and none is missed. Accounting makes sure the payment is matched across Amex's payment-processing platforms. Risk keeps the customer's risk rules updated with every payment.
- Account-type-specific implementations may notify a different set of systems.
- In Execute Split Payment it fulfills one allocation and writes to the split tables.

## ScheduledToCancelledStage

Run by Cancel Payment and Update Payment.

- Cancels a payment that was booked for a future date, before it runs.
- Beforehand the workflow confirms the request is unique (`IdempotencyCheckActivity`) and that the payment is eligible to cancel (`PaymentCancelValidationActivityGroup`).
- Notifies the systems that need to know the payment is cancelled, via `PaymentCancellationActivityGroup`.
- In Update Payment it clears the way for the replacement, and the workflow can reuse Cancel Payment's logic to do it.

## AcceptedToCancelledStage

Run by Cancel Payment.

- The same as `ScheduledToCancelledStage`, for a payment that has already been accepted (validated and ready to process) rather than merely scheduled.

## ToReturnedStage

Run by Process Returned Payment.

- Records that a payment the bank had taken on has come back, meaning the funds did not settle.
- The payment's current state selects the concrete stage: `PaidToReturnedStage`, `ProcessingToReturnedStage`, or `ProcessedToReturnedStage`.
- Beforehand the workflow confirms the request is unique (`IdempotencyCheckActivity`) and looks up the payment, full or split, along with its current state (`PaymentReturnValidationActivity`). Only `PAID`, `PROCESSING`, and `PROCESSED` payments can be returned.
- Notifies the downstream systems that the payment was returned, via `PaymentReturnExecutionActivityGroup`.

## ReturnedToRepresentingStage

Run by Process Returned Payment.

- Runs only when the return can be re-attempted. `PaymentRepresentmentEligibilityActivityGroup` checks that in the workflow before this stage.
- Enriches the representment details, such as the next date the payment can be re-presented.
- Creates a new `REPRESENTING` transaction for the re-attempt, via `PaymentRepresentmentCreationActivityGroup`: a fresh transaction-detail and transaction-lifecycle-event entry for the next presentment attempt.

## RepresentingToRepresentedStage

Run by Process Representment.

- Runs on the day the representment is processed. Before it, `PaymentRepresentmentValidationActivityGroup` re-checks that the representment is still valid to execute.
- Sends the re-attempted payment for clearing and, in parallel, notifies the downstream systems once it is re-presented, via `PaymentRepresentmentExecutionActivityGroup`.

## RepresentingToDeclinedStage

Run by Process Representment.

- Declines a representment that fails the processing-day re-validation.

## ToAllocatingStage

Run by Get Corporate Payment Allocations.

- Asks the allocations manager for the payment's breakdown into allocations, via `PaymentAllocatingActivityGroup`.
- Marks the parent payment `ALLOCATING`.
- The workflow then waits for the allocations signal before moving to the next stage.

## AllocatingToAllocatedStage

Run by Get Corporate Payment Allocations.

- Records the allocations received back from the allocations manager, via `PaymentAllocatedActivityGroup`.
- Marks the parent payment `ALLOCATED`.
- Creates the split legs in the `ACCEPTED` state in the split transaction-detail and split transaction-lifecycle-event tables, via `PaymentSplitsCreationActivity`, publishing each split's lifecycle event.
- The workflow then triggers Execute Split Payment for each split leg.

---

See the [design principles](../principles.md) for the rules that govern how stages sit between workflows and activity groups, and the [state model](../payment-state-model.md) for the states themselves.
