---
title: Temporal Server on AWS
description: 'The two Temporal clusters run on EKS in AWS us-east-1, each with its own namespace and task queues.'
sidebar_label: Temporal Server (AWS)
---

import Lead from '@site/src/components/Lead';

# Temporal Server on AWS

<Lead>The two Temporal clusters run on EKS in AWS us-east-1, each with its own namespace and task queues. The Online cluster is simple to read. The Offline cluster is where pacing happens, so its queues, priorities and Schedules are what an operator needs to know.</Lead>

The cluster settings, from history shards to namespace limits, are on [Deployment → Temporal Server](../../deployment/temporal-server.md).

## Namespaces

Each cluster has one namespace, named `billpay-online` or `billpay-offline` in every environment, so moving between environments changes only the cluster endpoints.

- The Online namespace has one main task queue, `online-wf`. Its `ds-*` queues carry calls only while a SEPA run caps Online on a downstream.
- One Offline namespace serves every market, with market as a fairness key, so each downstream has exactly one queue and one limit.

## The Offline cluster's queues

Three kinds of queue, each with its own job:

- `offline-wf` carries the workflow tasks, and activities nothing needs to throttle.
- A `ctl-*` queue per kind of dispatcher, plus one for the governor and one for market onboarding, carries the control activities. A slow dispatcher can't hold up another.
- A `ds-*` queue per downstream carries the calls to it, and its rate limit is the limit for that downstream across every pod. The governor changes it at runtime.

[Throttling](../../design/throttling.md#the-offline-clusters-task-queues) lists every queue.

## Priorities

Work on the Offline cluster runs at five priority levels, 1 first and 5 last. Execution and AR intake sit at 1, corporate work at 2, inbound payments at 3, representments at 4, and returns at 5. On a shared queue, a level waits until every level above it drains, so returns can wait through a whole execution window. Corporate payments also carry a fairness key per parent, which stops one payment with 100K allocations from taking a whole queue. [Priority and fairness](../../design/throttling.md#priority-and-fairness) has the full table.

## Schedules

Every Temporal Schedule lives on the Offline cluster: one per dispatcher (the scheduled-payment and representment dispatchers have one per market), the governor's, and the periodic jobs'. Each skips a trigger while its last run is still going. Pausing a Schedule stops new runs; to pause a whole market, use billpay-ui instead ([Dispatch Controls](./dispatch-controls.md)).

## Scaling

The cluster isn't where capacity is usually added. History shards are fixed when a cluster is created, with room for more markets. More throughput for payments comes from more billpay-core pods, and the pace of offline work is the governor's to set. The Offline database can grow from 64 to 192 vCPU ([Temporal DB on AWS](./temporal-db-aws.md)).
