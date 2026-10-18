---
title: Kibana
description: 'Every alert Billpay raises, what fires it, and what people do when it does.'
---

import Lead from '@site/src/components/Lead';

# Kibana Alerts

<Lead>Every alert Billpay raises, what fires it, and what people do when it does. Where the action takes more than a sentence, the alert links to its runbook in [SOPs](../../operations/sops.md).</Lead>

Escalation paths, and the steps to acknowledge and resolve an alert in Kibana, are still to be written up.

## Pacing and the platform

| Alert | Fires when | People do |
| --- | --- | --- |
| SEPA cutoff at risk | The projected finish passes the cutoff minus 15 minutes, or the cutoff floor no longer fits the budget | Raise downstream limits or the rate override, or accept the delay. [Runbook](../../operations/sops.md#sepa-cutoff-at-risk) |
| Online capped | A SEPA run caps Online on a downstream, or the cap warning says one is likely | Raise that downstream's agreed TPS if it happens often |
| Offline DB hot | Offline Aurora CPU stays above the governor's cut band for 15 minutes | Look at what is running, and whether the bands need tuning |
| Governor down | `rate_allocation` is 5 minutes stale, so dispatchers have fallen back to their floors | Find why the governor stopped, if the Schedule's restart doesn't hold |
| Downstream outage | A `ds-*` queue drops to its probe of 1 request a second | Contact the downstream's owner if it lasts |
| RTF or Raven down | Their calls have failed for 5 minutes, so payments are waiting in Fulfil | Contact the owner. Payments resume when they are back |
| Offline cluster down | The Offline cluster stops answering | Restore the cluster, or promote its standby. [Runbook](../../operations/sops.md#offline-cluster-down) |

## Payments that need a person

| Alert | Fires when | People do |
| --- | --- | --- |
| Late allocations | A corporate payment is still `ALLOCATING` at the market's alert point | Chase the allocation source. [Runbook](../../operations/sops.md#late-allocations) |
| Retries exhausted | A Work Tracker row goes `FAILED`, or a payment lands on the exception list | Review the exception list. [Runbook](../../operations/sops.md#retries-exhausted) |
| Payment not PAID | A payment (other than a split parent) or a leg is still `PROCESSED` after 48 hours, or an inbox row has stayed `UNMATCHED` for 48 hours, which One-Data's `UpdateUnmatchedPayments.v1` raises | Read the inbox row for the missing event, or check the event's IDs against Oracle. [Runbook](../../operations/sops.md#a-payment-not-paid-after-48-hours) |
| Event without a payment | An event with no payment ID matches no payment through `ReadPayments.v1`, or more than one | Find the payment and replay the event through its handler. [Runbook](../../operations/sops.md#an-event-that-matches-no-payment) |
| Rejected request | A dispatcher marks a pulled request `REJECTED`, because nothing live matches its market, account type or API | Fix the market profile. The sender is not told. [Runbook](../../operations/sops.md#a-rejected-request) |
| Release failed provisioning | `MarketProvisioningWorkflow` stops before activation | Fix the profile, or ship the build it needs. [Runbook](../../operations/sops.md#a-release-failed-provisioning) |

## Backlogs

| Alert | Fires when | People do |
| --- | --- | --- |
| Returns backlog age | The oldest return waiting in One-Data's inbox passes its age threshold (Proposed: checked by `UpdateUnmatchedPayments.v1`) | Check whether higher priorities are holding the queue |
| PAID backlog age | The oldest `READY` row in the inbox passes its age threshold (Proposed: checked by `UpdateUnmatchedPayments.v1`) | Check whether the governor is holding the drain, or RTF is down. [Runbook](../../operations/sops.md#paid-backlog-age) |

Returns sit at the lowest priority, so during an execution window they can wait behind everything else. That is fine for work nobody is waiting on, and the age alert keeps a long wait from going unnoticed.

## One-Data and pending payments

| Alert | Fires when | People do |
| --- | --- | --- |
| Pending entry age | An entry in One-Data's account hash passes its set age, which is longer than both a normal workflow and the confirmation window | Find where it is stuck, in Redis or in billpay-core, and send the create again with the same ID |
| Creates held for RTF | One-Data's hand-offs to RTF jump from near zero | Check billpay-core and the Online cluster. A jump here is usually the first sign of trouble there |
| Delete calls failing | billpay-core's delete calls to One-Data keep failing | Fix One-Data's delete API. Until then, customers get go-ahead steps they don't need |
| Redis memory or write errors | Redis memory is near its limit, or a write fails | Fix it before One-Data has to create payments without the pending check |
