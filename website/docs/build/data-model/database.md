---
title: Database Schema
sidebar_label: Database
---

import Lead from '@site/src/components/Lead';

# Database Schema

<Lead>Billpay stores a payment's current state, an append-only event log, an idempotency guard, and the trackers used to reconcile settlement. The tables below are the ones the platform names; their column-level schemas are defined with the data model and are not finalised here.</Lead>

| Table | Holds |
| --- | --- |
| `idempotency_checker` | One row per API request. A duplicate insert means the request is a repeat; a successful insert means it's the first time it has been seen. |
| `trans_dtl` | The current detail and status of each payment. Updated on every payment-level state transition. |
| `trans_lfcyc_event` | The append-only lifecycle-event log for payments — a new row per state. |
| `split_trans_dtl` | The current detail and status of each split (allocation). |
| `split_trans_lfcyc_event` | The append-only lifecycle-event log at the split level. |
| `ORIG_TRANS_REFER_MAP` | Maps a replacement payment id to the original when a scheduled payment is updated, preserving the audit trail. |
| External Transaction Events Tracker | Records the external events — clearing-settlement and AR-posted — a payment needs before it can close out to `PAID`, and flags rows picked up for processing. |
| notification tracker | Records each outbound notification the execution and fulfillment steps send to a downstream system. |

Column definitions, types, and indexes are not specified in the source yet — treat the above as the set of tables and their responsibilities.
