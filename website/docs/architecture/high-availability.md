---
title: High Availability
description: 'Billpay runs from two on-prem Hydra sites, IPC2 in the east and IPC1 in the west, against two self-hosted Temporal clusters in AWS us-east-1.'
sidebar_label: High Availability
---

import Lead from '@site/src/components/Lead';
import Principles from '@site/src/components/Principles';
import HADiagram from '@site/src/components/HADiagram';

# High Availability

<Lead>Billpay runs from **two on-prem Hydra sites**, IPC2 in the east and IPC1 in the west, against **two self-hosted Temporal clusters** in AWS us-east-1. Only the front door is live in both sites. Everything behind it processes in one place at a time: the Online and Offline apps, the write side of the database and each Temporal cluster have a standby that does nothing until someone promotes it. And when the core APIs can't be reached, One-Data parks the request in **Redis** rather than turning the caller away, for **RTF** to replay later.</Lead>

## Topology

<HADiagram />

## Front door

- One-Data Functions run active in both sites, so losing a site doesn't close the front door.
- Both of them call the same core APIs, the ones in IPC2's Online app. IPC1's One-Data routes across.
- Each site also has a **Redis** store that sits empty most of the time. It's there for one case: the core APIs can't be reached.
- When that happens, One-Data writes the request into Redis instead of failing the caller. **RTF** (the Reliable Transaction Framework) then picks it up from Redis and replays it into the core once the core is healthy again.
- The two Redis instances are one active-active database (Redis calls this a CRDB), so a request parked on one site is visible from the other.
- The trade is on purpose. The caller gets an answer now and the payment processes a little later. An outage in the core becomes a delay instead of a dropped payment.

## The two apps

billpay-core is two apps, one for each Temporal cluster.

