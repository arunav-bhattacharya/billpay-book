---
title: Stages
---

import Lead from '@site/src/components/Lead';

# Stages

<Lead>A stage is one state-transition decision point — a Kotlin class with a single function that does the validation, persistence, and event publication for that transition. It consumes one payment state and emits the next. Workflows call stages; a stage never calls a workflow or an external system directly.</Lead>

The same stage can appear in more than one workflow, and which implementation runs is chosen from the market's dimensions. This page groups the stages by the workflow that runs them, in the order each workflow calls them. **Create Immediate Payment** carries the fullest description of the shared stages; where another workflow runs one of them it behaves the same way, with any workflow-specific detail called out in that section.

## Create Immediate Payment

### InitiatedToPendingStage

- Persists the payment in the transaction-detail, transaction-lifecycle-event, and idempotency tables. If the insert fails on a duplicate index, the request is not idempotent (a repeat), and the workflow returns the existing payment.
- On success the payment is stored as `PENDING`, and a `PENDING` event is published to Lumi (the analytics platform) via RTF (the Reliable Transaction Framework).

### PendingToAcceptedStage

- Moves the payment from `PENDING` to `ACCEPTED`, enriching the attributes an accepted payment needs.
- Updates the transaction to `ACCEPTED` in the database: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Publishes an `ACCEPTED` event, with the enriched data, to Lumi via RTF.

### AcceptedToProcessingStage

- Sends the payment for clearing to the bank (via MR/M3).
- Sends it to Accounts Receivable (AR) to reduce the statement balance.
- Sends it to Authorizations (AMP) to increase Open-To-Buy.
- In the generic case these three run in parallel, but this varies by `accountType` and `requiresRealtimeClearing`.
- Updates the transaction to `PROCESSING` (enriching it as it goes) and publishes a `PROCESSING` event to Lumi via RTF.
- **Note:** the logic can differ for RTP versus non-RTP payments. For corporate payments, AR and AMP are **not** notified in this stage — that happens per allocation in Execute Split Payment.

### ProcessingToProcessedStage

- Sends the payment to the downstream systems that fulfill it: accounting, audit (Balance & Control / eBNC), risk, and communications (Raven).
- Communications comes last. The other notifications can run in parallel, and once they all complete, the customer communication is triggered.
- Audit / Balance & Control (eBNC) makes sure every payment is processed and none is missed.
- Accounting makes sure the payment is matched across Amex's payment-processing platforms.
- Risk keeps the customer's risk rules updated with every payment.
- Updates the transaction to `PROCESSED` (enriching it) and publishes a `PROCESSED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may notify a different set of systems.

### PendingToDeclinedStage

- Updates the transaction to `DECLINED` (enriching it) and publishes a `DECLINED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may add a notification to AR or other systems.

## Create Schedule Payment

### InitiatedToPendingStage

- Persists the payment in the transaction-detail, transaction-lifecycle-event, and idempotency tables. If the insert fails on a duplicate index, the request is a repeat (not idempotent), and the workflow returns the existing payment.
- On success the payment is stored as `PENDING`, and a `PENDING` event is published to Lumi via RTF. This is the same stage as in Create Immediate Payment.

### PendingToScheduledStage

- Books the payment for a future run date. `PaymentValidationActivityGroup` has already confirmed the payment is valid before this stage runs.
- Updates the transaction to `SCHEDULED`: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Notifies the systems that need to know a payment is booked, via `PaymentScheduledNotificationActivityGroup`.
- Publishes a `SCHEDULED` event to Lumi via RTF.

### PendingToDeclinedStage

- Records a payment that failed validation, so it is never scheduled.
- Updates the transaction to `DECLINED` (enriching it) and publishes a `DECLINED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may add a notification to AR or other systems, via `PaymentDeclinedNotificationActivityGroup`.

## Execute Scheduled Payment

### ScheduledToAcceptedStage

- Runs on the payment's scheduled date. Before this stage, `PaymentValidationOnExecutionActivityGroup` re-validates the payment — fetching the current information it needs from external systems, sometimes one call after another — to confirm the scheduled payment is still valid.
- Moves the payment from `SCHEDULED` to `ACCEPTED`, enriching the attributes an accepted payment needs.
- Updates the transaction to `ACCEPTED`: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Publishes an `ACCEPTED` event, with the enriched data, to Lumi via RTF.

### AcceptedToProcessingStage

- Sends the payment for clearing to the bank (via MR/M3).
- Sends it to Accounts Receivable (AR) to reduce the statement balance.
- Sends it to Authorizations (AMP) to increase Open-To-Buy.
- In the generic case these three run in parallel, but this varies by `accountType` and `requiresRealtimeClearing`.
- Updates the transaction to `PROCESSING` (enriching it as it goes) and publishes a `PROCESSING` event to Lumi via RTF.
- **Note:** the logic can differ for RTP versus non-RTP payments. For corporate payments, AR and AMP are **not** notified in this stage — that happens per allocation in Execute Split Payment.

### ProcessingToProcessedStage

- Sends the payment to the downstream systems that fulfill it: accounting, audit (Balance & Control / eBNC), risk, and communications (Raven).
- Communications comes last; the other notifications can run in parallel, and once they all complete the customer communication is triggered.
- Updates the transaction to `PROCESSED` (enriching it) and publishes a `PROCESSED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may notify a different set of systems.

