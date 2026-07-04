---
title: Periodic Workflows
sidebar_label: Periodic
---

import Lead from '@site/src/components/Lead';

# Periodic Workflows

<Lead>Scheduler-driven workflows that run in waves on the Offline worker. Temporal Schedules trigger them in batches — for example, picking up 2,500 scheduled payments a minute, then the next 2,500 a minute later.</Lead>

## Scheduled Payments Executor

Triggers `#ExecuteScheduledPaymentWF` in batches for payments that are due to run.

## Corporate Allocations Processor

Triggers `#ExecuteSplitPaymentWF` in batches for corporate allocations.

## Scheduled Representment Executor

Triggers representment execution in batches for returned payments due to be re-attempted.

## Paid Events Processing — `#PaidEventsProcessingWF`

Finds payments in the External Transaction Events Tracker that have both the clearing-settlement and the AR-posted event, marks them picked up, moves them to `PAID`, and publishes the `PAID` lifecycle event.

## Missing Paid Events Processing — `#MissingPaidEventsProcessingWF`

Finds payments still missing a settlement or AR-posted event after 48 hours, queries the owning system for the current status, and either records the events or raises an alert.

## Data Purger — `#DataPurgingWF`

Purges older records from the transactional tables.
