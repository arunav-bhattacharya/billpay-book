---
title: billpay-core
description: 'billpay-core is the one app behind Billpay: one deployable, one JVM, running the work for both Temporal clusters.'
---

import Lead from '@site/src/components/Lead';

# billpay-core

<Lead>billpay-core is the one app behind Billpay: one deployable, one JVM, running the work for both Temporal clusters. It hosts the core APIs, the Billpay Router, the dispatchers, the governor and the workers for the Online and Offline clusters, with a Temporal client for each.</Lead>

The two [Temporal clusters](../../design/component-model/workflows/index.md#two-clusters) are separate, but the app isn't. There is no separate online or offline app, and none is planned: billpay-core ships and deploys as one app, and more capacity means more pods of the same app. Load-test runs 4 and 6 prove that online response times hold on it while offline work runs ([Performance Testing](../../testing/non-functional/performance.md)).

## Sharing one app safely

Online and offline work can share a pod because offline work reaches the app only at the governor's pace, and two fences hold it in place between the governor's checks:

- Offline work has its own Oracle connection pool ([DataSource](../../build/principles/tech-stack/datasource.md)), so a busy midnight run can't take the connections a customer's payment needs.
- Offline workers have their own slot caps, set through `setMaxConcurrentActivityExecutionSize` and `setMaxConcurrentWorkflowTaskExecutionSize`, so offline tasks can never take a whole pod.

The governor checks every 15 seconds and only stops new starts. The caps protect online work in the seconds in between, and the governor cuts offline rates as soon as online response times climb.

## Workers and queues

Each worker in the app polls one task queue on one cluster.

- On the Online cluster, `online-wf` carries the workflow tasks and their regular activities, with eager dispatch on. The calls that make Verify's decision run as local activities, inside the worker that runs the workflow task. Each downstream a cutoff run calls also has a `ds-*` queue there, used only while a SEPA run caps Online on that downstream, and its worker's slots are sized to the cap.
- On the Offline cluster, `offline-wf` carries the workflow tasks, a `ctl-*` queue per dispatcher kind carries the control activities (the governor and provisioning have one each too), and every downstream has one rate-limited `ds-*` queue. [Throttling](../../design/throttling.md#the-offline-clusters-task-queues) lists them all.
- A `ds-*` worker's slots are sized to its queue's limit times the call's latency: 100 calls a second at 1 second each needs about 100 slots across all pods. More slots add no throughput.

Workflow workers keep a sticky cache at least as big as the number of workflows in flight, which is 2,000 or more on the Offline cluster. A workflow that falls out of the cache has to be replayed from its history before its next step, so a cache that is too small turns into extra load on the cluster.

## Versions and deploys

Payment workflows are pinned to the build they started on, through Worker Versioning. A deploy starts new payments on the new build and never changes the code under one already running. The dispatchers and the governor are not pinned the same way: they move to the new build when they continue-as-new. [Deployment Pipeline](../pipeline.md) covers what that means for a release.

## Where it runs

billpay-core runs in IPC2, with a standby of the same app, deployed and ready, in IPC1. It is the only component that talks to Temporal. [High Availability](../../architecture/high-availability.md#the-app) has the site picture and what happens when a site fails.
