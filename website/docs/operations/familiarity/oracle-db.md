---
title: Oracle DB
description: 'Oracle holds every payment, and it is also the only hand-off between the two Temporal clusters.'
---

import Lead from '@site/src/components/Lead';

# Oracle DB

<Lead>Oracle holds every payment, and it is also the only hand-off between the two Temporal clusters. Escalate Oracle issues on <code>#oracle-dbo-support</code>.</Lead>

## What Oracle holds that Temporal doesn't

- The truth about every payment. One row in `trans_dtl` is a payment's current state, and its timeline in `trans_lfcyc_event` records every step and the cluster that ran it.
- Dated work. A scheduled payment has no workflow until its due date. Until then it is a payment row and a `SCHED_EXEC` row in `work_tracker`, so a question about a payment due next week is answered in Oracle, not in Temporal.
- The hand-off between clusters. A payment accepted or scheduled on the Online cluster reaches the Offline cluster as a Work Tracker row, written in the same commit as its state change. Nothing calls across.
- The control tables the dispatchers and the governor run on, and the exception list ([Dispatch Controls](./dispatch-controls.md)).

Only Billpay's stores read or write these tables (`PaymentStore` for payment state, and one store each for the Work Tracker, allocation batches, the market config and the control tables), and each operation is one transaction. [Build → Database](../../build/database.md) lists the tables.

## During patching

A short outage or a patching window doesn't fail payments:

- A database call runs as a local activity on its first 2 attempts, inside the workflow task.
- If both fail, the call runs again as a regular activity, the first retry after 6 seconds, doubling to at most 45 minutes apart, for a few hours if need be. The payment pauses and resumes when Oracle is back, even across a worker restart.
- The governor sees the Oracle errors and stops dispatching, so only payments already in flight wait.
- On the Online cluster, Capture has a short deadline, so a caller gets a quick error rather than a long wait.

Escalate only if the outage will outlast a database call's schedule-to-close, which is a few hours. Past that, its retries run out, and each waiting payment's Work Tracker row goes `FAILED` and the payment onto the exception list. [Oracle patching](../sops.md#oracle-patching) has the steps.

## Where it runs

The read/write primary is in IPC2, with two read-only replicas beside it. IPC1 holds the Data Guard standby and one more read-only replica. Promoting the standby is an operator's decision, never automatic. [High Availability](../../architecture/high-availability.md#oracle) has the full picture.
