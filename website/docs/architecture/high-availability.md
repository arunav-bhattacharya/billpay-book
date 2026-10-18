---
title: High Availability
description: 'Billpay runs from two on-prem Hydra sites, IPC2 in the east and IPC1 in the west, against two self-hosted Temporal clusters in AWS us-east-1.'
sidebar_label: High Availability
---

import Lead from '@site/src/components/Lead';
import Principles from '@site/src/components/Principles';
import HADiagram from '@site/src/components/HADiagram';

# High Availability

<Lead>Billpay runs from **two on-prem Hydra sites**, IPC2 in the east and IPC1 in the west, against **two self-hosted Temporal clusters** in AWS us-east-1. Only the front door is live in both sites. Everything behind it processes in one place at a time: the app, the write side of the database and each Temporal cluster have a standby that does nothing until someone promotes it. And when the core APIs are slow or can't be reached, One-Data holds a new payment in **Redis** rather than turning the caller away, for **RTF** to retry later.</Lead>

## Topology

<HADiagram />

## Front door

- One-Data Functions run active in both sites, so losing a site doesn't close the front door.
- Both of them call the same core APIs, the ones in IPC2's app. IPC1's One-Data routes across.
- Each site also has a **Redis** store. The two are one active-active database (Redis calls this a CRDB), so what one site writes, the other can read.
- One-Data writes every new payment to Redis before it calls the core APIs, in the same call that checks the card account for other pending payments. If one is still pending, the customer is asked to confirm the new payment before it goes ahead. That stops a customer who wasn't sure the first payment went through from paying twice by mistake. [Pay while another payment is pending](../design/journeys/index.md#pay-while-another-payment-is-pending) walks through it.
- If the core APIs don't answer within 3 seconds, or answer with an error, One-Data hands the stored payment to **RTF** (the Reliable Transaction Framework) instead of failing the caller. RTF retries it into the core, with the same payment ID, until it lands. Only new payments are held this way. A confirm, an update or a cancel needs the core.
- When a payment's workflow ends, billpay-core tells One-Data, which clears the payment out of Redis. Persistence is on and nothing is evicted, so a restart or a full memory can't lose an entry.
- The trade is on purpose. The caller gets an answer now and the payment processes a little later. An outage in the core becomes a delay instead of a dropped payment.

## The app

billpay-core is one app that runs the work for both Temporal clusters.

- It runs the REST APIs, the [Billpay Router](../design/routing.md), the dispatchers, the governor and the workers for both clusters, with a Temporal client for each.
- Offline work has its own Oracle connection pool and a cap on how many offline tasks run at once, so it can never take a whole pod. The governor also cuts offline rates as soon as online response times climb.
- It ships and deploys as one app. There is no separate online or offline app: when it needs more capacity, it gets more pods of the same app.
- It runs in IPC2. IPC1 keeps a standby of the same app, deployed and ready, which an operator promotes if IPC2 goes.
- It reads and writes the Oracle primary next to it in IPC2, and it is the only component that talks to Temporal.
- So each kind of work runs in exactly one place, which is also one place to look when a payment is stuck. Deployment detail is on the [billpay-core deployable page](../deployment/deployables/worker-app.md).

## Oracle

- The payments schema is active-passive. The read/write primary is in IPC2, with two read-only replicas next to it carrying read and reporting traffic.
- IPC1 holds the **Oracle Data Guard** standby plus one more read-only replica. Data Guard ships redo from the primary to it continuously, and the standby stays read-only until someone promotes it.
- Promotion is a decision an operator makes, not something that happens on its own. That's the point: one write site at a time, no split brain.
- Oracle is also the only hand-off between the two Temporal clusters, so it carries more than payment data: the Work Tracker rows that hold dated work. Work nobody waits for, from bulk intake and inbound payments to returns, settlement and posting, is held in One-Data's inbox instead, and Billpay pulls it from there. The inbox is a Postgres database of its own, separate from Temporal's, with one primary replicated across IPC1 and IPC2.
- Short outages and patching windows don't fail payments. `PaymentStore`, the only code that touches Oracle, keeps retrying and then waits on a durable timer, so a payment pauses and carries on when the database is back. Dispatchers stop releasing new work for as long as Oracle is unhealthy.
- This is the [same Oracle setup](../build/principles/tech-stack/database.md) the DBO team runs day to day.

## Temporal

