---
title: Throttling, Priority and Fairness
description: 'Each downstream system sees at most the rate it agreed to. Online traffic takes what it needs, and offline traffic gets the rest.'
sidebar_label: Throttling
---

import Lead from '@site/src/components/Lead';

# Throttling, Priority and Fairness

<Lead>Each downstream system sees at most the rate it agreed to. Online traffic takes what it needs, and offline traffic gets the rest, enforced in one place per downstream: its task queue.</Lead>

Billpay calls clearing, Accounts Receivable and several other systems for every payment it executes, and most of them have agreed a rate with us. Exceed it and they answer 429, for online and offline calls alike. So the limit lives in Temporal, where it holds across every pod at once, rather than in each worker's HTTP client.

## One queue per downstream

Every downstream endpoint with an agreed rate gets its own activity task queue on the Offline cluster:

`ds-clearing`, `ds-receivables`, `ds-authorization`, `ds-accounting`, `ds-ebnc`, `ds-risk`, `ds-comms` and `ds-allocations`.

The queue's server-side rate limit is the overall limit for that downstream, however many pods are polling it. The governor changes it at runtime through the task queue config API, for example:

```bash
temporal task-queue config set --task-queue ds-clearing --task-queue-type activity \
  --queue-rps-limit 120 --queue-rps-limit-reason governor
```

Online traffic is never throttled. The offline share of each downstream is what is left:

> Offline share = agreed TPS − online traffic's measured use (the peak of the last minute) − a 10% margin

## Admitting only what fits

A queue limit on its own isn't enough. Starting more workflows than a downstream can serve only parks their tasks in the queue's backlog, and that backlog is rows in the Offline database. So admission happens before the start: across every class of work, the sum of start rate times calls per workflow to a downstream must stay within its offline share, handed out in priority order. The [governor](./pacing.md#the-governor) does that sum every 15 seconds.

Calls per second to a downstream is the sum over classes of rate times calls per workflow to it. US execution at 100 TPS, calling clearing once each, needs 100 calls a second of clearing's offline share. Each agreed TPS has to cover online traffic's peak plus each window's need; SEPA alone needs about 56 calls a second of offline share during the US evening.

## When a downstream pushes back

- A single call that gets 429 waits out `Retry-After`, plus a little jitter, and tries again.
- If the 429 rate passes 1%, or the downstream's p99 doubles, the governor drops the queue's limit by multiplying it by 0.7, then probes back up 5% at a time.
- In an outage the queue trickles at 1 call a second, just enough to notice when the downstream is back. Admissions for the classes that need it pause, and only the work already in flight waits.

Worker slots follow the limit, not the other way round. A queue needs roughly its limit times the call latency in slots: 100 calls a second at 1 second each needs about 100 slots across all pods. Adding more slots adds no throughput.

## Calls that must succeed

Clearing, Accounts Receivable, open-to-buy, accounting, eBNC, risk and Raven must all succeed before a payment is `PROCESSED`. None of them is skipped or deferred. A failed call retries within its activity's schedule-to-close limit; after that the Work Tracker row goes `FAILED` and the payment goes onto the exception list in its last state. RTF and Raven are the exception: they get a long limit, so an outage of either pauses payments where they are.

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
| `ctl-sched`, `ctl-alloc`, `ctl-leg`, `ctl-repr`, `ctl-intake`, `ctl-return`, `ctl-inbound`, `ctl-governor`, `ctl-provision` | One control queue per dispatcher kind, plus the governor and provisioning | Control workers in the app |
| `ds-clearing`, `ds-receivables`, `ds-authorization`, `ds-accounting`, `ds-ebnc`, `ds-risk`, `ds-comms`, `ds-allocations` | One downstream each, rate-limited | A worker per downstream in the app, its slots sized to the queue's limit |

Queues that carry legs also get `--fairness-key-rps-limit-default`. Every other fairness key carries a large weight, so that default only limits corporate parents.
