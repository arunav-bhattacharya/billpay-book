---
title: Schedules
sidebar_label: Schedules
---

import Lead from '@site/src/components/Lead';

# Schedules

<Lead>The periodic workflows are driven by **Temporal Schedules** — each registered with the cluster and firing its workflow in waves on the Offline worker.</Lead>

| Schedule | Triggers |
| --- | --- |
| Schedule Payment Executor | `ExecuteScheduledPaymentWF` — scheduled payments due to run. |
| Corporate Allocations Processor | `ExecuteSplitPaymentWF` — corporate allocations ready to process. |
| Paid Events Processor | `PaidEventsProcessingWF` — close payments out to `PAID` once both settlement events have arrived. |
| Missing Paid Events Processor | `MissingPaidEventsProcessingWF` — recover or flag payments missing a settlement or AR-posted event. |
| Data Purge | `DataPurgingWF` — purge older records from the transactional tables. |

Each executor picks work up in batches — for example, 2,500 scheduled payments a minute, then the next 2,500 a minute later. A **Scheduled Representments Executor** — driving representment execution in the same batched way — is described alongside these in the spec but is not yet in the schedule table; it belongs in the same set.

See [Design → Periodic Workflows](../design/workflows/periodic.md) for what each workflow does.
