---
title: Temporal Health
description: 'The Grafana dashboard shows the health of both Temporal clusters, Online and Offline.'
---

import Lead from '@site/src/components/Lead';

# Temporal Health: the Grafana Dashboard

<Lead>The Grafana dashboard shows the health of both Temporal clusters, Online and Offline. Each has its own database and its own kind of load, so each is read on its own terms.</Lead>

## Two clusters, two questions

- On the Online cluster, a caller is waiting, so the question is response time. The signal that matters most is p99 for `POST /payments`, against its 500 ms SLO.
- On the Offline cluster, work arrives at the governor's pace, so the question is whether the database can take the rate it is being given, and whether queues drain.

Separate databases mean offline load can't slow realtime traffic inside Temporal. Oracle, the downstreams and the app are still shared, which is why the governor watches the Online cluster too.

## The governor's inputs

Every 15 seconds the governor reads a handful of signals and sets offline rates from the worst one. When a rate drops, these are the first panels to read, because one of them is the reason:

- Offline Aurora CPU, from Enhanced Monitoring at 1 to 5 seconds. The standard per-minute CPU is too slow to steer by.
- Offline persistence p99, against its baseline. It is the fastest honest sign of database strain.
- Offline schedule-to-start: how long tasks wait for a worker.
- Online p99 for `POST /payments`.
- Oracle commit latency and errors.

[Design → Pacing](../../design/pacing.md) has the bands for each signal: when the governor raises, holds and cuts.

## Task queues

Each `ds-*` queue carries the calls to one downstream, and each `ctl-*` queue the activities of one kind of dispatcher, so the queues show where work is waiting:

- For every `ds-*` and `ctl-*` queue, its backlog and the rate limit currently set on it.
- A `ds-*` queue at its limit with a growing backlog means that downstream is what holds the run back.
- A `ds-*` queue down to 1 request a second is a downstream outage: the queue is probing until the downstream answers again.
- On the Online cluster, a `ds-*` queue carries calls only while a SEPA run caps Online on that downstream.

For one workflow rather than a whole cluster, use the [Temporal Web UI](../../operations/familiarity/temporal-web-ui.md) of the cluster that ran it.
