---
title: Performance Testing
description: 'Seven load-test runs show whether the design holds.'
sidebar_label: Performance
---

import Lead from '@site/src/components/Lead';

# Performance Testing

<Lead>Seven load-test runs show whether the design holds. The first two measure what the design can only estimate, the next four replay each busy window with failures thrown in, and the last proves a market release can change while payments run.</Lead>

## Why the first two runs come first

Every capacity number in the design is an estimate from a write model: a scheduled execution costs about 49 writes to the Offline cluster's database, a leg about 34, a return about 20. The [governor](../../design/pacing.md) budgets in those writes, so it can only be as right as they are. Run 1 measures the real cost of each workflow, and the governor takes the measured numbers. Run 2 finds how many writes a second the Offline database can take at 60% CPU, and that becomes the governor's ceiling. It also finds the knee where persistence latency starts to climb, which sets where the governor holds instead of raising.

Run 2 settles a sizing question too. It runs on 64 vCPU, then on 192. If 64 covers the worst overlap of work, about 12,700 writes a second, the Offline database starts there and keeps 192 as headroom.

## The seven runs

Every run uses downstream stubs at the agreed TPS (transactions per second), with real latency.

| Run | What | Pass if |
| --- | --- | --- |
| 1. Cost per workflow | Each workflow type alone at 10 TPS | Measured writes are within 20% of the model; otherwise the governor's costs are updated |
| 2. Database ceiling | Execution at 25, 50, 100 and 150 TPS, then upward until 60% CPU, on 64 and then 192 vCPU | Writes a second at 60% CPU and the persistence p99 knee are recorded. They become the governor's ceiling and bands |
| 3. US window | 1M executions, governor on | At least 50 TPS throughout; the rate ramps up while signals are healthy; Offline CPU stays under 60% |
| 4. SEPA window | 500K executions with a 3-hour cutoff, plus synthetic realtime traffic on the Online cluster against the same stubs: below the cap for the first half, above it for the second | Done with 15% of the cutoff to spare. In the first half, online p99 is unchanged on billpay-core. In the second, Online's calls stay under the cap, and the cap lifts at the cutoff |
| 5. Failures | During run 3: a 429 storm, a downstream outage, worker kills, a governor kill, an Offline Aurora failover and an Oracle restart. With creates running on Online: billpay-core killed mid-create, a delete call that keeps failing, a Redis site failover, and two creates for one account through different Redis sites | No duplicates, no lost items, and recovery with no manual step |
| 6. Corporate and intake | One 100K and twenty 10K corporate payments, with allocations arriving by callback in parts, some after the execution time. Alongside: 100 TPS of AR intake and a 10-minute burst of 1,000 settlement and posting events a second, both into One-Data's inbox | Parents clear as soon as they are `ALLOCATED`; legs progress fairly; One-Data stores intake with p99 under 500 ms; the AR intake dispatcher and the `PAID` drain clear their backlogs at the governor's pace, with online p99 unchanged on billpay-core |
| 7. Market release | Publish, test, activate and roll back a release in E1 while payments run | New payments use the new version, running ones keep theirs, and rollback restores the old one |

## What the runs decide

Runs 4 and 6 prove the app. billpay-core runs online and offline work side by side, so online p99 must hold while offline work runs, outside a cutoff run's cap. Go-live waits until it does.

A few settings start as working values and get their real ones from these runs:

- The in-flight cap on execution starts at 1,000 payments and is tuned here.
- The `PAID` drain settles an estimated 1,000 payments a second; run 1 measures it.
- The governor's 45-second headroom window is to be revisited once the load test and the metrics scrape interval are known.

## After every run

Reconcile before calling a run passed. Work Tracker rows by status must match the workflows that completed, and the stubs' ledger must match the payments and legs that reached `PAID`, with no duplicates. A run that is fast but loses or repeats a payment has failed.
