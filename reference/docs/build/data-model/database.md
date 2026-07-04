---
title: Database
sidebar_position: 2
---

# Database Schema

The Oracle schema that backs Billpay. One row in `trans_dtl` is the source of truth for a payment; everything else is either an append-only log of how it got there, a queue that schedules its movement, or a tracker for events / notifications that still need to land.

:::note[Placeholder]
Each table below is documented as a placeholder. Detailed column-by-column schema (data types, constraints, indexes, partition keys, retention) is coming soon — likely auto-generated from the `Exposed` schema definitions in code.
:::

## `trans_dtl`

The **current state** of each payment. One row per payment, mutated as the workflow advances.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: payment-id (PK), status, account-id, amount, currency, source, frequency, created-at, updated-at, … |

## `trans_lfcyc_event`

**Append-only** lifecycle event log per payment — every state transition for every payment, in order. The audit trail.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: event-id (PK), payment-id (FK → trans_dtl), from-status, to-status, event-time, actor, payload, … |

## `split_trans_dtl` + `split_trans_lfcyc_event`

Same pair as above, but at the **split-instruction** level — for payments broken into multiple legs (e.g. corporate allocations).

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | `split_trans_dtl`: split-id (PK), parent payment-id (FK), status, amount, allocation-key, … |
| _placeholder_ | _placeholder_ | `split_trans_lfcyc_event`: event-id (PK), split-id (FK), from-status, to-status, event-time, payload, … |

## `card_acct`

**Account-details repository** — cached card-account metadata Billpay needs to make routing and validation decisions without round-tripping to the system of record on every request.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: account-id (PK), account-type, market, currency, status, last-synced-at, … |

## `idempotency_checker`

Guards **duplicate requests at the API boundary** — first-write wins, retries are rejected with the original outcome.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: idempotency-key (PK), api-name, payment-id, response-snapshot, created-at, … |

## `notification_tracker`

Durable record of **every external notification we owe** — outbound webhooks, lifecycle event publishes — with retry state.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: notification-id (PK), payment-id (FK), target-system, payload, status, attempt-count, last-attempt-at, next-retry-at, … |

## `orig_trans_refer_map`

Maps a **replacement payment back to the original** — used by `#UpdatePaymentWF` to preserve the audit chain when a scheduled payment is replaced.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: new-payment-id (PK), original-payment-id (FK), replaced-at, reason, … |

## `external_trans_events_tracker`

Tracks **Clearing/Settlement** and **AR-Posted** events for each payment so the **Paid Events Processor** can close it out once both have arrived.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: tracker-id (PK), payment-id (FK), ar-posted-at, settled-at, picked-up-at, status, … |

## `trans_exec_queue`

The **scheduler work queue** — payments that are due to be picked up and executed by a batch worker (e.g. scheduled payments at their fire time).

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: queue-id (PK), payment-id (FK), fire-at, status (`QUEUED` / `PICKED` / `DONE`), worker-id, … |

## `trans_exec_context`

The **execution context** that schedulers attach to each queued transaction — payload and resume state the batch workflow needs to pick up where the realtime side left off.

| Column | Type | Notes |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | Columns: context-id (PK), queue-id (FK → trans_exec_queue), payload (JSON), created-at, … |
