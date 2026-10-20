---
title: Standard Operating Procedures
description: 'Runbooks for the scenarios that need a person.'
sidebar_label: SOPs
---

import Lead from '@site/src/components/Lead';

# Standard Operating Procedures

<Lead>Runbooks for the scenarios that need a person. Each one starts with what you see, says what Billpay is already doing about it, and ends with what is left for you to do.</Lead>

Most failures need nobody: payments wait out a slow downstream, a patch or a lost worker, and carry on. These are the cases that don't sort themselves out, or that need a decision. The alerts that lead here are in [Kibana Alerts](../observability/alerts/kibana.md).

## Oracle patching

During a patch, Oracle returns errors, the dispatchers stop claiming work, and payments in flight pause where they are.

Billpay is already handling it. `PaymentStore` retries short blips inside the workflow task, then waits on a durable timer and retries later, so a payment resumes when Oracle is back, even across a worker restart. The governor sees the errors and stops dispatching, so only payments already in flight wait. A caller creating a payment gets a quick error rather than a long wait.

1. For a planned window shorter than `PaymentStore`'s schedule-to-close, a few hours, do nothing.
2. If the window will run longer, raise it on `#oracle-dbo-support` before it does. Past the schedule-to-close, the waiting payments run out of retries and land on the exception list.
3. Afterwards, check that the dispatchers have resumed. The governor raises rates again in steps of 5% once its signals are calm, so the catch-up is gradual by design.

## Late allocations

The late allocations alert fires when a corporate payment is still `ALLOCATING` at its market's alert point.

The payment waits. Nothing clears and no leg runs until the last batch arrives, and a corporate payment can't be cancelled or updated once its allocations have been requested.

1. Chase the allocation source for the missing batches.
2. Once the batches add up to the amount, the payment commits `ALLOCATED` and the allocated-payments dispatcher starts its execution: at once for a payment made today, or at the execution time on its due date for a scheduled one, or at once if that time has passed. There is nothing to restart by hand.

## A release failed onboarding

The release failed onboarding alert fires when `MarketOnboardingWorkflow` stops before activation, and the readiness screen in the Market Onboarding UI shows the step it stopped at. A market that is already live keeps running on its active version, because the failed one was never activated.

1. Read the failed step and its reason in readiness.
2. If the check failed because the profile needs a behavior combination the deployed build can't run, either change the profile or ship the build that adds the combination. The onboarding workflow can't pass its first step until that build is deployed.
3. If the check failed because the market's cancellation window doesn't close before its execution time, fix the profile.
4. If the test payments failed, fix the profile. A release never changes once it is frozen, so a fixed profile goes out as the next version, through the same approval.

## SEPA cutoff at risk

The SEPA cutoff at risk alert fires when the projected finish (now, plus the work remaining divided by the current rate) passes the cutoff minus 15 minutes, or when the cutoff floor no longer fits the governor's budget.

The governor is already holding the run at or above its floor, and Online's response time can't push it below that. If Online would leave the run too little of a downstream, Online is already capped on it until the cutoff.

1. Open the [pacing view](../observability/monitoring/pacing.md) and find what is holding the run: a downstream at its limit, the Offline database (the governor cutting on CPU or persistence latency), or slow calls filling the in-flight cap.
2. If it is a downstream, agree a higher limit with its owner and raise it.
3. If it is the governor's budget, raise the rate override for the run ([Dispatch Controls](./familiarity/dispatch-controls.md#overrides)). That spends database headroom, so watch the Offline database while it is on.
4. Otherwise, accept the delay, and remove any override once the run has finished.

## Retries exhausted

The retries exhausted alert fires when a Work Tracker row goes `FAILED` or a payment lands on the exception list.

Billpay has already tried: every call retries from 1 second, doubling to at most 60, until its schedule-to-close runs out. Then `PaymentStore` marks the row `FAILED` and puts the payment on the exception list in the state it stopped in. Business failures never get here, because they end in `DECLINED`. Nor do RTF or Raven outages, because payments wait for those.

1. Read the payment's row in `exception_list`: the stage and status it stopped in, and the last error.
2. Fix the cause, which is often a downstream that kept failing. A row the Router refused is different: its market was taken out of service after the row was written.
3. Resolve the payment by hand. Reprocess its workflow so the payment carries on, or terminate the workflow to stop the payment where it is.
4. Record who resolved it and when, on the row. For a corporate leg, its parent stays `PROCESSING` until the leg is resolved.

## Offline cluster down

The Offline cluster down alert fires when the cluster stops answering.

