---
title: Temporal Web UI
description: 'Each Temporal cluster has its own Web UI, so the first thing to know about a workflow is which cluster ran it.'
---

import Lead from '@site/src/components/Lead';

# Temporal Web UI

<Lead>Each Temporal cluster has its own Web UI, so the first thing to know about a workflow is which cluster ran it. A payment's timeline in Oracle names the cluster for every step, and its workflow IDs follow from its payment ID.</Lead>

## Finding a payment's workflows

Every workflow ID is the payment ID plus a suffix: `{paymentId}-init` for the create, `{paymentId}-execute` for a scheduled execution, `{paymentId}_{seq}-execute` for a leg, and so on. [Workflow IDs](../../design/routing.md#workflow-ids) lists them all. So with a payment ID and the cluster, you can open the workflow directly, without searching.

Histories are kept for 30 days. After that the workflow is gone from the UI, but Oracle still has the payment and every step of its timeline.

## Searching

Every payment workflow sets its search attributes once, when it starts: `PaymentId`, `Market`, `Journey`, `DueDate`, `ConfigVersion`, and `ParentPaymentId` for a leg. They answer questions like these:

- Every workflow for one payment: search by `PaymentId`.
- Every leg of a corporate payment: search by `ParentPaymentId`.
- Everything a market ran on one date: search by `Market` and `DueDate`.
- Payments started on a particular release of a market's config: search by `ConfigVersion`.

Dispatcher runs are named for their Schedule, such as `dispatch-sched-DE`, plus the trigger time Temporal appends. The governor runs as `governor`, also with its trigger time.

## What you won't find

- A scheduled payment before its due date. It has no workflow yet: it waits in Oracle as a Work Tracker row, and the scheduled-payments dispatcher starts its workflow on the day. Look in Oracle instead ([Oracle DB](./oracle-db.md)).
- Work waiting in One-Data's inbox, such as a return that hasn't been pulled yet.
- Signals. No payment workflow takes one. A confirm or a cancel is a workflow of its own, such as `{paymentId}-confirm`, not a message to a workflow that is already running.

Workflow payloads show as plain data because the [Codec Server](../../deployment/deployables/codec-server-app.md) decrypts them.
