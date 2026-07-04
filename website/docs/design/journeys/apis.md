---
title: API to Workflow Mapping
sidebar_label: APIs
---

import Lead from '@site/src/components/Lead';

# API to Workflow Mapping

<Lead>Between the core APIs and the workflows sits the Billpay Router. It reads the payment date, the number of instructions, and the market's dimensions, fetches the right stages, and invokes the workflow.</Lead>

The path a request takes: One-Data function → core API → **Billpay Router** → workflow → stages, activity groups, and activities.

| One-Data function | Core API | Router condition | Parent workflow | Child workflows |
| --- | --- | --- | --- | --- |
| `CreatePayment.v3` | `POST /payments` | today, single instruction | `#CreateImmediatePaymentWF` (Online) | Consumer: `#ExecuteSplitPaymentWF` (Online). Corporate: `#GetCorporatePaymentAllocationsWF` + `#ExecuteSplitPaymentWF` (Offline) |
| | | today, multiple instructions | `#CreatePaymentWithMultipleInstructionsWF` (Online) | |
| | | future-dated | `#CreateSchedulePaymentWF` (Online) + `#ExecuteScheduledPaymentWF` (Offline) | Consumer: `#ExecuteSplitPaymentWF` (Offline). Corporate: `#GetCorporatePaymentAllocationsWF` + `#ExecuteSplitPaymentWF` (Offline) |
| `UpdatePayment.v1` | `PUT /payments/{payment-id}` | by dimensions | `#UpdatePaymentWF` (Online) | |
| `DeletePayment.v1` | `DELETE /payments/{payment-id}` | by dimensions | `#CancelPaymentWF` (Online) | |
| `MoneyMovementEventListener.v1` | `POST /payments/returns` | by dimensions | `#ProcessReturnedPaymentWF` (Offline) | `#ProcessRepresentmentWF` (Offline) |
| `CreateInboundPayment.v1` | `POST /payments/inbound` | by dimensions | `#ProcessInboundPaymentWF` | |
| `CreatePaymentIntent.v1` | `POST /payments/intent` | by dimensions | `#CreatePaymentIntentWF` (Online) | |
| `CreateBillpayTransactionFromAccountsReceivable.v1` *(transactionType = PAYMENT)* | `POST /payments` | future-dated, single instruction | `#CreateSchedulePaymentWF` + `#ExecuteScheduledPaymentWF` (Offline) | Consumer: `#ExecuteSplitPaymentWF` (Offline). Corporate: `#GetCorporatePaymentAllocationsWF` + `#ExecuteSplitPaymentWF` (Offline) |

Every workflow is passed the stage and activity-group implementations that match the market's dimensions, so the same route behaves correctly across markets.
