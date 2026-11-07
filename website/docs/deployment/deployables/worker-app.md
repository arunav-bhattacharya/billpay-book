---
title: billpay-online and billpay-offline
description: 'Billpay runs as two apps, billpay-online and billpay-offline, built from one codebase as two Quarkus artifacts, each connected to its own Temporal cluster.'
---

import Lead from '@site/src/components/Lead';

# billpay-online and billpay-offline

<Lead>Billpay runs as two apps, billpay-online and billpay-offline, built from one codebase as two Quarkus artifacts, each connected to its own Temporal cluster. Each app holds only its own cluster's client, workers and endpoints.</Lead>

The codebase is billpay-core, a Gradle monorepo with two app modules, `apps/online` and `apps/offline`, each built as its own Quarkus artifact. The shared code, the domain, workflows, stages, activities, stores, clients and the Router, sits in library modules both apps depend on. Each app is named after the Temporal namespace it serves, and holds a client for its own cluster only, so no app ever calls the other's cluster.

| App | What it runs | Its cluster |
| --- | --- | --- |
| billpay-online | The APIs channels call through One-Data: create, update, cancel, the confirm and the no, the credit balance refund, the reads and the instruments read. The card provider's 3D Secure callback. The Router for those requests, and the workers for the Online cluster | Online |
| billpay-offline | The dispatchers and the governor. The allocations callback and the Market Onboarding API. The Router for pulled work and async starts, and the workers for the Offline cluster, control workers included | Offline |

## Why two apps

Offline work and a customer's payment used to share a pod, held apart by an offline connection pool and slot caps. With two apps they share no pod at all. A midnight run can't take the connections or the threads a customer's payment needs, because it never runs where that payment runs.

Each app scales on its own: more billpay-online pods for online traffic, more billpay-offline pods for offline throughput. What the two still share is Oracle and the downstream systems, so the governor keeps watching online response times as well as Oracle and the downstreams, and slows offline work first when any of them is under pressure. Load-test runs 4 and 6 prove that online response times on billpay-online hold while billpay-offline runs offline work ([Performance Testing](../../testing/non-functional/performance.md)).

## Workers and queues

Each worker polls one task queue on its app's cluster.

- In billpay-online, `online-wf` carries the workflow tasks and the activities nobody throttles, such as RTF's, with eager dispatch on. The calls that make Verify's decision run as local activities, inside the worker that runs the workflow task. A call that fails 3 times there runs again as a regular activity on `online-wf`, for up to 24 hours. Execute's and Fulfil's calls run on a `ds-*` queue per downstream, always rate-limited. billpay-online sets each queue's limit itself, from the limit the governor writes to Oracle for Online, a SEPA run's cap included.
- In billpay-offline, `offline-wf` carries the workflow tasks, a `ctl-*` queue per dispatcher kind carries the control activities (the governor and market onboarding have one each too), and every downstream has one rate-limited `ds-*` queue. [Throttling](../../design/throttling.md#the-offline-clusters-task-queues) lists them all.
- A `ds-*` worker's slots are sized to its queue's limit times the call's latency: 100 calls a second at 1 second each needs about 100 slots across all pods. More slots add no throughput.
- Each app's slot caps are sized to its own pods and its own Oracle pool ([DataSource](../../build/tech-stack/datasource.md)).

Workflow workers keep a sticky cache at least as big as the number of workflows in flight, which is 2,000 or more on the Offline cluster. A workflow that falls out of the cache has to be replayed from its history before its next step, so a cache that is too small turns into extra load on the cluster.

## Versions and deploys

One pipeline run builds both apps from the same commit, and each registers that build ID with its own cluster under Worker Versioning. Payment workflows are pinned to the build they started on, so a deploy starts new payments on the new build and never changes the code under one already running. The dispatchers and the governor are pinned too, but each continues-as-new onto the newest build, and the governor does so as soon as a new build is the target (Proposed). [Deployment Pipeline](../pipeline.md) covers what that means for a release.

## Where they run

Both apps run in IPC2, each with a standby of the same app, deployed and ready, in IPC1. They are the only components that talk to Temporal, each to its own cluster. [High Availability](../../architecture/high-availability.md#the-apps) has the site picture and what happens when a site fails.
