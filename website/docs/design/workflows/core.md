---
title: Core Workflows
sidebar_label: Core
---

import Lead from '@site/src/components/Lead';

# Core Workflows

<Lead>The business workflows, one per request type. Each sequences the stages that move a payment through its lifecycle; the [state diagrams](../diagrams/state-diagram.md) show the transitions per workflow.</Lead>

## Create Immediate Payment — `#CreateImmediatePaymentWF`

*Online · dimensions: accountType, requiresArPosting, requiresRealtimeClearing, requiresMandateAuthorization*

Persist and idempotency-check the payment (`InitiatedToPendingStage`), validate it, and either decline it or accept it and return to the caller. After the early return it processes:

- **Corporate** — move to `PROCESSING`, fetch allocations via `#GetCorporatePaymentAllocationsWF`, wait for the *AllocationsReceived* signal, then run `#ExecuteSplitPaymentWF` per split.
- **Full consumer** — `AcceptedToProcessingStage`, then `ProcessingToProcessedStage`.
- **Split consumer** — create the split legs, then run `#ExecuteSplitPaymentWF` per leg.

## Create Schedule Payment — `#CreateSchedulePaymentWF`

*Online or Offline · dimensions: accountType, requiresArPosting, requiresMandateAuthorization*

Validate and park the payment at `SCHEDULED`, returning early. For a corporate payment, kick off `#GetCorporatePaymentAllocationsWF`. An invalid payment is declined.

## Execute Scheduled Payment — `#ExecuteScheduledPaymentWF`

*Offline · dimensions: all four*

Runs on the execution date. Re-validate the scheduled (or already-allocated) payment, accept it, then process it full or split — the same fan-out as the immediate flow.

## Execute Split Payment — `#ExecuteSplitPaymentWF`

*Online or Offline · dimensions: accountType, requiresArPosting, requiresRealtimeClearing*

Process one split leg: `AcceptedToProcessingStage`, then `ProcessingToProcessedStage`. For a corporate leg this means updating balances and Open-To-Buy; for a consumer leg it also clears.

## Cancel Payment — `#CancelPaymentWF`

*Online · dimensions: accountType, requiresArPosting*

Idempotency-check, validate the cancellation and read the current state, then cancel a `SCHEDULED` or `ACCEPTED` payment.

## Update Payment — `#UpdatePaymentWF`

*Online · dimensions: all four*

Cancel the original scheduled payment, build a replacement (new payment id, same confirmation number) through `#CreateSchedulePaymentWF`, and map the new payment back to the original for the audit trail.

## Process Returned Payment — `#ProcessReturnedPaymentWF`

*Offline · dimensions: accountType*

Validate the return against a `PAID`, `PROCESSING`, or `PROCESSED` payment and move it to `RETURNED`. If the return is representable, create a `REPRESENTING` transaction for `#ProcessRepresentmentWF`.

## Process Representment — `#ProcessRepresentmentWF`

*Offline · dimensions: all four*

Re-validate the representment and either settle it (`REPRESENTED`) or decline it.

## Get Corporate Payment Allocations — `#GetCorporatePaymentAllocationsWF`

*Offline · generic*

Request the allocation breakdown (`ToAllocatingStage`), wait for the *AllocationsReady* signal, mark the payment `ALLOCATED`, create the split legs, and run `#ExecuteSplitPaymentWF` for each.

## Process Inbound Payment — `#ProcessInboundPaymentWF`

*Offline*

Handle a third-party-initiated payment: validate, accept, and process it (full, or a consumer split). A payment Amex does not accept becomes `DISALLOWED`.

## Create Payment Intent — `#CreatePaymentIntentWF`

*Online · dimensions: accountType, instrumentType, requiresMandateAuthorization*

Registers an intent that only becomes a payment once the customer's financial institution confirms it. The detailed logic is still being defined in the spec.

## Create Balance Refund — `#CreateBalanceRefundWF`

*Online or Offline*

Sends money back to the customer from a credit balance, following the validate → process → fulfill path. The detailed logic is still being defined in the spec.
