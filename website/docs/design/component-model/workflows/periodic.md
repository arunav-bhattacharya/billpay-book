---
title: Periodic and Control Workflows
description: 'Temporal Schedules start everything periodic on the Offline cluster: the dispatchers that release offline work, the governor that paces them, and the jobs that mark payments paid and tidy up.'
sidebar_label: Periodic and Control
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';
import ScheduleTable from '@site/src/components/ScheduleTable';

# Periodic and Control Workflows

<Lead>Temporal Schedules start everything periodic on the Offline cluster: the dispatchers that release offline work, the governor that paces them, and three jobs that mark payments paid, chase missing confirmations and purge old data.</Lead>

A Schedule is a timer the cluster owns, not a workflow. It fires on its cadence and starts a short workflow run. No run works in fixed-size batches on a clock: dispatchers release work at the rate the governor sets, spread evenly, and the paid-events job takes batches at the governor's pace too.

## Schedule to workflow

<ScheduleTable
  rows={[
    {schedule: 'Scheduled payments, one per market and account type', workflow: 'The scheduled-payments dispatcher', runs: 'At the execution time its release sets, in its time zone, local midnight by default; drains, sweeps stragglers, then ends'},
    {schedule: 'Scheduled payments, late, one per market and account type (Proposed)', workflow: 'The scheduled-payments dispatcher, for rows due after the day\'s run, such as an AR payment dated today', runs: 'Every 15 minutes, never at the same time as the day\'s run'},
    {schedule: 'Allocation requests', workflow: 'The allocation-request dispatcher', runs: 'Every minute'},
    {schedule: 'Allocated payments', workflow: 'The allocated-payments dispatcher', runs: 'Every minute'},
    {schedule: 'Allocation legs', workflow: 'The leg dispatcher', runs: 'Every minute'},
    {schedule: 'Representments, one per market', workflow: 'The representment dispatcher', runs: 'Every 5 minutes (Proposed)'},
    {schedule: 'AR intake', workflow: 'The AR intake dispatcher', runs: 'Every minute'},
    {schedule: 'Returns', workflow: 'The returns dispatcher', runs: 'Every minute'},
    {schedule: 'Inbound', workflow: 'The inbound dispatcher', runs: 'Every minute'},
    {schedule: 'Governor', workflow: 'GovernorWorkflow', runs: 'Kept running; a check every 15 seconds'},
    {schedule: 'Paid events', workflow: 'ProcessPaidEventsWorkflow', runs: 'Every 30 seconds, overlap SKIP; a run drains the READY rows, then ends'},
    {schedule: 'Missing paid events', workflow: 'ProcessMissingPaidEventsWorkflow', runs: 'Hourly (Proposed)'},
    {schedule: 'Purge', workflow: 'PurgeTransactionDataWorkflow', runs: 'Daily at 02:00 UTC (Proposed)'},
  ]}
/>

Every Schedule lives on the Offline cluster. A scheduled-payments Schedule takes the time zone its release sets, so its execution time holds across daylight saving (agreed 2026-11-07). The Temporal dev server fires one harmless extra run as the clocks go back in `Europe/London`, so check the production server's version before a market with daylight saving relies on Schedules. The US runs on Phoenix time, which has no daylight saving, so its run starts at 00:01 MST all year. Execution runs every day, and no market keeps a holiday calendar. They use overlap policy SKIP and a 6-hour catch-up window, so a trigger missed during an outage still fires once the cluster is back.

## Dispatchers

There is one dispatcher per kind of work. Each one claims due Work Tracker rows from Oracle, or reads requests waiting in One-Data's inbox, and starts one workflow per item through the Router, at the governor's rate. Each has its own Schedule, control queue and budget, so one kind of work can't hold up another.

A run's workflow ID is `dispatch-` and its Schedule's ID, such as `dispatch-scheduled-payments-DE-CONSUMER` for the Schedule `scheduled-payments-DE-CONSUMER` (Proposed), plus the trigger time Temporal appends. A minute Schedule starts a short run that drains what is due, continues-as-new while work remains, and ends when a claim comes back empty. [Pacing](../../pacing.md) walks through a run tick by tick.

