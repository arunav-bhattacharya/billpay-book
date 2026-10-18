---
title: Dispatch Controls
description: 'Operators steer offline work through a few Oracle tables, an ops API and the Temporal Schedules, never by reaching into a running workflow.'
---

import Lead from '@site/src/components/Lead';

# Dispatch Controls

<Lead>Operators steer offline work through a few Oracle tables, an ops API and the Temporal Schedules, never by reaching into a running workflow. A new rate reaches the dispatchers within seconds, and every rate the governor sets can be explained afterwards.</Lead>

[Design → Pacing](../../design/pacing.md) explains how the dispatchers and the governor work. This page is about the handles an operator has on them.

## Where a piece of dated work is

Every piece of dated work is a row in `work_tracker`, and its status says where it is:

- `SCHEDULED`: waiting for its due time.
- `DISPATCHING`: claimed by a dispatcher run, named in `run_id`. A row left here by a run that died is picked up by that run's sweep or by the next run.
- `DISPATCHED`: its workflow has started, so look in the Offline cluster's [Temporal Web UI](./temporal-web-ui.md).
- `DONE`: the workflow's last commit closed it.
- `FAILED`: retries ran out, or the Router refused to start it because its market was taken out of service after the row was written. Either way the retries-exhausted alert fires.
- `CANCELLED`: the payment was cancelled while its row waited, in the same commit that cancelled it.

`dispatch_run` has a row per dispatcher run: its counts, its current rate, and whether it is paused. It is the quickest answer to "is the scheduled-payments run for DE moving?".

## Overrides

The governor writes each traffic class's rate into `rate_allocation`, and the dispatchers read it every few seconds. An override is a row in the same table, written through an ops API, for a traffic class, a market or a corporate payment. It can pause, resume, or set a maximum rate, and it always wins over the governor.

- Because the dispatchers read the table, an override lands within seconds, with no signal sent and nothing added to any workflow's history.
- Raising the rate override is one of the answers to a [SEPA cutoff at risk](../sops.md#sepa-cutoff-at-risk). It spends the database headroom the governor was keeping.
- Remove an override once it has done its job. While it is there, it wins.

## Pausing

There are three ways to pause, from the narrowest:

- A traffic class, a market or one corporate payment: a pause override in `rate_allocation`.
- A dispatcher or a periodic job: pause its Temporal Schedule, which stops new runs.
- A whole live market: pause it in billpay-ui, which stops the market's dispatchers through the provisioning API. Its config doesn't change.

In every case nothing is lost. Due work waits in Oracle, pulled work waits in One-Data's inbox, and workflows already running carry on.

## Why the governor did that

`governor_decision` keeps every 15-second check: the inputs the governor read and the rates it set. When a rate drops, the row for that moment shows which signal was the worst and what budget followed from it. `downstream_limit` shows the same picture per downstream: its agreed TPS, the online margin, the current offline share, any cap on Online, and the last 429.

The governor has guardrails of its own. With metrics missing it holds rates, and after 5 minutes drops every class to its floor. If the governor itself stops, the dispatchers fall back to their floors once `rate_allocation` is 5 minutes old, and a Schedule starts the governor again.

## The exception list

Billpay keeps its own list of payments and legs whose retries ran out, in `exception_list`. `PaymentStore` adds the row in the same commit that gives up and marks the Work Tracker row `FAILED`, so the two always agree. Each row holds the stage and status the payment stopped in, the last error, and who resolved it and when.

- Business failures never land here. A closed account or insufficient funds ends a payment `DECLINED`, which is an answer, not an exception.
- Neither do RTF or Raven outages. Their calls have a long schedule-to-close, so payments wait for them instead.
- A corporate leg on the list keeps its parent in `PROCESSING` until operations resolve it.

Each row is resolved by hand. Once the cause is fixed, someone reprocesses the payment's workflow so it carries on, or terminates the workflow to stop the payment where it is, and the row records who resolved it and when. [Retries exhausted](../sops.md#retries-exhausted) has the steps.
