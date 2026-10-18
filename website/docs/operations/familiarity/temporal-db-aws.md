---
title: Temporal DB on AWS
description: 'Each Temporal cluster has its own Aurora PostgreSQL database for its histories, and its own OpenSearch 2 store for visibility.'
sidebar_label: Temporal DB (AWS)
---

import Lead from '@site/src/components/Lead';

# Temporal DB on AWS

<Lead>Each Temporal cluster has its own Aurora PostgreSQL database for its histories, and its own OpenSearch 2 store for visibility. Keeping them apart is what stops offline load from slowing realtime traffic inside Temporal.</Lead>

## Sizing

- Online: 64 vCPU, kept under 40% CPU at the 100 TPS peak.
- Offline: 64 vCPU to start, up to 192, kept under 60%.
- Visibility writes, the search behind the Temporal UI, go to OpenSearch rather than Aurora.

The Offline size is settled by load-test run 2, which measures how many writes a second each size takes at 60% CPU. If 64 vCPU covers the worst overlap of work, Offline starts there and keeps 192 as headroom ([Performance Testing](../../testing/non-functional/performance.md)).

## What the governor reads from it

The Offline database is the constraint the governor steers by, so its numbers are worth knowing:

- Offline Aurora CPU, from Enhanced Monitoring at 1 to 5 seconds. The governor raises rates under 50%, holds between 50 and 60%, and cuts above 60%. Above 70% it halves the budget.
- Offline persistence p99, against its baseline. It is the fastest honest sign of strain: the governor holds once it reaches 1.5 times the baseline, and cuts past twice.
- The ceiling: the writes a second the load test measured at 60% CPU. The governor never budgets above it.

So an Offline database running between 50 and 60% CPU through a midnight run is the design working, not a problem. The Offline DB hot alert fires only when CPU stays above the cut band for 15 minutes.

## Standbys

Each database has a standby in us-west-1, replicated from the east, which takes no traffic. It is promoted with its cluster, and each cluster is promoted on its own ([Promoting a cluster's standby](../sops.md#promoting-a-clusters-standby)).
