---
title: Temporal Web UI
description: 'Each Temporal cluster has its own Web UI, so the first thing to know about a workflow is which cluster ran it.'
---

import Lead from '@site/src/components/Lead';

# Temporal Web UI

<Lead>Each Temporal cluster has its own Web UI, so the first thing to know about a workflow is which cluster ran it. A payment's timeline in Oracle names the cluster for every step, and its workflow IDs follow from its payment ID.</Lead>

## Finding a payment's workflows

Every workflow ID is the payment ID plus a suffix: `{paymentId}-init` for the create, `{paymentId}-execute` for a scheduled execution, `{paymentId}_{seq}-execute` for a leg, and so on. [Workflow IDs](../../design/routing.md#workflow-ids) lists them all. So with a payment ID and the cluster, you can open the workflow directly, without searching.

A payment that waits for its customer, to confirm their bank details or to authenticate their debit card, has one workflow from the create to its end: `{paymentId}-init` on the Online cluster. Its history shows the wait as a timer, and the answer as an update with the ID `{paymentId}-confirm`, `{paymentId}-no` or, for the card provider's 3D Secure callback, `{paymentId}-authentication`. When the timer fires first, the history shows the cancel that followed.

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
- Signals. No payment workflow takes one. The confirm and the no reach a waiting payment as updates, and a cancel of a scheduled payment is a workflow of its own, `{paymentId}-cancel`.

Workflow payloads show as plain data because the [Codec Server](../../deployment/deployables/codec-server-app.md) decrypts them.