- The Online cluster keeps serving, since nothing calls across.
- Dated work waits in Oracle, and pulled work in One-Data's inbox.
- Allocation callbacks get 503 with `Retry-After`, and the allocations manager sends them again.
- Running offline payments pause, their announcements included, and resume on the restored cluster.

1. Restore the cluster, or [promote its standby](#promoting-a-clusters-standby) if it can't come back in time.
2. Nothing needs replaying. Every history is in the cluster's database, so workflows resume where they stopped, and the dispatchers catch up at the governor's pace. A dispatcher trigger missed during the outage still fires, within its Schedule's 6-hour catch-up window.

## Promoting a cluster's standby

Promote a standby when its cluster can't be restored in time, or when all of us-east-1 is down. Promotion is always a decision someone makes: one write site at a time, the same rule as for Oracle.

1. Promote the us-west-1 standby of the cluster that is down. The Online and Offline clusters are promoted separately, each with its own database.
2. Point billpay-core's Temporal client for that cluster at the us-west-1 frontend.
3. Work picks up again on its own. Workflows carry on from the histories the standby received, including announcements they still owed, and the dispatchers start releasing due rows and pulling from One-Data's inbox.

[High Availability](../architecture/high-availability.md#when-us-east-1-goes-down) covers losing the whole region.

## PAID backlog age

The PAID backlog age alert fires when the oldest `READY` row in One-Data's inbox passes its age threshold.

The `PAID` drain comes last in the governor's order, and the Oracle signals cut it first, so it is meant to wait behind the execution windows.

1. Check whether the governor is holding the drain: its rate in the pacing view, and the latest `governor_decision` rows. During a busy window, it catches up afterwards.
2. Check RTF. If RTF is down, the drain's run waits on its batch, later triggers are skipped, and new rows wait in the inbox. Contact RTF's owner.
3. Don't terminate a drain run by hand. A run stopped between settling a batch and announcing it leaves those payments `PAID` with no event sent. If it happens, the batch ID in the run's history and on the payments' timeline rows says which events to send again.

## A payment not PAID after 48 hours

The payment not PAID alert fires when a payment or a leg is still `PROCESSED` after 48 hours, or when an inbox row has stayed `UNMATCHED` for 48 hours. Split parents are left out, since only their legs turn `PAID`.

Billpay has already looked. `ProcessMissingPaidEventsWorkflow` asks MR/M3, the clearing system, and GAR, the Accounts Receivable system, for the payment's current state, and hands any event it finds to One-Data's handler.

1. Read the payment's row in One-Data's inbox. It says which event is missing, the bank's settlement or AR's posting, or that it is `UNMATCHED`.
2. If an event is missing, chase it with the system that should have sent it.
3. If the row is `UNMATCHED`, check its IDs against Oracle: either no payment or leg has that ID, or the payment hadn't reached `PROCESSED` yet. Replaying the event won't help, because the inbox only moves rows that are still waiting.

## An event that matches no payment

The event without a payment alert fires when an event that carries no payment ID matches no payment through `ReadPayments.v1`, or matches more than one. The raw event stays in `billpay_extnl_event`, and nothing else happens.

1. Find the payment the event belongs to.
2. Replay the event through its One-Data handler, the same way MR/M3 or GAR would send it.

## A rejected request

The rejected request alert fires when a dispatcher marks a pulled request `REJECTED`, because nothing live matches its market, account type or API. The request stays `REJECTED`, and the sender is not told: only operations hear of it.

In production this shouldn't happen. Market profiles change rarely, every change is tested in the lower environments before it reaches production, and a new market's traffic is enabled only once its release is live there. So a rejection means traffic arrived out of step with that order.

1. Find which market, account type or API the request asked for.
2. Find out why it was sent: a sender sending for a market before its traffic was enabled, or asking for an account type or API the market's profile doesn't take.
3. If the profile is what has to change, the change goes out as a release like any other: tested in E1 and E2, then live in production.

## One-Data's inbox down

When One-Data's inbox database is down, One-Data can't store requests or events. Senders get errors and retry, and the dispatchers' and the drain's fetches retry too. Nothing new starts from the inbox, and nothing turns `PAID`, until it is back.

1. Restore the database, with One-Data's team.
2. Nothing else. The dispatchers and the `PAID` drain catch up on their own, at the governor's pace.

## billpay-core short of capacity

Online response times climb while Oracle and the downstreams are healthy, and the governor cuts offline work, execution included, to protect them.

1. Add billpay-core pods. Every pod is the same app, so there is nothing else to change: online and offline work spread across the new pods, and the governor raises offline rates again as the signals recover.
