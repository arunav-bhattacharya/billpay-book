---
title: Database
---

import Lead from '@site/src/components/Lead';

# Database

<Lead>The persistence design covers four things for every payment: the state it is in now, the history of how it got there, a guard against handling the same request twice, and a record of what is still owed to other systems. Each has its own table or tracker.</Lead>

## Current state

`trans_dtl` holds one row per payment: the status every workflow reads and every stage updates. Split legs get the same treatment in `split_trans_dtl`, so a corporate allocation's state is tracked with exactly the discipline of its parent.

## The audit log

`trans_lfcyc_event` is the append-only history: a new row for every state a payment has ever been in, never updated, only added to. Its split-level twin is `split_trans_lfcyc_event`. Together with the published lifecycle events, this is what makes a payment auditable after the fact. The current row says *where* the payment is, and the log says *how* it got there.

`ORIG_TRANS_REFER_MAP` covers the one place history crosses payment ids: when Update Payment cancels a scheduled payment and creates its replacement, this map ties the new id back to the original.

## The duplicate guard

`idempotency_checker` takes one row per API request, guarded by a unique index. The create path inserts it together with the payment's first rows, and the mutate paths insert it alone. A duplicate insert *is* the duplicate check, and the repeat caller gets the original outcome.

## Events and notifications still owed

- The **External Transaction Events Tracker** records the two confirmations a payment needs before it counts as `PAID` (the clearing-settlement event and the AR-posted event) and flags rows once a sweep picks them up.
- The **notification tracker** records every outbound notification the execution and fulfillment steps owe downstream systems, one row per notification.

## Where the detail lives

Column-level schemas, the Oracle conventions (partition-based purging, the unique index that does the idempotency check), and how the code maps onto these tables through Exposed are covered in [Build → Data Model → Database](../build/data-model/database.md). Which activity writes which table is in [ActivityGroups & Activities](./component-model/activities.md).
