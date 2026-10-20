---
title: Pacing
description: 'The pacing view shows whether offline work is moving at the rate it should, and what is holding it back when it is not.'
sidebar_label: Pacing
---

import Lead from '@site/src/components/Lead';

# Pacing: the Governor and Dispatchers

<Lead>The pacing view shows whether offline work is moving at the rate it should, and what is holding it back when it is not. At midnight that is the question that matters: not whether something is down, but whether each run will finish in time.</Lead>

Most of what the view shows, the governor and the dispatchers already write down. The four control tables in Oracle are listed on [Database](../../build/database.md#work-and-config-tables); this page is about reading them. How the pacing itself works is in [Design → Pacing](../../design/pacing.md).

## Rates by traffic class

`rate_allocation` holds the rate the governor gave each traffic class, market or corporate payment, and any manual override. `governor_decision` keeps every 15-second check with its inputs and its outputs, so a rate can always be explained afterwards. Three patterns are worth knowing on sight:

- A class sitting at its floor. The governor is holding or cutting, and the decision row says which signal made it.
- An override in force. Manual overrides always win over the governor, so a forgotten one quietly caps a run.
- `rate_allocation` more than 5 minutes old. The governor has stopped, and every dispatcher has dropped to its floor. The governor-down alert fires at the same point.

## Backlogs and in-flight work

`dispatch_run` has a row per dispatcher run, with its counts, its current rate and whether it is paused.

For the Work Tracker dispatchers, the view sets two numbers side by side: the due rows still waiting to be claimed, and the work in flight against the dispatcher's cap. In-flight work is the rate times the time each payment takes. At 50 TPS and 6 seconds a payment, about 300 payments are open. If a downstream slows to 30 seconds, the same rate would mean 1,500. The cap stops that: the dispatcher waits instead, and the real rate settles at the cap divided by the time per payment. So a run that has slowed down while sitting at its cap is being held back by something downstream, not by the governor.

The inbox dispatchers (AR intake, returns and inbound) have no in-flight cap. Their backlog is the `READY` requests waiting in One-Data's inbox, and what matters is its age. The `PAID` drain's backlog is the `READY` rows for `PAID`. The returns and `PAID` backlog-age alerts watch both ([Kibana Alerts](../alerts/kibana.md#backlogs)).

## Cutoff projections

For each SEPA market in its window, the view shows two lines:

- The projected finish: now, plus the work remaining divided by the current rate.
- The cutoff floor: the work remaining divided by the time left less 30 minutes. The governor holds the run at or above it, so the run finishes 30 minutes before its cutoff.

The cutoff alert fires when the projected finish passes the cutoff minus 15 minutes, or when the floor no longer fits the budget. The US run has no cutoff, so it shows its 50 TPS floor instead.

## Downstream limits

`downstream_limit` has a row per downstream endpoint, showing:

- its agreed TPS
- the online margin
- the current offline share
- any cap on Online, and when it ends
- the last 429

Read it with the task queues on [Temporal Health](./temporal-health.md):

- When 429s pass 1% of a queue's calls, or the downstream's p99 doubles, the queue's limit drops to 70% of what it was, then probes back up 5% at a time. A 429 on an Online call halves that downstream's offline share instead. Neither cut takes a SEPA run below its need.
- A queue down to 1 request a second is a downstream outage.
- Two hours before each SEPA run, the governor compares Online's peak for the run's hours over the last four weeks with each downstream's agreed TPS less the run's need, and warns when Online is likely to be capped.

## Payments waiting on RTF or Raven

RTF and Raven calls must succeed, so when either is down nothing fails: payments wait in Fulfil, short of `PROCESSED`, and other announcements wait in their workflows. On this view that looks like in-flight work climbing to the cap while nothing finishes. Once the cap fills, the Work Tracker dispatchers stop, and the governor stops the inbox dispatchers too, which is how an RTF outage can cost a SEPA run its cutoff. The RTF or Raven down alert fires after 5 minutes of failed calls.

What to change, and how, is under [Operations → Dispatch Controls](../../operations/familiarity/dispatch-controls.md).