## Governor

<WorkflowMeta cluster="Offline" id="`governor`, plus its Schedule's trigger time" start="A Schedule with overlap SKIP, which starts it again if it stops" />

`GovernorWorkflow` resets every offline rate every 15 seconds from live signals: the Offline cluster's database CPU and persistence latency, schedule-to-start, online response times and Oracle. It raises rates slowly while everything is healthy, cuts fast when anything degrades, and hands the budget out by priority. It continues-as-new hourly and costs about 20 Temporal writes a minute. [Pacing](../../pacing.md#the-governor) has its rules.

## Process Paid Events

<WorkflowMeta cluster="Offline" id="`paid-drain`, its Schedule's ID, plus the trigger time" start="The `paid-drain` Schedule (Proposed), every 30 seconds, overlap SKIP" behaviors="generic" />

`ProcessPaidEventsWorkflow` marks payments `PAID`, and it decides when. The confirmations it needs, settlement from the bank and posting from Accounts Receivable (AR), don't arrive in Billpay's Oracle: Oracle only gets their timestamps, which Settle writes. One-Data's event handlers keep the events in its inbox, a Postgres database of its own. A handler only stores: it fills the event's time on the payment's, or leg's, row and marks the row `READY`, which means an event came in for Billpay to look at. Billpay reads those rows itself, over JDBC, at its own pace, and pairs the events (agreed 2026-11-24).

A payment needs its AR posting, and its settlement unless the settlement is known. A debit card, MR Points or inbound payment, and its legs, has a known settlement: the money moved at the card authorization, the points redemption or the third party's push. So it is paid on the posting alone, and Billpay sends no settlement event of its own. A Pay with Bank Transfer payment's settlement is M3's notice, which One-Data stores as the settlement; every other payment's comes from MR/M3.

Only one run is ever active. A run takes batches until the inbox has no `READY` rows left, then ends. Each batch:

1. Fetches up to 500 `READY` rows from One-Data's table, after moving `UNMATCHED` rows last tried over an hour ago, and under 48 hours old, back to `READY`. Fewer than 500 means this is the run's last batch; none ends the run.
2. Settles the batch in one `PaymentStore` transaction. Settle pairs the events and decides each row:
   - The posting and a settlement make the payment or leg `PAID`. A corporate leg reads its payment's settlement from the payment's own row, whatever that row's status.
   - The posting alone does too, where the settlement is known. The settlement time is then when the payment, or leg, turned `PROCESSING`.
   - A row still missing an event waits, as `WAITING`.
   - A row that could be paid, but has no `PROCESSED` payment or leg, is `UNMATCHED`, and comes back hourly for 48 hours.

   Each payment it pays gets a guarded update from `PROCESSED` to `PAID`, plus a `PAID` timeline row tagged with the batch ID. The workflow generates that ID with `Workflow.randomUUID()`, so a retried Settle uses the same one.
3. Announces: one `LifecycleEventActivities` call sends a `PAID` event to RTF for each payment or leg whose timeline row carries the batch ID.
4. Marks the rows `DONE`, `WAITING` or `UNMATCHED`. Each update is guarded on `READY` and on the times it read, so an event that came in meanwhile leaves the row `READY` for the next batch. A corporate payment's own row goes `DONE` once read; if it holds the settlement, the legs that posted first go back to `READY`, so the next fetch pays them.
5. Paces itself: it waits as long as the governor's rate for the `PAID` class asks, then fetches again. The run continues-as-new every 20 batches.

Proposed (2026-11-07): Settle is the drain's one Settle stage, taken without a profile, since it varies by nothing and the drain mixes markets. The run waits for a `PAID` rate above zero before each fetch, re-reading it every 5 seconds, and paces with rows ÷ rate. A row whose payment or leg an earlier batch already made `PAID` is marked `DONE`. The `PAID` timeline row holds the settlement and posting times and the batch ID; for a known settlement, its settlement time is the `PROCESSING` time, as on the payment.

Every step is safe to repeat. Settle changes only the rows that still need it, and a Settle that committed and is then retried still finds the payments it moved by their batch ID, so their events go out. Marking runs last, so a row is `DONE` only once its payment's event has gone out, and RTF's consumers already accept a repeated event.

