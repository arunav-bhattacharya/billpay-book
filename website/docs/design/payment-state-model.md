---
title: Payment State Model
description: 'Every payment, consumer or corporate, moves through one set of states, and a status changes only through a guarded update in Oracle.'
sidebar_label: State Model
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Lead from '@site/src/components/Lead';
import StateLegend from '@site/src/components/StateLegend';

# Payment State Model

<Lead>Every payment, consumer or corporate, moves through one set of states, and a status changes only through a guarded update in Oracle. Each state means the same thing in every market, so reporting, operations and downstream systems can read any payment the same way.</Lead>

## The lifecycle

Each arrow is a move one stage makes, and the label names the stage. Consumer and corporate payments share one set of states. A corporate payment adds two, `ALLOCATING` and `ALLOCATED`, while its allocations are fetched, and the toggle shows the path each kind takes. A payment that waits for a date spends that time as `SCHEDULED`, a row in Oracle with nothing running in Temporal.

<Tabs groupId="payment-type" className="toggle-tabs">
<TabItem value="consumer" label="Consumer" default>

```mermaid
---
config:
  nodeSpacing: 40
  rankSpacing: 34
---
stateDiagram-v2
  direction TB
  [*] --> PENDING: Capture
  PENDING --> ACCEPTED: Verify, pay today or inbound
  PENDING --> SCHEDULED: Verify, future date
  PENDING --> DECLINED: Verify fails
  PENDING --> DISALLOWED: Verify, inbound not accepted
  SCHEDULED --> ACCEPTED: Reverify, on the due date
  SCHEDULED --> DECLINED: Reverify fails
  SCHEDULED --> CANCELLED: Cancel, inside the window
  ACCEPTED --> PROCESSING: Execute
  PROCESSING --> PROCESSED: Fulfil
  PROCESSED --> PAID: Settle
  PROCESSING --> RETURNED: Return
  PROCESSED --> RETURNED: Return
  PAID --> RETURNED: Return
  RETURNED --> REPRESENTING: QueueRepresentment
  REPRESENTING --> REPRESENTED: Represent
  REPRESENTING --> DECLINED: Recheck fails
  REPRESENTED --> RETURNED: Returned again
  PAID --> [*]
  RETURNED --> [*]
  REPRESENTED --> [*]
  DECLINED --> [*]
  CANCELLED --> [*]
  DISALLOWED --> [*]
```

</TabItem>
<TabItem value="corporate" label="Corporate">

```mermaid
---
config:
  nodeSpacing: 40
  rankSpacing: 34
---
stateDiagram-v2
  direction TB
  [*] --> PENDING: Capture
  PENDING --> ACCEPTED: Verify, pay today
  PENDING --> SCHEDULED: Verify, future date
  PENDING --> DECLINED: Verify fails
  ACCEPTED --> ALLOCATING: RequestAllocations, pay today
  SCHEDULED --> ALLOCATING: RequestAllocations, at the fetch time
  SCHEDULED --> CANCELLED: Cancel, inside the window
  ALLOCATING --> ALLOCATED: ReceiveAllocations, the batches add up
  ALLOCATED --> PROCESSING: Execute, pay today
  ALLOCATED --> ACCEPTED: Reverify, scheduled
  ALLOCATED --> DECLINED: Reverify fails
  ACCEPTED --> PROCESSING: Execute, scheduled
  PROCESSING --> PROCESSED: Completion check
  PROCESSING --> RETURNED: Return
  PROCESSED --> RETURNED: Return
  RETURNED --> REPRESENTING: QueueRepresentment
  REPRESENTING --> REPRESENTED: Represent
  REPRESENTING --> DECLINED: Recheck fails
  REPRESENTED --> RETURNED: Returned again
  PROCESSED --> [*]
  RETURNED --> [*]
  REPRESENTED --> [*]
  DECLINED --> [*]
  CANCELLED --> [*]
```

