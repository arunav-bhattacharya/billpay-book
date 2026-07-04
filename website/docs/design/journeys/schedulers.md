---
title: Schedules to Workflow Mapping
sidebar_label: Schedulers
---

import Lead from '@site/src/components/Lead';

# Schedules to Workflow Mapping

<Lead>Temporal Schedules drive the periodic workflows, all on the Offline worker. Each schedule fires its workflow in batches.</Lead>

| Schedule | Workflow |
| --- | --- |
| Schedule Payment Executor | `#ExecuteScheduledPaymentWF` |
| Corporate Allocations Processor | `#ExecuteSplitPaymentWF` |
| Paid Events Processor | `#PaidEventsProcessingWF` |
| Missing Paid Events Processor | `#MissingPaidEventsProcessingWF` |
| Data Purge | `#DataPurgingWF` |

See [Periodic Workflows](../workflows/periodic.md) for what each one does.