When something goes wrong:

- If RTF is down, the run waits on its batch. Later triggers are skipped, and new rows wait in the inbox. Its inbox and RTF calls retry with no schedule-to-close, so a long outage never leaves payments `PAID` without their event (Proposed).
- A run terminated by hand between Settle and the announcement leaves its payments `PAID` without their event. The batch ID, in the run's history and on their timeline rows, says which payments to re-send.
- An `UNMATCHED` row, for a payment or leg that doesn't exist or isn't `PROCESSED` yet, comes back an hour later through the fetch. After 48 hours it stays `UNMATCHED`, and Billpay's gauge, `billpay_paid_unmatched_stale`, raises an alert.

A split payment turns `PAID` leg by leg. A corporate leg pays once it has posted and its parent's settlement is in, a consumer split's leg once it has its own (agreed 2026-11-07), and an inbound payment's leg once it has posted, since its settlement is known. The parent stays where it was: `PROCESSED` for a corporate payment, `ACCEPTED` for a consumer split. One corporate parent's settlement can wake up to 100K legs at once, and the drain takes them 500 at a time.

One run settles an estimated 1,000 payments a second, at about half a second a batch; load-test run 1 measures the real figure. Going faster would need lanes, with each fetch taking a lane number and filtering on a hash of the payment ID.

## Process Missing Paid Events

<WorkflowMeta cluster="Offline" id="`missing-paid-events`, its Schedule's ID, plus the trigger time" start="The `missing-paid-events` Schedule, hourly (Proposed)" behaviors="generic" />

`ProcessMissingPaidEventsWorkflow` chases confirmations that never came.

- It finds payments, and legs of split payments, that have been `PROCESSED` for more than 48 hours without turning `PAID`. Split parents are skipped, since only their legs turn `PAID`.
- It asks MR/M3 and GAR for the payment's current state (for a corporate leg, its payment's settlement and its own posting; for a consumer split's leg, its own) and hands any event it finds to its One-Data handler, so events reach the inbox only one way. An event the check still can't find raises an alert, and the payment's inbox row shows which one. The alert's counter, `billpay_paid_overdue_total`, counts only the payments and legs the check couldn't fix: if 100 are late and it finds the events for 95, it counts 5 (agreed 2026-11-07).
- Where the settlement is known, it asks GAR alone and hands over no settlement event: a debit card, MR Points, and an inbound payment and its legs, a consumer's and a corporate one's.
- It doesn't ask M3 about a Pay with Bank Transfer payment either. It asks GAR alone, since M3's notice came in before Execute ran.
- Proposed (2026-11-07): a run takes up to 500 payments and 500 legs, and its calls run at priority 5 with the fairness key `paid-check`.
- A row that has been `UNMATCHED` for 48 hours is left for a person. Replaying an event can't bring it back, because a repeated event changes nothing, so Billpay's alert names it.

## Purge Transaction Data

<WorkflowMeta cluster="Offline" id="`purge-transaction-data`, plus the trigger time" start="The `purge-transaction-data` Schedule, daily at 02:00 UTC (Proposed)" behaviors="generic" />

`PurgeTransactionDataWorkflow` removes old transactional data. Work Tracker rows go by dropping daily partitions 15 days after they fall due, so there are no mass `DELETE`s.

A partition past that date that still holds an unfinished row, `SCHEDULED`, `DISPATCHING` or `DISPATCHED`, is kept and logged, and dropped on a later run once those rows finish (agreed 2026-11-07). The job finds the partitions in Oracle's `ALL_TAB_PARTITIONS` and drops them with `UPDATE GLOBAL INDEXES` (Proposed, 2026-11-07). billpay-offline's database user gets the right to drop them (agreed 2026-11-07).

## Market Onboarding

`MarketOnboardingWorkflow`, with the ID `onboard-{market}-{accountType}-v{N}`, is the one control workflow an API starts rather than a Schedule. It checks, tests and activates a market release in its environment. [Market Onboarding API](../../../onboarding/market-onboarding-api.md) walks through its five steps.
