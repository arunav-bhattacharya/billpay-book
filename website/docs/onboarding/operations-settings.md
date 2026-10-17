---
title: Operations Settings
description: 'The Operations step in billpay-ui sets how a market runs from day to day. Each setting drives something specific at runtime.'
sidebar_label: Operations Settings
---

import Lead from '@site/src/components/Lead';

# Operations Settings

<Lead>The Operations step in billpay-ui sets how a market runs from day to day: when its payments execute, how long a customer can cancel, and how hard Billpay should push to meet a cutoff. Each setting drives something specific at runtime.</Lead>

None of these settings is a code change. They travel in the market's release like the rest of its profile, and they take effect when that release is activated.

| Setting | Used by | What it controls |
| --- | --- | --- |
| Time zone and execution time | The scheduled-payments dispatcher's Schedule | When the market's due payments start executing. The Schedule takes the market's time zone, so the execution time holds across daylight saving |
| Cancellation window | Cancel and update | How long a customer can still change or cancel a scheduled payment. It closes before execution starts, and a late request gets 409. A corporate payment closes sooner if its allocations are requested first |
| Cutoff, if any | The governor's cutoff floor and alert | The time the market's execution must finish by. SEPA markets have a cutoff of three to four hours; the US has none |
| Allocation fetch timing and alert point | The `ALLOC_REQUEST` due time, and the late-allocation alert | When to ask for a scheduled corporate payment's allocations (on the due date, or a set number of hours or days before it), and when to raise an alert if they haven't arrived. The request also ends cancel and update for that payment |
| Representment rules | The representment date | When a returned payment can be presented again: today or later |
| Expected volumes | The governor's floors and budgets | How much execution work to plan for |
| BOTH rules, per behavior | The Router | Which journeys get Y for a behavior set to BOTH |

## Why some of these matter more than they look

The cancellation window and the execution time have to agree. The window must close before the dispatcher starts executing, so a cancel and an execution never race for the same payment. If they ever did, the guarded update would still let only one win, but the customer would see a 409 they didn't expect.

The cutoff decides how the governor treats a market. A SEPA market with a three-hour cutoff gets a floor rate, the remaining payments divided by the time left minus 30 minutes, so its run aims to finish half an hour before the cutoff. Online traffic still comes first: if online response times or Oracle degrade, every offline class is cut, this one included, and the cutoff alert fires when the run falls behind. The US has no cutoff, and its execution gets a fixed floor of 50 TPS instead. The [governor](../design/pacing.md#the-governor) explains how the floors are handed out.

Daylight saving deserves a test of its own: run the market's Schedules through both transition weekends before it goes live.

## Still open

Execution runs every day. A market that skips holidays will need a holiday calendar in its dispatcher.