- The **Online app** runs the REST APIs, the [Billpay Router](../design/routing.md) and the Online cluster's workers. Its core APIs hold a Temporal client for each cluster, because an async start from Accounts Receivable or a return goes straight to Offline.
- The **Offline app** runs the dispatchers, the outbox relays, the governor, the Offline cluster's workflows, and one worker deployment per downstream task queue, so each downstream system's workers scale on their own.
- Each app is deployed in both sites, and only IPC2's take traffic. The IPC1 instances stay deployed and ready, and an operator promotes them if IPC2 goes.
- Both apps read and write the Oracle primary next to them in IPC2, and they are the only components that talk to Temporal.
- So each kind of work runs in exactly one place, which is also one place to look when a payment is stuck. Deployment detail is on the [apps' deployable page](../deployment/deployables/worker-app.md).

## Oracle

- The payments schema is active-passive. The read/write primary is in IPC2, with two read-only replicas next to it carrying read and reporting traffic.
- IPC1 holds the **Oracle Data Guard** standby plus one more read-only replica. Data Guard ships redo from the primary to it continuously, and the standby stays read-only until someone promotes it.
- Promotion is a decision an operator makes, not something that happens on its own. That's the point: one write site at a time, no split brain.
- Oracle is also the only hand-off between the two Temporal clusters, so it carries more than payment data: the Work Tracker rows that hold dated work, and the outbox and inbox.
- Short outages and patching windows don't fail payments. `PaymentStore`, the only code that touches Oracle, keeps retrying and then waits on a durable timer, so a payment pauses and carries on when the database is back. Dispatchers stop releasing new work for as long as Oracle is unhealthy.
- This is the [same Oracle setup](../build/principles/tech-stack/database.md) the DBO team runs day to day.

## Temporal

- **Temporal** is self-hosted on **EKS** in AWS us-east-1, as two separate clusters: Online, for journeys where a caller waits, and Offline, for work that can be paced. The frontend, history, matching and worker services of each run as pods there.
- Each cluster has its own **Aurora PostgreSQL** database for its histories and its own **OpenSearch 2** store for visibility, the search behind the Temporal UI. Online runs 2,000 history shards and Offline 4,000, a number fixed when a cluster is created.
- Nothing calls from one cluster to the other. A payment scheduled on Online reaches Offline through Oracle, so either cluster can go down while the other keeps working.
- **us-west-1 holds a passive standby for each cluster**, with its database replicated from the east. Neither serves anything in normal operation. Each is promoted on its own, by hand, the same rule as the Oracle standby in IPC1: one write site at a time, no split brain.
- Only IPC2's apps talk to the clusters, over gRPC: the Online app to both, the Offline app to Offline. IPC1's apps are wired the same way but carry nothing until they're promoted.
- Workflow state lives in each cluster's database, never in worker memory. Restart the workers and in-flight payments carry on from their event histories.
- Cluster settings are on the [Temporal Server](../deployment/temporal-server.md) page.

### Why AWS and not Hydra

Temporal is the only part of the platform that does not run on Hydra. Its clusters sit in AWS instead, and the three reasons for that are all about the way Kubernetes runs in each place.

<Principles
  items={[
    {
      term: 'EKS across Availability Zones',
      desc: `Temporal's services talk to each other constantly, so a cluster needs Kubernetes with pod-to-pod communication left alone. AWS lets us run EKS across several Availability Zones in a region.`,
    },
    {
      term: 'Hydra Multi AZ EKS Bottleneck',
      desc: `Hydra does not form an EKS cluster across zones within a region, so the cluster would sit in a single zone. That caps how available the application can be.`,
    },
    {
      term: 'Istio proxy hindrance',
      desc: `On Hydra, the istio-proxy sits in the middle of pod traffic. Pod-to-pod is exactly the path Temporal depends on to operate.`,
    },
  ]}
/>

## When things break

| What fails | What happens |
| --- | --- |
| **The Online app in IPC2** | Both One-Data instances keep answering callers and park their requests in **Redis**. **RTF** replays them into the core APIs once they're back, or once an operator promotes the IPC1 app. Nothing is dropped, it just processes late. |
| **The Offline app in IPC2** | Dispatchers and relays stop, so dated work, notifications and events wait in Oracle. Nothing is lost. Work resumes when the app returns or its IPC1 standby is promoted. |
| **A whole site** | Losing IPC1 costs the front door on that side and nothing else, since IPC1 was already sending its traffic east. Losing IPC2 leaves IPC1's One-Data answering and parking in Redis until an operator promotes the apps and the **Data Guard** standby there. |
| **Oracle primary** | `PaymentStore` waits out a short outage or a patch on its own. A longer one means promoting the standby in IPC1. Until then, reads still work off the read-only replicas, but nothing new can be written. |
| **The Online cluster** | Journeys where a caller waits can't start until the cluster returns or an operator promotes its us-west-1 standby. The Offline cluster carries on, since nothing calls across. |
| **The Offline cluster** | Dated work waits in Oracle, async starts get 503 with `Retry-After` and their senders retry, and relays pause, so notifications and events wait in the outbox. The Online cluster keeps serving. The fix is to restore the cluster or promote its standby. |
| **All of us-east-1** | Both clusters stop at once. Moving Temporal to us-west-1 is covered [below](#when-us-east-1-goes-down). |

When one cluster goes down and comes back, nothing is lost: every history is in the cluster's database rather than in a worker, so workflows resume exactly where they stopped. That is the durability Temporal was [chosen for](./overview.md#why-temporal).

## When us-east-1 goes down

Both Temporal clusters run in us-east-1, so a regional outage takes them out together. Nothing moves to us-west-1 on its own. One write site at a time is the rule for Temporal, just as it is for Oracle, so switching regions is a decision an operator makes.

While the region is down:

- Journeys where a caller waits can't start, because there is no cluster to start them on.
- Async starts from Accounts Receivable, returns and inbound get 503 with `Retry-After`, and their senders try again later.
- Scheduled payments, notifications and lifecycle events wait in Oracle. Nothing that falls due is lost; it is only late.

To bring Temporal back in us-west-1:

1. An operator promotes the us-west-1 standby of each cluster to primary. The Online and Offline clusters are promoted separately, each with its own database.
2. The apps are pointed at the west. The Online app's two Temporal clients, one per cluster, and the Offline app's client switch to the us-west-1 frontends.
3. Work picks up again. Workflows carry on from the histories the standby received, dispatchers start claiming due rows, and the relays drain the outbox.

A step that ran just before the outage may run a second time after the switch. That is safe by design: every downstream call carries an idempotency key and every Oracle write is a guarded update, so the retry finds the work already done and money never moves twice. The step-by-step runbook sits with the other [SOPs](../operations/sops.md).

The front door stays open in both sites, and everything behind it runs in one place at a time. Moving that place is a call someone makes, and each cluster's standby is promoted on its own.