### PendingToDeclinedStage

- When the run-date re-validation does not pass, the workflow routes here to decline the payment instead of processing it.
- Updates the transaction to `DECLINED` (enriching it) and publishes a `DECLINED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may add a notification to AR or other systems.

## Execute Split Payment

### AcceptedToProcessingStage

- Runs at the split/allocation level: it processes one allocation of the parent payment, not the whole payment.
- For a corporate leg it updates the AR statement balance and increases Open-To-Buy in AMP only. The corporate parent was already sent for clearing in the workflow that spawned the splits, so the allocation does not clear again.
- For a consumer leg it also sends the allocation for clearing to the bank (via MR/M3), on top of updating the balance and Open-To-Buy.
- Updates the split to `PROCESSING` in the split transaction-detail and split transaction-lifecycle-event tables, and publishes a `PROCESSING` event for the split to Lumi via RTF.

### ProcessingToProcessedStage

- Fulfills the allocation by notifying the downstream systems — accounting, audit (Balance & Control / eBNC), risk — and communications last, the same shape as Create Immediate Payment but at the split level.
- Updates the split to `PROCESSED` in the split transaction-detail and split transaction-lifecycle-event tables, and publishes a `PROCESSED` event for the split to Lumi via RTF.

## Cancel Payment

### ScheduledToCancelledStage

- Cancels a payment that was booked for a future date, before it runs. Beforehand the workflow confirms the request is unique (`IdempotencyCheckActivity`) and that the payment is eligible to cancel (`PaymentCancelValidationActivityGroup`).
- Updates the transaction to `CANCELLED`: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Notifies the systems that need to know the payment is cancelled, via `PaymentCancellationActivityGroup`.
- Publishes a `CANCELLED` event to Lumi via RTF.

### AcceptedToCancelledStage

- The same as ScheduledToCancelledStage, for a payment that has already been accepted — validated and ready to process — rather than merely scheduled.
- Updates the transaction to `CANCELLED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and notifies downstream systems via `PaymentCancellationActivityGroup`.
- Publishes a `CANCELLED` event to Lumi via RTF.

## Update Payment

### ScheduledToCancelledStage

- Cancels the original scheduled payment so a replacement can take its place; the workflow can reuse Cancel Payment's logic to do this.
- Updates the original transaction to `CANCELLED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and notifies downstream systems via `PaymentCancellationActivityGroup`.
- Publishes a `CANCELLED` event to Lumi via RTF.

### PendingToScheduledStage

- Schedules the replacement payment — built with a new payment id but the same confirmation number and the updated details — once `PaymentValidationActivityGroup` confirms it is valid.
- Updates the transaction to `SCHEDULED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and notifies the systems that need to know a payment is booked, via `PaymentScheduledNotificationActivityGroup`.
- Publishes a `SCHEDULED` event to Lumi via RTF.

### PendingToDeclinedStage

- Declines the replacement if `PaymentValidationActivityGroup` finds it invalid; the original payment stays cancelled.
- Updates the transaction to `DECLINED` (enriching it) and publishes a `DECLINED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may add a notification to AR or other systems.

## Process Returned Payment

### ToReturnedStage

- Records that a payment the bank had taken on has come back — the funds did not settle. The payment's current state selects the concrete stage: `PaidToReturnedStage`, `ProcessingToReturnedStage`, or `ProcessedToReturnedStage`.
- Beforehand the workflow confirms the request is unique (`IdempotencyCheckActivity`) and looks up the payment — full or split — and its current state (`PaymentReturnValidationActivity`); only `PAID`, `PROCESSING`, and `PROCESSED` payments can be returned.
- Updates the transaction to `RETURNED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and notifies the downstream systems that the payment was returned, via `PaymentReturnExecutionActivityGroup`.
- Publishes a `RETURNED` event to Lumi via RTF.

