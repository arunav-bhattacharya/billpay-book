---
title: Throttling, Priority and Fairness
description: 'Each downstream system sees at most the rate it agreed to, and the two clusters share that rate by use: offline work gets whatever online traffic leaves.'
sidebar_label: Throttling
---

import Lead from '@site/src/components/Lead';

# Throttling, Priority and Fairness

<Lead>Each downstream system sees at most the rate it agreed to, and the two clusters share that rate by use: offline work gets whatever online traffic leaves. When a SEPA run would miss its cutoff, the cutoff wins, and online calls to that system are capped until it passes.</Lead>

Billpay calls clearing, Accounts Receivable and several other systems for every payment it executes, and most of them have agreed a rate with us. Exceed it and they answer 429, for online and offline calls alike. So the limit lives in Temporal, where it holds across every pod at once, rather than in each worker's HTTP client.

## One queue per downstream

Every downstream endpoint with an agreed rate gets its own activity task queue on the Offline cluster:

`ds-clearing`, `ds-receivables`, `ds-authorization`, `ds-accounting`, `ds-ebnc`, `ds-risk`, `ds-tfne`, `ds-gphdb`, `ds-b2notifier`, `ds-comms` and `ds-allocations`.

Until each system's owner agrees a number, every one of them is taken at 100 calls a second. Payment Instruments and Payment Options have no limit, so calls to them run on the workflow's own queue.

The queue's server-side rate limit is the overall limit for that downstream, however many pods are polling it. The governor changes it at runtime through the task queue config API, for example:

```bash
temporal task-queue config set --task-queue ds-clearing --task-queue-type activity \
  --queue-rps-limit 120 --queue-rps-limit-reason governor
```

## Sharing a downstream between the clusters

