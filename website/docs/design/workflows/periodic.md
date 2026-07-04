---
title: Periodic Workflows
sidebar_label: Periodic
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Periodic Workflows

<Lead>Two kinds of thing run on a timer here: **schedules** that re-trigger core workflows in waves, and a few **standalone workflows** that reconcile settlement and tidy up. All of it runs on the Offline worker, with no end user waiting.</Lead>

## Scheduler-driven executors

These are Temporal Schedules rather than workflows of their own. Each fires on a timer and hands work to a core workflow in batches — for example, picking up 2,500 payments a minute, then the next 2,500 a minute later.

- **Scheduled Payments Executor** — finds payments whose run date has arrived (still `SCHEDULED`) and triggers Execute Scheduled Payment for each.
- **Corporate Allocations Processor** — drains the corporate allocations that are ready and triggers Execute Split Payment for each.
- **Scheduled Representment Executor** — finds returned payments due to be re-attempted and triggers their representment execution.

## Paid Events Processing

<WorkflowMeta worker="Offline" dimensions="generic" />

Closes a payment out to the terminal `PAID` state — but only once **both** halves of settlement have been confirmed. Billpay does not mark a payment paid on the strength of one event; it waits for the money to settle at the bank *and* for Accounts Receivable to post it.

1. Find every payment in the External Transaction Events Tracker that has received **both** its clearing-settlement event and its AR-posted event.
2. Mark those rows "Picked-up-for-processing" in the tracker, so a later run does not pick them up again.
3. Insert a `PAID` entry into the Transaction Lifecycle Event table.
4. Update the payment's status to `PAID` in the Transaction Detail table.
5. Publish the `PAID` lifecycle event.

## Missing Paid Events Processing

<WorkflowMeta worker="Offline" dimensions="generic" />

Catches payments that stalled on their way to `PAID` because an expected event never arrived, and either recovers the event or flags it.

1. Find every payment in the External Transaction Events Tracker that is still missing its clearing-settlement event, its AR-posted event, or both, after 48 hours.
2. Ask the system that owns the missing event for the latest status.
   - **Found** — insert the corresponding event into the tracker, so Paid Events Processing can finish the payment.
   - **Still missing** — raise an alert for someone to investigate.

## Data Purger

<WorkflowMeta worker="Offline" dimensions="generic" />

Keeps the transactional tables from growing without bound.

1. Find older records in the database that are past their retention window.
2. Delete those records.
