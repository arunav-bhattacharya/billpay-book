---
title: SLA, SLI, SLO
description: 'Internal targets and external commitments for the APIs and functions Billpay exposes.'
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# SLA · SLI · SLO

<Lead>Internal targets and external commitments for the APIs and functions Billpay exposes. Numbers are stated at the percentiles we measure to: <code>P50</code>, <code>P90</code>, <code>P99</code>, <code>P99.9</code>, <code>P99.99</code>.</Lead>

## What these terms mean

<Highlights
  accent="var(--amex-cat-observability)"
  items={[
    {
      term: 'SLA, the Service Level Agreement',
      desc: `The external commitment to consumers. A breach is incident-grade and contractually visible.`,
    },
    {
      term: 'SLO, the Service Level Objective',
      desc: `The internal target engineering steers to. It is tighter than the SLA by design, which gives us headroom before customers notice.`,
    },
    {
      term: 'SLI, the Service Level Indicator',
      desc: `The signal we actually measure: the metric that proves whether we are meeting the SLO.`,
    },
  ]}
/>

:::info[Quick reference]
- The SLA is the promise, the SLO is the goal, and the SLI is the measurement.
- Latency cells on the two sub-pages are SLO targets, which are internal numbers.
- The availability figure on each entry is the SLA, the external commitment.
- The SLI line under each entry says what we measure to produce these numbers.
- The numbers are indicative targets. Confirm the latest contracted values with the Billpay team before quoting them outside it.
:::

## How to read an entry

Each entry on the two sub-pages has:

1. A title, the function or API name, with the endpoint underneath as a smaller note.
2. The SLA availability, the contractual uptime.
3. A row of five latency cells carrying the SLO targets at P50, P90, P99, P99.9 and P99.99.
4. The SLI, the metric, plus the error budget.

## The two surfaces

- [One-Data Functions](./one-data-functions.md) carries the SLA, SLI and SLO for the versioned, contract-level functions. The SLAs are tighter because these are the visible surface.
- [Billpay Core APIs](./billpay-apis.md) carries the same for the REST endpoints behind them. Latency targets are slightly tighter, because there is no function-edge overhead.

Both pages cover the surfaces that carry targets today, which is not every contract Billpay exposes. The full set is in [Build → API Spec](../../../build/api-spec/index.md).

One target is fixed by the design rather than by contract: p99 for `POST /payments` is held to 500 ms. The governor watches it: past 70% of that it stops raising offline rates, and past 90% it cuts them.

## Work nobody waits for

AR intake, returns and inbound payments never call billpay-core. One-Data stores each one in its inbox and answers 202, so what the sender experiences is the time to that 202, once the request is stored. From then on the measure is the backlog age: how long the request waits before a dispatcher starts its workflow. Waiting there is by design, because the governor releases this work at the pace the platform can take. What gets watched is the age: the returns and `PAID` backlog-age alerts fire when the oldest waiting item passes its threshold ([Kibana Alerts](../../alerts/kibana.md#backlogs)).

The allocations callback is the only payment work billpay-core still starts asynchronously. It replies 202 once the batch is stored and its workflow has started, and 429 with `Retry-After` when its traffic class is over budget, which the allocations manager retries.

## Error budget at a glance

| SLA target | Allowable downtime / 30 days | Allowable downtime / year |
| --- | --- | --- |
| 99.99% | ~4.3 minutes | ~52 minutes |
| 99.95% | ~21.6 minutes | ~4.4 hours |
| 99.9%  | ~43.2 minutes | ~8.8 hours |

:::tip[In practice]
The SLO is what engineering steers to. The SLA is what the platform commits to externally. We deliberately leave headroom, so an SLO breach with the SLA still intact is the cue to fix things before customers notice.
:::
