---
title: Schedules
description: 'Nothing in Billpay runs on a cron job bolted to a host.'
sidebar_label: Schedules
---

import Lead from '@site/src/components/Lead';

# Schedules

<Lead>Nothing in Billpay runs on a cron job bolted to a host. Every timed start is a <strong>Temporal Schedule</strong> on the Offline cluster, durable like everything else, so a restart of the worker fleet doesn't lose a trigger.</Lead>

Schedules start three kinds of work: the dispatchers, which release payments at the governor's pace; the governor itself; and the periodic jobs, such as `ProcessPaidEventsWorkflow`, which moves payments to `PAID`. Which Schedule starts which workflow, and how often, is in [Design → Periodic and Control Workflows](../design/component-model/workflows/periodic.md). This page covers how to set them up.

## Settings every Schedule shares

- Overlap policy SKIP. A trigger that fires while the last run is still going does nothing, so a slow run never stacks up behind itself. That is how `ProcessPaidEventsWorkflow` can fire every 30 seconds and still only ever have one run.
- For the dispatchers, a catch-up window of 6 hours, so a trigger missed during an outage still fires when the cluster is back.
- A run's workflow ID is its Schedule's ID plus the trigger time Temporal appends, such as `dispatch-sched-DE` and the time, so every run can be found from its Schedule.
- Each dispatcher runs its activities on its own control queue, such as `ctl-sched` or `ctl-repr`, and has its own budget from the governor. One kind of work can't hold up another.

A minute Schedule starts a short run: it drains what is due, continues-as-new while work remains, and ends when a claim comes back empty. The governor's Schedule works differently, because the governor is meant to run all the time. Its Schedule only starts it again if it isn't running.

There is no batching to tune here. The pace comes from the governor, which sets every dispatcher's rate every 15 seconds ([Design → Pacing](../design/pacing.md)), not from how often a Schedule fires.

## Market Schedules

The scheduled-payments and representment dispatchers run per market, at the market's own times. Their Schedules aren't written by hand, and they don't ship with a deploy. They arrive in a market release from billpay-ui:

1. [The onboarding workflow](../onboarding/market-onboarding-api.md) saves the release with its Schedules, inactive.
2. When the release is activated, the Schedules go live with it.
3. A rollback switches back to the previous version's Schedules and settings.

A market's Schedule takes its time zone, so the execution time holds across daylight saving. Test the daylight-saving weekends. The US market runs on Phoenix time, which has no daylight saving, so its run starts at 00:01 MST all year. Execution runs every day: no market keeps a holiday calendar.

Pausing a live market stops its dispatchers, through the Market Onboarding API's pause and resume, and pausing a Schedule stops new runs too.
