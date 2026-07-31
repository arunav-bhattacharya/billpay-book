---
title: High Availability
sidebar_label: High Availability
---

import Lead from '@site/src/components/Lead';
import HADiagram from '@site/src/components/HADiagram';

# High Availability

<Lead>Billpay runs from **two on-prem Hydra sites**, IPC2 in the east and IPC1 in the west, against a **self-hosted Temporal cluster** in AWS us-east-1. Only the front door is live in both sites. Everything behind it processes in one place at a time: billpay-core, the write side of the database and Temporal each have a standby that does nothing until someone promotes it. And when billpay-core can't be reached, One-Data parks the request in Redis rather than turning the caller away.</Lead>

## Topology

<HADiagram />

## Front door

- One-Data Functions run active in both sites, so losing a site doesn't close the front door.
- Both of them call the same billpay-core, the one in IPC2. IPC1's One-Data routes across.
- Each site also has a Redis store that sits empty most of the time. It's there for one case: billpay-core is unreachable.
- When that happens, One-Data writes the request into Redis instead of failing the caller, then replays it into billpay-core once the core is healthy again.
- The two Redis instances are one active-active database (Redis calls this a CRDB), so a request parked on one site is visible from the other.
- The trade is on purpose. The caller gets an answer now and the payment processes a little later. A core outage becomes a delay instead of a dropped payment.

## Core

- billpay-core is the REST APIs, the [Billpay Router](../design/routing.md), and the [Worker App](../deployment/deployables/worker-app.md) hosting both Temporal worker pools. An instance is deployed in each site, but only IPC2's takes traffic.
- It reads and writes the Oracle primary next to it in IPC2, and it is the only thing connected to the Temporal cluster in us-east-1.
- The IPC1 instance is a standby. It stays deployed and ready, and an operator promotes it if IPC2 goes.
- So there is one write path and one worker pool, which is also one place to look when a payment is stuck.

## Oracle

- The payments schema is active-passive. The read/write primary is in IPC2, with two read-only replicas next to it carrying read and reporting traffic.
- IPC1 holds the Data Guard standby plus one more read-only replica. The standby stays read-only until someone promotes it.
- Promotion is a decision an operator makes, not something that happens on its own. That's the point: one write site at a time, no split brain.
- This is the [same Oracle setup](../build/principles/tech-stack/database.md) the DBO team runs day to day.

## Temporal

- Temporal is self-hosted on an EKS cluster in AWS us-east-1. The frontend, history, matching and worker services all run as pods there. This is the active cluster, and the only one taking traffic.
- Persistence is PostgreSQL: one writer with two read replicas. This is Temporal's own database, not Billpay's Oracle.
- **us-west-1 holds a passive standby**, with its Postgres replicated from the east. It serves nothing in normal operation. Promoting it is a manual call, the same rule as the Oracle standby in IPC1: one write site at a time, no split brain.
- Both billpay-core instances connect to the active cluster over gRPC to start workflows and poll for work.
- Workflow state lives in that Postgres, never in worker memory. Restart the workers and in-flight payments carry on from their event histories.
- Cluster detail is on the [Temporal Server](../deployment/temporal-server.md) page.

## When things break

| What fails | What happens |
| --- | --- |
| **billpay-core in IPC2** | Both One-Data instances keep answering callers and park their requests in Redis, then replay them when the core is back. Nothing is dropped, it just processes late. |
| **A whole site** | Losing IPC1 costs the front door on that side and nothing else, since IPC1 was already sending its traffic east. Losing IPC2 leaves IPC1's One-Data answering and parking in Redis until an operator promotes the billpay-core and the Data Guard standby there. |
| **Oracle primary** | The standby in IPC1 is promoted. Until it is, reads still work off the read-only replicas, but nothing new can be written. |
| **Temporal in us-east-1** | No workflow can start or advance until either the cluster returns or an operator promotes the us-west-1 standby and billpay-core reconnects to it. Either way nothing is lost: every history is in Postgres rather than in a worker, so workflows resume exactly where they stopped. This is the durability Temporal was [chosen for](./overview.md#why-temporal). |

Two rules hold this together. The front door stays open on both sites, and everything behind it runs in one place at a time. Moving that place is a call someone makes, not something that happens by itself.