- **Temporal** is self-hosted on **EKS** in AWS us-east-1, as two separate clusters: Online, for journeys where a caller waits, and Offline, for work that can be paced. The frontend, history, matching and worker services of each run as pods there.
- Each cluster has its own **Aurora PostgreSQL** database for its histories and its own **OpenSearch 2** store for visibility, the search behind the Temporal UI. Online runs 2,000 history shards and Offline 4,000, a number fixed when a cluster is created.
- Nothing calls from one cluster to the other. A payment scheduled on Online reaches Offline through Oracle, so either cluster can go down while the other keeps working.
- **us-west-1 holds a passive standby for each cluster**, with its database replicated from the east. Neither serves anything in normal operation. Each is promoted on its own, by hand, the same rule as the Oracle standby in IPC1: one write site at a time, no split brain.
- Only the app in IPC2 talks to the clusters, over gRPC, with a client for each. Its standby in IPC1 is wired the same way but carries nothing until it's promoted.
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
| **The app in IPC2** | Both One-Data instances keep taking new payments and hold them in **Redis**, and work nobody waits for keeps landing in One-Data's inbox. A confirm, an update or a cancel gets an error until the app is back. Dispatchers stop and the workers go quiet, so dated work waits in Oracle and running payments pause where they are. Nothing is dropped: **RTF** retries the held payments and work resumes once the app is back, or once an operator promotes the IPC1 standby. |
| **A whole site** | Losing IPC1 costs the front door on that side and nothing else, since IPC1 was already sending its traffic east. Losing IPC2 leaves IPC1's One-Data answering and holding new payments in Redis until an operator promotes the app and the **Data Guard** standby there. |
| **Redis** | One-Data still creates payments, with no pending check and nothing stored, so a customer could pay twice while it lasts. That is the working rule until product confirms it. The fix is to restore Redis. |
| **Oracle primary** | `PaymentStore` waits out a short outage or a patch on its own. A longer one means promoting the standby in IPC1. Until then, reads still work off the read-only replicas, but nothing new can be written. |
| **One-Data's inbox** | Nothing new can be stored, so senders of bulk intake, inbound payments, returns, settlement and posting get an error and retry. Payments stay `PROCESSED` until the inbox is back. Nothing is lost: the dispatchers and `PAID` catch up on their own. |
| **The Online cluster** | Journeys where a caller waits can't start until the cluster returns or an operator promotes its us-west-1 standby. The Offline cluster carries on, since nothing calls across. |
| **The Offline cluster** | Dated work waits in Oracle and pulled work in One-Data's inbox, allocation callbacks get 503 with `Retry-After` and are sent again, and running offline payments pause, notifications included. The Online cluster keeps serving. The fix is to restore the cluster or promote its standby. |
| **All of us-east-1** | Both clusters stop at once. Moving Temporal to us-west-1 is covered [below](#when-us-east-1-goes-down). |

When one cluster goes down and comes back, nothing is lost: every history is in the cluster's database rather than in a worker, so workflows resume exactly where they stopped. That is the durability Temporal was [chosen for](./overview.md#why-temporal).

## When us-east-1 goes down

Both Temporal clusters run in us-east-1, so a regional outage takes them out together. Nothing moves to us-west-1 on its own. One write site at a time is the rule for Temporal, just as it is for Oracle, so switching regions is a decision an operator makes.

While the region is down:

- Journeys where a caller waits can't start, because there is no cluster to start them on.
- Bulk intake from Accounts Receivable, returns and inbound payments wait in One-Data's inbox. Allocation callbacks get 503 with `Retry-After`, and the allocations manager tries again later.
- Scheduled payments wait in Oracle, and payments that were running pause, notifications included. Nothing that falls due is lost; it is only late.

To bring Temporal back in us-west-1:

1. An operator promotes the us-west-1 standby of each cluster to primary. The Online and Offline clusters are promoted separately, each with its own database.
2. The app is pointed at the west: its two Temporal clients, one per cluster, switch to the us-west-1 frontends.
3. Work picks up again. Workflows carry on from the histories the standby received, including any notifications they still owed, and dispatchers start releasing due rows and pulling from One-Data's inbox.

A step that ran just before the outage may run a second time after the switch. That is safe by design: every downstream call carries an idempotency key and every Oracle write is a guarded update, so the retry finds the work already done and money never moves twice. The step-by-step runbook sits with the other [SOPs](../operations/sops.md).

The front door stays open in both sites, and everything behind it runs in one place at a time. Moving that place is a call someone makes, and each cluster's standby is promoted on its own.
