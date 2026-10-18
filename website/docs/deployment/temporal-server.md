---
title: Temporal Server
description: 'Billpay runs on two self-hosted Temporal clusters in AWS us-east-1, Online and Offline, each with a passive standby in us-west-1.'
---

import Lead from '@site/src/components/Lead';

# Temporal Server

<Lead>Billpay runs on two self-hosted Temporal clusters in AWS us-east-1, Online and Offline, each with a passive standby in us-west-1. They are infrastructure we run, not artifacts the monorepo ships, which is why they live here rather than under Deployables.</Lead>

## Two clusters

The Online cluster runs journeys where a caller waits for an answer, including a payment that waits minutes for its customer, at a peak of 100 TPS (transactions per second). The Offline cluster runs work that can be paced: scheduled execution, AR intake, corporate allocations, returns, inbound payments, representments, the periodic jobs and the control workflows. [Two clusters](../design/component-model/workflows/index.md#two-clusters) explains the split.

Nothing calls across the clusters. A payment accepted or scheduled on Online reaches Offline as a Work Tracker row in Oracle, written in the same commit as its state change, so either cluster can go down while the other keeps working.

## Settings

Both clusters run the latest Temporal server, at least 1.30.1, so visibility can use OpenSearch 2.

| Setting | Online | Offline | Why |
| --- | --- | --- | --- |
| History shards | 2K | 4K | Fixed when the cluster is created; room for more markets |
| Persistence | Own Aurora PostgreSQL | Own Aurora PostgreSQL | Isolation |
| Visibility | OpenSearch 2 | OpenSearch 2, its own index | Off the main database; Temporal recommends it at scale |
| Standby | Passive, in us-west-1 | Passive, in us-west-1 | Active-passive; an operator promotes each standby on its own |
| `system.enableActivityEagerExecution` | true | true | Eager activities save writes |
| Eager workflow start | Not used | Not used | The server refuses it with Update-With-Start |
| `matching.enableFairness` | Not needed | true | Fairness keys and per-key limits |
| Namespace retention | 30 days | 30 days | The retention requirement |
| Namespace RPS limits | Well above peak | About 2× the API requests per second at the governor's ceiling | A hard backstop if the governor misbehaves |

All Temporal Schedules live on the Offline cluster. One Offline namespace serves every market, with market as a fairness key, so each downstream has exactly one queue and one limit. Work on that cluster runs at five priority levels, 1 to 5, by traffic class ([Throttling](../design/throttling.md)).

## Standbys and failover

Each cluster runs active-passive, like the single cluster it replaces. The standby in us-west-1 replicates its database from the east and takes no traffic. An operator promotes each standby on its own, and billpay-core points its client for that cluster at the new frontend. Workflows carry on from the histories the standby received.

When the Offline cluster is down, the Online cluster keeps serving. Dated work waits in Oracle, pulled work waits in One-Data's inbox, and allocation callbacks get 503 with `Retry-After` until the cluster is back. [High Availability](../architecture/high-availability.md#when-things-break) covers every failure, including losing all of us-east-1.

## Running the clusters day to day

Operators' notes live under Operations: [Temporal Server on AWS](../operations/familiarity/temporal-server-aws.md) for the namespaces, queues and priorities, [Temporal DB on AWS](../operations/familiarity/temporal-db-aws.md) for the two Aurora databases, and the [Temporal Web UI](../operations/familiarity/temporal-web-ui.md), one per cluster. Workflow payloads in the Web UI are decrypted by the [Codec Server](./deployables/codec-server-app.md).
