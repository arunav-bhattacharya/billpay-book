---
title: Periodic Workflows
sidebar_label: Periodic
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';
import ScheduleTable from '@site/src/components/ScheduleTable';

# Periodic Workflows

<Lead>Two kinds of thing run on a timer here: **schedules** that re-trigger core workflows in waves, and a few **standalone workflows** that reconcile settlement and tidy up. All of it runs on the Offline worker, with no end user waiting.</Lead>

For where these fire in the life of a payment, see the system-started journeys on [Journeys](../../journeys/index.md).

## Schedule to workflow

A Temporal Schedule is a timer the cluster owns, not a workflow of its own. Each one fires on its cadence and starts the workflow below.

<ScheduleTable
  rows={[
    {schedule: 'Scheduled Payments Executor', workflow: 'ExecuteScheduledPaymentWF'},
    {schedule: 'Corporate Allocations Processor', workflow: 'ExecuteSplitPaymentWF'},
    {schedule: 'Paid Events Processor', workflow: 'PaidEventsProcessingWF'},
    {schedule: 'Missing Paid Events Processor', workflow: 'MissingPaidEventsProcessingWF'},
    {schedule: 'Data Purge', workflow: 'DataPurgingWF'},
  ]}
/>

A sixth schedule, the **Scheduled Representments Executor**, finds returned payments due to be re-attempted and triggers their representment execution. The spec lists it among the periodic workflows but has not added it to the schedule table, so the workflow it starts is not yet named.

The first three executors work in batches rather than starting everything at once. How that batching is configured is on [Build → Schedules](../../../build/schedules.md).

- The **Scheduled Payments Executor** finds payments whose run date has arrived and are still `SCHEDULED`.
- The **Corporate Allocations Processor** drains the corporate allocations that are ready.

## Paid Events Processing

<WorkflowMeta worker="Offline" behaviors="generic" />

Closes a payment out to the terminal `PAID` state, but only once **both** halves of settlement have been confirmed. Billpay does not mark a payment paid on the strength of one event. It waits for the money to settle at the bank *and* for Accounts Receivable to post it.

1. Find every payment in the External Transaction Events Tracker that has received **both** its clearing-settlement event and its AR-posted event.
2. Mark those rows "Picked-up-for-processing" in the tracker, so a later run does not pick them up again.
3. Insert a `PAID` entry into the Transaction Lifecycle Event table.
4. Update the payment's status to `PAID` in the Transaction Detail table.
5. Publish the `PAID` lifecycle event.

## Missing Paid Events Processing

<WorkflowMeta worker="Offline" behaviors="generic" />

Catches payments that stalled on their way to `PAID` because an expected event never arrived, and either recovers the event or flags it.

1. Find every payment in the External Transaction Events Tracker that is still missing its clearing-settlement event, its AR-posted event, or both, after 48 hours.
2. Ask the system that owns the missing event for the latest status.
   - If it has the event, insert it into the tracker so Paid Events Processing can finish the payment.
   - If it is still missing, raise an alert for someone to investigate.

## Data Purger

<WorkflowMeta worker="Offline" behaviors="generic" />

Keeps the transactional tables from growing without bound.

1. Find older records in the database that are past their retention window.
2. Delete those records.
