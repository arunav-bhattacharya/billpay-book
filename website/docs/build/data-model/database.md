---
title: Database
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database

<Lead>One row in <code>trans_dtl</code> is the truth about a payment's current state. Everything else in the schema is either an append-only log of how it got there, a guard against processing it twice, or a tracker for the events and notifications still owed. Learn those four roles and the schema stops needing a diagram.</Lead>

## The tables

| Table | Role | Written by |
| --- | --- | --- |
| `trans_dtl` | **Current state.** One row per payment — the status a workflow reads and every stage updates. | `PersistPendingPaymentActivity` creates it; `PaymentStateTransitionActivity` moves it. |
| `trans_lfcyc_event` | **The audit log.** Append-only — a new row for every state a payment has ever been in. Never updated, only added to. | Same two activities, one row per transition. |
| `split_trans_dtl` | Current state at the **split leg** level (corporate allocations, consumer splits). | `PaymentSplitsCreationActivity` creates the legs; `PaymentSplitStateTransitionActivity` moves them. |
| `split_trans_lfcyc_event` | The append-only log at the split level. | Same, per split transition. |
| `idempotency_checker` | **The duplicate guard.** One row per API request; the unique constraint is the check. | Create paths via `PersistPendingPaymentActivity`; mutate paths via `IdempotencyCheckActivity`. |
| `ORIG_TRANS_REFER_MAP` | Links a replacement payment to the original when Update Payment cancels-and-recreates — the audit trail across payment ids. | `MapNewPaymentIdToPreviousIdActivity`. |
| External Transaction Events Tracker | Records the **clearing-settlement** and **AR-posted** events per payment; a payment closes to `PAID` only when both are present. Rows get flagged "picked-up-for-processing" so a sweep never double-reads. | The event-handler functions write; the Paid Events sweeps read and flag. |
| Notification tracker | One row per outbound notification the execution and fulfillment steps owe a downstream system. | `PaymentExecutionActivityGroup` and `PaymentFulfillmentActivityGroup`, per notification. |

Column-level definitions are still settling and are deliberately not documented here — treat this as the authoritative *set of tables and responsibilities*, and the code's `Table` objects as the current truth for columns.

## How the code sees it

Each table has exactly one [Exposed](../principles/tech-stack/orm.md) `Table` object — `TransDtl`, `TransLfcycEvent`, `IdempotencyChecker`, and so on — and those objects are the only place column names appear in Kotlin. Activities open one `transaction { }` per call; workflow code never touches any of this (determinism — the [rule](../principles/core-build/workflows.md) is absolute).

## Three Oracle habits to internalise

- **The unique index is the idempotency check.** Nobody SELECTs to see if a request was seen before — we insert, and `ORA-00001` on the duplicate *is* the answer. First write wins with no race window; the losing request reads back the original outcome.
- **Partitions are how the logs stay finite.** The lifecycle-event and notification logs only grow, so they're range-partitioned by event date and `DataPurgingWF` retires whole partitions — dropping a partition is instant; deleting a billion rows is not.
- **The primary is for payments.** Reporting and analytics run against read replicas. If your query doesn't advance a payment, it doesn't belong on the primary.