There is no fixed split. Every 15 seconds the [governor](./pacing.md#the-governor) works out each downstream's offline share from what online traffic is actually using:

> Offline share = agreed TPS − online traffic's use (the peak of the last minute) − headroom

Say clearing has agreed to 100 calls a second. Online at 25 leaves offline 65, online at 80 leaves it 10, and an idle online cluster leaves it 90.

The sum needs two inputs. Both are settled for now, and both will be looked at again:

- Online's calls all run on one queue, so Temporal can't count them per downstream. Online workers count their own calls and 429s per downstream, and billpay-core publishes them with its other metrics. The Prometheus server that already scrapes Temporal's metrics scrapes billpay-core's pods too, and the governor reads it there. That server has to be sized for the extra volume, and how to scale it is a discussion of its own.
- The headroom covers how late offline can react, which is up to about 45 seconds. The governor checks every 15 seconds, and the numbers it reads are about 30 seconds old: the scrape interval plus the window a rate is computed over. So after online traffic jumps, offline can keep its old share for up to 45 seconds. The headroom is the larger of 10% of the agreed rate and the biggest 45-second jump in online traffic seen over the last 4 weeks and in the load test. A faster scrape shortens the lag, and the headroom with it, which is why the 45 seconds will be revisited.

## When the cutoff wins

A SEPA run has to reach the bank before its cutoff, and when it collides with online traffic, the cutoff comes first. During a run, offline's share of a downstream never drops below what the run needs to finish 30 minutes early. For a full SEPA run, that is about 56 calls a second of clearing.

If online traffic would leave less than that, online is capped on that downstream at the agreed rate minus the run's need, until the cutoff passes. With clearing at 100 calls a second, the cap is 44. The US run has no cutoff, so it never caps online traffic.

The cap works the same way as offline's limits. The Online cluster has a `ds-*` queue for each downstream a cutoff run calls, and the governor sets the cap as that queue's limit. While a cap is on, the Router places that downstream's calls for each new online payment on the capped queue. The rest of the time they run on `online-wf` with eager dispatch, so normal traffic pays nothing for this. A cap lifts by itself at the cutoff, so a stopped governor can't leave customers capped.

The cost falls on customers, and only during the run. Some online payments wait for the downstream, and one the API can't decide in time gets a PENDING reply and finishes shortly after. Because a cap raises online p99 on purpose, online p99 never cuts a SEPA run below its floor. Two hours before each run, the governor warns when online traffic is likely to be capped.

## Admitting only what fits

A queue limit on its own isn't enough. Starting more workflows than a downstream can serve only parks their tasks in the queue's backlog, and that backlog is rows in the Offline database. So admission happens before the start: across every class of work, the sum of start rate times calls per workflow to a downstream must stay within its offline share, handed out in priority order. The [governor](./pacing.md#the-governor) does that sum every 15 seconds.

Calls per second to a downstream is the sum over classes of rate times calls per workflow to it. US execution at 100 TPS, calling clearing once each, needs 100 calls a second of clearing's offline share. An agreed rate that covers online's evening peak plus a SEPA run's need, about 56 calls a second of clearing, means online traffic is never capped.

## When a downstream pushes back

- A single call that gets 429 waits out `Retry-After`, plus a little jitter, and tries again.
- If the 429 rate passes 1%, or the downstream's p99 doubles, the governor drops the queue's limit by multiplying it by 0.7, then probes back up 5% at a time.
- A 429 on an online call means offline took room online needed, so it halves that downstream's offline share at the next check. Neither cut takes a SEPA run below its need.
- In an outage the queue trickles at 1 call a second, just enough to notice when the downstream is back. Admissions for the classes that need it pause, and only the work already in flight waits.

Worker slots follow the limit, not the other way round. A queue needs roughly its limit times the call latency in slots: 100 calls a second at 1 second each needs about 100 slots across all pods. Adding more slots adds no throughput.

## Calls that must succeed

Clearing, Accounts Receivable, open-to-buy, accounting, eBNC, risk, the Transaction Notification Engine (TFNE), the legacy Payments History Database (GPHDB), B2Notifier and Raven must all succeed before a payment is `PROCESSED`. None of them is skipped or deferred. A failed call retries within its activity's schedule-to-close limit; after that the Work Tracker row goes `FAILED` and the payment goes onto the exception list in its last state. RTF and Raven are the exception: they get a long limit, so an outage of either pauses payments where they are.

- Raven is throttled like the rest. `ds-comms` carries its offline share, and a 429 waits out `Retry-After`.
- RTF has no limit to respect, because RTF guarantees delivery once it has an event. Its calls run on the workflow's own queue, and each workflow announces one state change at a time, so a payment's events reach RTF in order.
- An outage of either holds payments in Fulfil, short of `PROCESSED`. Their in-flight slots stay taken, and once the cap fills, the Work Tracker dispatchers wait, just as for any other downstream outage. The governor stops the inbox dispatchers.

## Priority and fairness

A queue's limit says how much gets through. Priority says who goes first on a shared queue, and fairness splits one priority level between markets and corporate payments. Both are set once, at workflow start, and every activity the workflow runs inherits them.

| Class | Priority key | Fairness key | Per-key limit |
| --- | --- | --- | --- |
| AR batch intake | 1 | `intake` | None in effect: weight 100 |
| SEPA execution | 1 | Market | None in effect: weight 100 |
| US execution | 1 | Market | None in effect: weight 100 |
| Corporate: parent execution, allocation requests, legs | 2 | Parent payment ID | The queue's default per-key RPS, so one payment can't take the whole queue |
| Inbound | 3 | `inbound` | None in effect: weight 100 |
| Representments | 4 | Market | None in effect: weight 100 |
| Returns | 5, the lowest | `returns` | None in effect: weight 100 |

- Priority keys run from 1, first, to 5.
- Returns sit at the lowest level, so on a shared queue they wait until every higher level drains, even through a whole execution window. That is fine for work nobody is waiting on, and an alert on their backlog age keeps a long wait visible.
- Fairness is switched on in the server's dynamic config (`matching.enableFairness`). The default per-key limit applies to every key on a queue, scaled by the key's weight. Every key except a corporate parent's carries weight 100 and never meets it, so in practice the limit only reins in corporate parents. Weights only compare keys within one priority level.
- `ProcessPaidEventsWorkflow` uses no shared queue, so it has no priority key. Its calls to One-Data and RTF run on its own queue, Oracle goes through `PaymentStore`, and the governor paces it directly.

The fairness key is what keeps a corporate payment with 100K allocations from starving everyone else. At 100 legs a second it takes about 17 minutes, and the other payments on the queue keep moving the whole time.

## The Offline cluster's task queues

One Offline namespace serves every market, with market as a fairness key, so each downstream has exactly one queue and one limit.

| Task queue | Carries | Workers |
| --- | --- | --- |
| `offline-wf` | Workflow tasks, and unthrottled activities run eagerly | Workflow workers |
| `ctl-sched`, `ctl-alloc`, `ctl-allocated`, `ctl-leg`, `ctl-repr`, `ctl-intake`, `ctl-return`, `ctl-inbound`, `ctl-governor`, `ctl-onboard` | One control queue per dispatcher kind, plus the governor and market onboarding | Control workers in the app |
| `ds-clearing`, `ds-receivables`, `ds-authorization`, `ds-accounting`, `ds-ebnc`, `ds-risk`, `ds-tfne`, `ds-gphdb`, `ds-b2notifier`, `ds-comms`, `ds-allocations` | One downstream each, rate-limited | A worker per downstream in the app, its slots sized to the queue's limit |

Queues that carry legs also get `--fairness-key-rps-limit-default`. Every other fairness key carries a large weight, so that default only limits corporate parents.

On the Online cluster, the main queue is `online-wf`, which carries the workflow tasks and their regular activities, with eager dispatch on. The decision's calls, to Payment Instruments, Payment Options and Plans in Verify, to the card provider for a debit card's authorization, and to the provider in RequestConfirmation, skip the queue altogether: they run as local activities, inside the worker. None of those systems has a rate limit, so running outside the queue skips nothing. A Verify call that fails 3 times that way runs again as a regular activity on `online-wf`, for up to 24 hours. Its `ds-*` queues carry calls only while a SEPA run caps online traffic on a downstream ([When the cutoff wins](#when-the-cutoff-wins)). Online workers poll them, with slots sized to the cap.