### ReturnedToRepresentingStage

- Runs only when the return can be re-attempted — `PaymentRepresentmentEligibilityActivityGroup` checks that in the workflow before this stage.
- Enriches the representment details, such as the next date the payment can be re-presented.
- Creates a new `REPRESENTING` transaction for the re-attempt, via `PaymentRepresentmentCreationActivityGroup` — a fresh transaction-detail and transaction-lifecycle-event entry for the next presentment attempt.
- Publishes a `REPRESENTING` event to Lumi via RTF.

## Process Representment

### RepresentingToRepresentedStage

- Runs on the day the representment is processed. Before this stage, `PaymentRepresentmentValidationActivityGroup` re-checks that the representment is still valid to execute.
- Sends the re-attempted payment for clearing and, in parallel, notifies the downstream systems once it is re-presented — via `PaymentRepresentmentExecutionActivityGroup`.
- Updates the transaction to `REPRESENTED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and publishes a `REPRESENTED` event to Lumi via RTF.

### RepresentingToDeclinedStage

- Declines a representment that fails the processing-day re-validation.
- Updates the transaction to `DECLINED` (enriching it) and publishes a `DECLINED` event to Lumi via RTF.

## Get Corporate Payment Allocations

### ToAllocatingStage

- Asks the allocations manager for the payment's breakdown into allocations, via `PaymentAllocatingActivityGroup`.
- Marks the parent payment `ALLOCATING`: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Publishes an `ALLOCATING` event to Lumi via RTF.
- The workflow then waits for the allocations-ready signal before moving to the next stage.

### AllocatingToAllocatedStage

- Records the allocations received back from the allocations manager, via `PaymentAllocatedActivityGroup`.
- Marks the parent payment `ALLOCATED` (the transaction-detail row is updated and a new transaction-lifecycle-event row is added) and publishes an `ALLOCATED` event to Lumi via RTF.
- Creates the split legs in the `ACCEPTED` state in the split transaction-detail and split transaction-lifecycle-event tables, via `PaymentSplitsCreationActivity`, publishing each split's lifecycle event.
- The workflow then triggers Execute Split Payment for each split leg.

## Process Inbound Payment

### InitiatedToPendingStage

- Persists the inbound (third-party push) payment in the transaction-detail, transaction-lifecycle-event, and idempotency tables. If the insert fails on a duplicate index, the request is a repeat, and the workflow returns the existing payment.
- On success the payment is stored as `PENDING`, and a `PENDING` event is published to Lumi via RTF. This is the same stage as in Create Immediate Payment.

### PendingToAcceptedStage

- Moves the inbound payment from `PENDING` to `ACCEPTED` once `PaymentValidationActivityGroup` confirms Amex accepts it, enriching the attributes an accepted payment needs.
- Updates the transaction to `ACCEPTED`: the transaction-detail row is updated and a new row is added to the transaction-lifecycle-event table.
- Publishes an `ACCEPTED` event, with the enriched data, to Lumi via RTF.

### AcceptedToProcessingStage

- Sends the payment for clearing to the bank (via MR/M3).
- Sends it to Accounts Receivable (AR) to reduce the statement balance.
- Sends it to Authorizations (AMP) to increase Open-To-Buy.
- In the generic case these three run in parallel, but this varies by `accountType` and `requiresRealtimeClearing`.
- Updates the transaction to `PROCESSING` (enriching it as it goes) and publishes a `PROCESSING` event to Lumi via RTF.
- **Note:** the logic can differ for RTP versus non-RTP payments.

### ProcessingToProcessedStage

- Sends the payment to the downstream systems that fulfill it: accounting, audit (Balance & Control / eBNC), risk, and communications (Raven).
- Communications comes last; the other notifications can run in parallel, and once they all complete the customer communication is triggered.
- Updates the transaction to `PROCESSED` (enriching it) and publishes a `PROCESSED` event to Lumi via RTF.
- **Note:** account-type-specific implementations may notify a different set of systems.

### PendingToDisallowedStage

- Records an inbound, third-party-initiated payment that American Express does not accept; `DISALLOWED` is the terminal state specific to inbound payments.
- Runs when `PaymentValidationActivityGroup` finds the inbound payment invalid.
- Updates the transaction to `DISALLOWED` (enriching it) and publishes a `DISALLOWED` event to Lumi via RTF.

---

See the [component model](./principles.md) for how stages sit between workflows and activity groups, and the [state model](./payment-state-model.md) for the states themselves.