A corporate payment fetches its allocations before it moves money. Paid today, it asks right after `ACCEPTED`. Scheduled, it asks at the market's fetch time and is reverified once `ALLOCATED`. The parent clears once and reaches `PROCESSED` through the leg dispatcher's completion check instead of Fulfil, and stays there: its legs turn `PAID`, never the parent. [Corporate payments](#corporate-payments) below has the rules.

</TabItem>
</Tabs>

<StateLegend />

There is no path from `ACCEPTED` to `CANCELLED`. Once a payment has left `SCHEDULED` it can no longer be cancelled, and a corporate payment leaves it when its allocations are requested.

## What each state means

| State | Meaning | Terminal? |
| --- | --- | --- |
| `PENDING` | Captured in Billpay, idempotency checked, waiting for validation. | No |
| `SCHEDULED` | Validated and waiting in Oracle for its due date, as a Work Tracker row. | No |
| `ACCEPTED` | Validated (on the day, for a scheduled payment) and ready to move money. A corporate payment paid today requests its allocations first. | No |
| `ALLOCATING` | A corporate payment whose allocations have been requested from the allocations manager. Batches may be arriving. | No |
| `ALLOCATED` | A corporate payment whose batches add up to its amount, ready to execute: at once if it was paid today, at its execution time if it was scheduled. | No |
| `PROCESSING` | Being executed: clearing with the bank, the Accounts Receivable (AR) balance reduced, open-to-buy raised. | No |
| `PROCESSED` | Clearing, AR, open-to-buy, accounting, eBNC and risk have all succeeded, and the lifecycle event (RTF) and the customer's message (Raven) have gone out. | No |
| `REPRESENTING` | A returned payment queued for another presentment, on the date the market's rules set. | No |
| `PAID` | Settled with the bank and posted to Accounts Receivable. | Yes, unless a return arrives |
| `RETURNED` | The payment did not settle; the customer's bank sent the funds back. | Yes, unless it is represented |
| `REPRESENTED` | A returned payment that was presented again. | Yes, unless it is returned again |
| `DECLINED` | Failed validation, or a representment failed its recheck. | Yes |
| `CANCELLED` | Withdrawn while `SCHEDULED`, inside the market's cancellation window. | Yes |
| `DISALLOWED` | A third-party inbound payment that American Express did not accept. | Yes |

`PROCESSED` is a higher bar than it looks. A payment reaches it only after every must-succeed system has answered and the customer has been told, which is why an outage at RTF or Raven holds payments at `PROCESSING` rather than letting them through with a gap.

## Which stage makes each move

| From | To | By |
| --- | --- | --- |
| Input | `PENDING` | Capture |
| `PENDING` | `ACCEPTED`, `SCHEDULED` or `DECLINED` | Verify |
| `PENDING` (inbound) | `ACCEPTED` or `DISALLOWED` | Verify |
| `SCHEDULED` | `ACCEPTED` or `DECLINED` | Reverify, on the due date; a corporate payment goes through `ALLOCATED` first |
| `SCHEDULED` | `CANCELLED` | Cancel, inside the cancellation window only |
| `SCHEDULED` (corporate) | `ALLOCATING` | RequestAllocations, at the market's fetch time |
| `ACCEPTED` (corporate, pay today) | `ALLOCATING` | RequestAllocations, at once |
| `ALLOCATING` | `ALLOCATED` | ReceiveAllocations, once the batches add up to the payment amount |
| `ALLOCATED` (scheduled) | `ACCEPTED` or `DECLINED` | Reverify, at the execution time |
| `ALLOCATED` (pay today) | `PROCESSING` | Execute |
| `ACCEPTED` | `PROCESSING` | Execute |
| `PROCESSING` | `PROCESSED` | Fulfil; for a corporate parent, the leg dispatcher's completion check |
| `PROCESSED` | `PAID` | Settle, in `ProcessPaidEventsWorkflow`; for a split payment, each leg, never the parent |
| `PROCESSING`, `PROCESSED` or `PAID` | `RETURNED` | Return |
| `RETURNED` | `REPRESENTING` | QueueRepresentment |
| `REPRESENTING` | `REPRESENTED` or `DECLINED` | Represent |
| `REPRESENTED` | `RETURNED` | Return, when it is returned again |

The [stages](./component-model/stages.md) page says what each stage calls on the way.

## Guarded updates

Two things can try to move the same payment at once, such as a customer's cancel and the payment's execution, right at the edge of the cancellation window. Billpay settles that race in Oracle instead of in code.

Every status change is a conditional update on the current status:

```sql
UPDATE trans_dtl SET status = 'CANCELLED'
 WHERE payment_id = :id AND status = 'SCHEDULED'
```

When two writers race, one updates the row and the other sees zero rows updated. At the edge of the cancellation window either Cancel or Reverify wins, never both. A cancel that loses gets 409, or its earlier answer again if the payment is already `CANCELLED`. The loser backs off, and nothing has to be undone.

A corporate payment's allocation request races a cancel the same way. Both are guarded on `SCHEDULED`, so a payment is either cancelled or asked for its allocations, never both.

## Split payments

A split payment divides one amount into legs. Each leg is its own record, with the ID `{paymentId}_{seq}`, and it starts at `ACCEPTED`: a leg is only ever made from a parent that Verify has already passed. From there a leg moves through the same states as any payment, `PROCESSING`, `PROCESSED` and on.

`PAID` is set on legs, never on the parent. The bank settles a split payment once, as a whole, while Accounts Receivable posts each leg on its own. So each leg turns `PAID` once its own posting and its parent's settlement are both in, and the parent stays `PROCESSED`. That holds for consumer and corporate splits alike.

The [Domain Model](./domain-model.md) shows how the code models a leg as its own set of classes.

## Corporate payments

A corporate payment is paid once, as one amount, and the allocations manager supplies its breakdown into allocations. Billpay fetches that breakdown before the payment moves money, and `ALLOCATING` and `ALLOCATED` record how far it has got. The two kinds differ only until the payment is `ALLOCATED`:

| | Pay today | Scheduled |
| --- | --- | --- |
| States | `ACCEPTED` → `ALLOCATING` → `ALLOCATED` → `PROCESSING` | `SCHEDULED` → `ALLOCATING` → `ALLOCATED` → `ACCEPTED` → `PROCESSING` |
| Allocations requested | At once | At the market's fetch time: on the due date, or a set number of hours or days before it |
| Executed | At once, once `ALLOCATED` | At the execution time on the due date, once `ALLOCATED`, after Reverify |

No workflow waits for the allocations, and no workflow starts the next step itself. Each step is a Work Tracker row in Oracle that a dispatcher picks up, and from `ALLOCATED` on both kinds take the same steps:

- The parent clears once, at payment level. If its allocations are late, it waits in `ALLOCATING`, and an alert fires at the market's alert point.
- Once its allocations are requested, the payment is no longer `SCHEDULED`, so a cancel or an update gets 409.
- Legs are written when the parent's Execute commits, from the batches stored in `allocation_batch`. A declined parent never gets legs.
- The parent turns `PROCESSED`, by a guarded update, once it has cleared and every leg is `PROCESSED` or `PAID`, and its own RTF event and Raven message have gone out. The leg dispatcher checks this every 60 seconds; there is no Fulfil for a corporate parent.
- Legs turn `PAID` one by one, each once the parent has settled and the leg's own AR posting is in. The parent stays `PROCESSED`.
- A leg whose retries run out goes on the exception list, and its parent stays `PROCESSING` until operations resolve it.

[Corporate Allocations](./corporate-allocations.md) follows the flow step by step. [Core Workflows](./component-model/workflows/core.md) lists which workflow drives each move, and the [sequence diagrams](./sequence-diagrams.md) trace the same flows call by call.
