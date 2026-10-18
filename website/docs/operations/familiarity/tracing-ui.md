---
title: Tracing UI
description: "A payment's life is spread across several workflows and both clusters, often days apart, so it has no single trace."
---

import Lead from '@site/src/components/Lead';

# Tracing UI

<Lead>A payment's life is spread across several workflows and both clusters, often days apart, so it has no single trace. Each workflow has a trace of its own, and span links tie them together.</Lead>

## How the traces fit together

- Every workflow gets one trace, through the OpenTelemetry interceptors on the Temporal clients and workers.
- When one step leaves work for a later one, such as Verify writing a scheduled payment's Work Tracker row, the producer's trace context goes with it, in the row's `trace_parent`.
- The execution or leg that the row later starts carries a span link back to that trace. Follow the link to step from one workflow's trace to the one that set it up.

A single trace that ran from the create to the payment turning `PAID` could stay open for 30 days, which isn't practical, so the links do that job instead.

## Following payment X

Any payment can be traced from its ID alone:

1. Read `trans_lfcyc_event` in Oracle by the payment ID. It lists every step and the cluster that ran it.
2. Open `{paymentId}-{suffix}` in that cluster's [Temporal Web UI](./temporal-web-ui.md), within the 30 days it keeps histories.
3. Open the workflow's trace for detail on each call.

A payment or leg stuck in `PROCESSED` is usually waiting for an event, not for a step. Its row in One-Data's inbox says which event is missing, or that it is `UNMATCHED` ([runbook](../sops.md#a-payment-not-paid-after-48-hours)).
