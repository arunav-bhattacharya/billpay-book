---
title: SLA, SLI, SLO
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# SLA · SLI · SLO

<Lead>Internal targets and external commitments for everything the Billpay platform exposes. Numbers are stated at the percentiles we measure to: <code>P50</code>, <code>P90</code>, <code>P99</code>, <code>P99.9</code>, <code>P99.99</code>.</Lead>

## What these terms mean

<Highlights
  accent="var(--amex-cat-observability)"
  items={[
    {
      term: 'SLA, the Service Level Agreement',
      desc: "The external commitment to consumers. A breach is incident-grade and contractually visible.",
    },
    {
      term: 'SLO, the Service Level Objective',
      desc: 'The internal target engineering steers to. It is tighter than the SLA by design, which gives us headroom before customers notice.',
    },
    {
      term: 'SLI, the Service Level Indicator',
      desc: "The signal we actually measure: the metric that proves whether we are meeting the SLO.",
    },
  ]}
/>

:::info[Quick reference]
- **SLA** is the promise. **SLO** is the goal. **SLI** is the measurement.
- Latency cells in the sub-pages are **SLO targets**, which are internal numbers.
- The availability figure on each entry is the **SLA**, which is the external commitment.
- The "SLI" line under each entry describes what we measure to produce these numbers.
- Numbers are **indicative targets**. Confirm the latest contracted values with the Billpay team before quoting externally.
:::

## How to read an entry

Each entry on the two sub-pages has:

1. A **title**, the function or API name, with the endpoint underneath as a smaller note.
2. The **SLA availability**, the contractual uptime.
3. A **five-cell latency row** carrying the SLO targets at P50, P90, P99, P99.9, and P99.99.
4. The **SLI**, the metric, plus the error budget.

## The two surfaces

- [One-Data Functions](./one-data-functions.md) carries the SLA, SLI, and SLO for the 7 versioned, contract-level functions (`CreatePayment.v3`, `UpdatePayment.v1`, and the rest). The SLAs are tighter because these are the visible surface.
- [Billpay Core APIs](./billpay-apis.md) carries the same for the 9 REST endpoints (`POST /payments`, `PUT /payments/{payment-id}`, and the rest). Latency targets are slightly tighter, because there is no function-edge overhead.

## Error budget at a glance

| SLA target | Allowable downtime / 30 days | Allowable downtime / year |
| --- | --- | --- |
| **99.99%** | ~4.3 minutes | ~52 minutes |
| **99.95%** | ~21.6 minutes | ~4.4 hours |
| **99.9%**  | ~43.2 minutes | ~8.8 hours |

:::tip[In practice]
The **SLO** is what engineering steers to. The **SLA** is what the platform commits to externally. We deliberately leave headroom, so an SLO breach with the SLA still intact is the cue to fix things **before** customers notice.
:::
