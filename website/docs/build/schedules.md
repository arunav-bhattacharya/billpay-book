---
title: Schedules
sidebar_label: Schedules
---

import Lead from '@site/src/components/Lead';

# Schedules

<Lead>The periodic workflows do not run on cron jobs bolted to a host. They run on <strong>Temporal Schedules</strong>, registered with the cluster and durable like everything else. If the worker fleet restarts, the schedules carry on.</Lead>

## Schedule → workflow

All of these fire on the **Offline worker**, because nothing here has a user waiting.

| Schedule | Triggers | What it drives |
| --- | --- | --- |
| Schedule Payment Executor | `ExecuteScheduledPaymentWF` | Scheduled payments whose run date has arrived. |
| Corporate Allocations Processor | `ExecuteSplitPaymentWF` | Corporate allocation legs ready to process. |
| Paid Events Processor | `PaidEventsProcessingWF` | Closes payments to `PAID` once **both** the settlement and AR-posted events are in the tracker. |
| Missing Paid Events Processor | `MissingPaidEventsProcessingWF` | Payments still missing a settlement or AR-posted event after 48 hours. It recovers the event from the owning system, or raises an alert. |
| Data Purge | `DataPurgingWF` | Retires old rows from the transactional tables by dropping date partitions, per the [database conventions](./data-model/database.md). |

The spec also describes a **Scheduled Representments Executor**, which batches returned payments due for re-presentment the same way. It has not been added to the spec's schedule table yet. Treat it as the sixth member of this set.

## The batching rhythm

Executors work in waves rather than draining everything at once. They pick up **2,500 items, spread over the next minute, then the next 2,500 a minute later**. The cadence is deliberate. It turns a morning spike of due payments into a flat, predictable load on the Offline worker and every downstream system behind it, and it means a stuck batch delays the next wave rather than swallowing the whole backlog.

## Build-time wiring

Schedules are configuration, registered with the Temporal cluster when the Offline worker deploys. That makes changing a cadence a code-reviewed, versioned change like any other, not a box someone edits in a console. What each periodic workflow actually does, step by step, is in [Design → Periodic Workflows](../design/workflows/periodic.md). Where each schedule fires in the life of a payment is in [Design → System Initiated Journeys](../design/journeys/system-initiated.md).
