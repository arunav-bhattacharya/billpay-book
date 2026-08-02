---
title: ActivityGroups & Activities
sidebar_label: ActivityGroups & Activities
---

import Lead from '@site/src/components/Lead';
import ActivityTable from '@site/src/components/ActivityTable';

export const ACTIVITIES = [
  {
    name: 'PersistPendingPaymentActivity',
    behaviors: [],
    transition: 'input → `PENDING`',
    does: [
      'Inserts the payment into the `idempotency_checker`, `trans_dtl` (transaction detail), and `trans_lfcyc_event` (transaction lifecycle event) tables.',
      'If a row is already present the request is a duplicate; otherwise it is a genuine first-time (idempotent) request.',
      'On success, publishes a `PENDING` lifecycle event.',
      'Invoked from `InitiatedToPendingStage`.',
    ],
  },
  {
    name: 'IdempotencyCheckActivity',
    behaviors: [],
    transition: 'None',
    does: [
      'Attempts to insert a row into the `idempotency_checker` table for the API being called.',
      'If the row already exists the request is a duplicate; if not, this is the first time the request has been seen.',
      'Invoked from any workflow that needs an idempotency check.',
    ],
  },
  {
    name: 'PaymentValidationActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing', 'requiresMandateAuthorization'],
    transition: '`PENDING` → `ACCEPTED` / `SCHEDULED` / `DECLINED`',
    does: [
      'Makes external calls where needed and evaluates the data to decide whether the payment is valid.',
      'A valid immediate payment becomes `ACCEPTED`; a valid future-dated payment becomes `SCHEDULED`; an invalid one becomes `DECLINED`.',
      'Invoked from the `CreateImmediatePaymentWF` and `CreateSchedulePaymentWF` workflows.',
    ],
  },
  {
    name: 'PaymentValidationOnExecutionActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing', 'requiresMandateAuthorization'],
    transition: '`SCHEDULED` / `ALLOCATED` → `ACCEPTED` / `DECLINED`',
    does: [
      'Runs when a scheduled payment is due to execute.',
      'Calls the systems needed to gather information that may have changed since scheduling. Some of those calls can only be made after data has come back from another system first.',
      'Checks whether the scheduled payment is still valid: still-valid becomes `ACCEPTED`, otherwise `DECLINED`.',
      'Invoked from `ExecuteScheduledPaymentWF`.',
    ],
  },
  {
    name: 'PaymentStateTransitionActivity',
    behaviors: [],
    transition: 'Various (payment level)',
    does: [
      'Given a payment id with its current and previous states, updates the `trans_dtl` table to the new status.',
      'Adds a new row to the `trans_lfcyc_event` table for that state.',
      'Publishes the matching lifecycle event.',
      'Invoked inside every stage that moves a payment between states at the payment level.',
    ],
  },
  {
    name: 'PaymentSplitStateTransitionActivity',
    behaviors: [],
    transition: 'Various (split level)',
    does: [
      'The split-level counterpart: updates the `split_trans_dtl` table to the new status for a split-payment id.',
      'Adds a row to the `split_trans_lfcyc_event` table.',
      'Publishes the split-level lifecycle event.',
      'Invoked inside every stage that handles split payments.',
    ],
  },
  {
    name: 'PaymentScheduledNotificationActivityGroup',
    behaviors: ['accountType', 'requiresArPosting'],
    transition: 'None',
    does: [
      'Notifies the relevant downstream systems once a payment has been scheduled.',
      'Invoked from `PendingToScheduledStage`.',
    ],
  },
  {
    name: 'PaymentDeclinedNotificationActivityGroup',
    behaviors: ['accountType', 'requiresArPosting'],
    transition: 'None',
    does: [
      'Notifies the relevant downstream systems when a payment is declined, whether that happened during an immediate payment or while it was being scheduled.',
      'Invoked from `PendingToDeclinedStage`.',
    ],
  },
  {
    name: 'PaymentAllocatingActivityGroup',
    behaviors: [],
    transition: '`PENDING` / `SCHEDULED` → `ALLOCATING`',
    does: [
      'Requests the allocations for a corporate payment.',
      'For a corporate immediate payment, the payment reaches `ACCEPTED` (by way of `ALLOCATING` and `ALLOCATED`) only once its allocations are fetched; if they cannot be fetched, it is `DECLINED`.',
      'For a corporate scheduled payment, it moves to `ALLOCATING` on the scheduled date, or a set number of days before it.',
      'Invoked from `ToAllocatingStage`.',
    ],
  },
  {
    name: 'PaymentAllocatedActivityGroup',
    behaviors: [],
    transition: '`ALLOCATING` → `ALLOCATED`',
    does: [
      'Receives the allocations back from GPA (Get Corporate Payment Allocations).',
      'The validation Billpay performs on the received allocations is still to be defined.',
      'Invoked from `AllocatingToAllocatedStage`.',
    ],
  },
  {
    name: 'PaymentExecutionActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing'],
    transition: '`ACCEPTED` → `PROCESSING`',
    does: [
      'Runs three actions in parallel, recording each in the notification tracker table: sends the payment to the clearing system, decreases the Accounts Receivable balance, and increases Open-To-Buy in Authorization.',
      'These steps can vary depending on the payment\'s behaviors.',
      'Invoked from `AcceptedToProcessingStage`.',
    ],
  },
  {
    name: 'PaymentFulfillmentActivityGroup',
    behaviors: ['accountType'],
    transition: '`PROCESSING` → `PROCESSED`',
    does: [
      'In parallel, notifies Accounting and Balance & Control, recording each in the notification tracker table.',
      'Then notifies Communications, also recorded in the notification tracker table.',
      'Invoked from `ProcessingToProcessedStage`.',
    ],
  },
  {
    name: 'PaymentSplitsCreationActivity',
    behaviors: [],
    transition: '`ACCEPTED` (full) → `ACCEPTED` (split)',
    does: [
      'For each split, creates a row in the split transaction-detail and `split_trans_lfcyc_event` tables in the `ACCEPTED` state.',
      'Publishes the split-level lifecycle event for that transition.',
      'Invoked from the `CreateImmediatePaymentWF`, `ExecuteScheduledPaymentWF`, `GetCorporatePaymentAllocationsWF`, and `ProcessInboundPaymentWF` workflows.',
    ],
  },
  {
    name: 'PaymentCancelValidationActivityGroup',
    behaviors: ['accountType'],
    transition: 'None',
    does: [
      'Checks the payment\'s current state in the database.',
      'If it is eligible, makes the external calls needed to confirm the cancellation is allowed, returning true when it is.',
      'Invoked from `CancelPaymentWF`.',
    ],
  },
  {
    name: 'PaymentCancellationActivityGroup',
    behaviors: ['accountType', 'requiresArPosting'],
    transition: '`SCHEDULED` / `ACCEPTED` → `CANCELLED`',
    does: [
      'Notifies the various downstream systems once a payment has been cancelled.',
      'Invoked from `CancelPaymentWF`.',
    ],
  },
  {
    name: 'PaymentReturnValidationActivity',
    behaviors: [],
    transition: 'None',
    does: [
      'Checks the returned payment\'s current state in the database, continuing only if it is valid.',
      'Invoked from `ProcessReturnedPaymentWF`.',
    ],
  },
  {
    name: 'PaymentReturnExecutionActivityGroup',
    behaviors: ['accountType'],
    transition: '`PROCESSING` / `PROCESSED` / `PAID` → `RETURNED`',
    does: [
      'Notifies the various downstream systems once a payment has been marked `RETURNED` in the database.',
      'Invoked from `ToReturnedStage`.',
    ],
  },
  {
    name: 'PaymentRepresentmentEligibilityActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing', 'requiresMandateAuthorization'],
    transition: 'None',
    does: [
      'Makes the external calls needed to decide whether a returned payment can be re-presented (retried for settlement).',
      'Returns true if it is eligible, false otherwise.',
      'Invoked from `ProcessReturnedPaymentWF`.',
    ],
  },
  {
    name: 'PaymentRepresentmentCreationActivityGroup',
    behaviors: [],
    transition: '`RETURNED` (presentment seq 1) → `REPRESENTING` (presentment seq 2)',
    does: [
      'Creates a new row in the `trans_dtl` and `trans_lfcyc_event` tables in the `REPRESENTING` status and publishes a lifecycle event.',
      'Takes the return from presentment sequence 1 (`RETURNED`) to sequence 2 (`REPRESENTING`).',
      'Invoked from `ReturnedToRepresentingStage`.',
    ],
  },
  {
    name: 'PaymentRepresentmentValidationActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing', 'requiresMandateAuthorization'],
    transition: 'None',
    does: [
      'Makes the external calls needed to confirm, on the day the representment is due to run, that it is still valid to execute.',
      'Returns true if so, false otherwise.',
      'Invoked from `ProcessRepresentmentWF`.',
    ],
  },
  {
    name: 'PaymentRepresentmentExecutionActivityGroup',
    behaviors: ['accountType', 'requiresArPosting', 'requiresRealtimeClearing', 'requiresMandateAuthorization'],
    transition: '`REPRESENTING` → `REPRESENTED`',
    does: [
      'Sends the payment to the clearing system.',
      'Then notifies the various downstream systems in parallel once it has been re-presented (`REPRESENTED`).',
      'Invoked from `RepresentingToRepresentedStage`.',
    ],
  },
  {
    name: 'MapNewPaymentIdToPreviousIdActivity',
    behaviors: [],
    transition: 'None',
    does: [
      'Writes a row into the `ORIG_TRANS_REFER_MAP` table linking the old and new payment ids.',
      'Preserves the audit trail when a scheduled payment is replaced by an updated one.',
      'Invoked from `UpdatePaymentWF`.',
    ],
  },
];

# ActivityGroups & Activities

<Lead>An activity is one retryable action: publish an event, persist a record, update a downstream balance. An activity group coordinates a set of them for a single business concern. Activities are shared across markets and stay thin, leaving protocol details to clients.</Lead>

Groups whose behavior varies by market carry their behaviors in the second column. The rest are generic and run the same way everywhere. Filter by a behavior to see only what changes when a market answers that question differently.

<ActivityTable rows={ACTIVITIES} />

For the layering that governs what may call what, see the [design principles](../principles.md).
