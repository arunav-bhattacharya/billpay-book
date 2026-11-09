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
- A run's workflow ID is the workflow ID set in the Schedule's start action, plus the trigger time Temporal appends, so every run can be found from its Schedule. Proposed names (2026-11-07):

| Schedule | Starts |
| --- | --- |
| `scheduled-payments-{market}-{accountType}` | `dispatch-scheduled-payments-{market}-{accountType}` |
| `scheduled-payments-{market}-{accountType}-late`, every 15 minutes (Proposed, 2026-11-08) | `dispatch-scheduled-payments-{market}-{accountType}-late` |
| `representments-{market}` | `dispatch-representments-{market}` |
| `allocation-requests`, `allocated-payments`, `allocation-legs` (Proposed, 2026-11-08) | `dispatch-allocation-requests`, `dispatch-allocated-payments`, `dispatch-allocation-legs` |
| `ar-intake`, `returns`, `inbound` | `dispatch-ar-intake`, `dispatch-returns`, `dispatch-inbound` |
| `paid-drain` | `paid-drain` (2026-11-08) |
| `missing-paid-events`, hourly | `missing-paid-events` (2026-11-08) |
| `purge-transaction-data`, daily at 02:00 UTC | `purge-transaction-data` |

- Each dispatcher runs its activities on its own control queue, such as `ctl-sched`, `ctl-alloc`, `ctl-allocated`, `ctl-leg`, `ctl-intake`, `ctl-return`, `ctl-inbound` or `ctl-repr`, and has its own budget from the governor. One kind of work can't hold up another.

A minute Schedule starts a short run: it drains what is due, continues-as-new while work remains, and ends when a claim comes back empty. The governor's Schedule works differently, because the governor is meant to run all the time. Its Schedule only starts it again if it isn't running.

There is no batching to tune here. The pace comes from the governor, which sets every dispatcher's rate every 15 seconds ([Design → Pacing](../design/pacing.md)), not from how often a Schedule fires.

## Market Schedules

The scheduled-payments dispatcher runs per market and account type, at the time each release sets, and the representment dispatcher per market (agreed 2026-11-07). Their Schedules aren't written by hand, and they don't ship with a deploy. They arrive in a market release from the Market Onboarding UI:

1. [The onboarding workflow](../onboarding/market-onboarding-api.md) saves the release with its Schedules, inactive.
2. When the release is activated, the Schedules go live with it.
3. A rollback switches back to the previous version's Schedules and settings.

Each release sets `timeZone`, an IANA zone such as `America/Phoenix`, and `executionTime`, `HH:mm`, local midnight when unset (agreed 2026-11-07). A Schedule takes its time zone, so the execution time holds across daylight saving. Test the daylight-saving weekends: on the Temporal dev server (1.32.2), a Schedule at local midnight in `Europe/London` fires one extra run at 00:00Z on 2027-10-31, which is 01:00 BST, just before the clocks go back. That run finds nothing due and ends after its sweep, so it does no harm, but check the production server's version before a market with daylight saving relies on Schedules. The US market runs on Phoenix time, which has no daylight saving, so its run starts at 00:01 MST all year. Execution runs every day: no market keeps a holiday calendar.

Until market activation creates the Schedules, billpay-offline creates any that are missing from the active config every 15 seconds, and tests create them paused (Proposed, 2026-11-07).

Each scheduled-payments Schedule has a late companion, `scheduled-payments-{market}-{accountType}-late`, every 15 minutes, for rows that fall due after the day's run, such as an AR payment dated today; a late run that finds nothing due sweeps and ends (Proposed, 2026-11-08). The two never run at once (agreed 2026-11-08): a late run that fires while the day's run is going ends at once, and a late run still going at the execution time finishes first, then the day's run starts. To tell, a scheduled-payments run calls `ScheduleActivities.running` on `ctl-sched` as it starts, which asks the server whether the companion Schedule has a run going; a day's run waiting for a late run checks again every 10 s. Each sync updates the late Schedules' action as it does the day Schedules', so a changed dispatcher input reaches Schedules that already exist (Proposed, 2026-11-08).

Pausing a live market stops its dispatchers, through the Market Onboarding API's pause and resume, and pausing a Schedule stops new runs too.
