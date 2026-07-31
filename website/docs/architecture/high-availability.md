---
title: High Availability
sidebar_label: High Availability
---

import Lead from '@site/src/components/Lead';
import HADiagram from '@site/src/components/HADiagram';

# High Availability

<Lead>Billpay runs from **two on-prem Hydra sites**, IPC2 in the east and IPC1 in the west, against a **self-hosted Temporal cluster** in AWS us-east-1. The front half of the platform is live in both sites at once. The write side of the database is deliberately not, and neither is Temporal: both have a standby that only takes over when someone promotes it. And when billpay-core can't be reached, One-Data parks the request in Redis rather than turning the caller away.</Lead>

## Topology

<HADiagram />

## Front door

- One-Data Functions run active in both sites, so losing a site doesn't close the front door.
- Each site's One-Data calls the billpay-core in the same site. Traffic stays local.
- Each site also has a Redis store that sits empty most of the time. It's there for one case: billpay-core is unreachable.
- When that happens, One-Data writes the request into Redis instead of failing the caller, then replays it into billpay-core once the core is healthy again.
- The two Redis instances are one active-active database (Redis calls this a CRDB), so a request parked on one site is visible from the other.
- The trade is on purpose. The caller gets an answer now and the payment processes a little later. A core outage becomes a delay instead of a dropped payment.

## Core

- billpay-core is the REST APIs, the [Billpay Router](../design/routing.md), and the [Worker App](../deployment/deployables/worker-app.md) hosting both Temporal worker pools. An instance runs in each site.
- Both instances read from the Oracle in their own site, which keeps read latency close to the caller.
- Writes only land in IPC2, because that's where the Oracle primary lives.
- Both instances talk to the same Temporal cluster in us-east-1.

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
| **billpay-core in one site** | One-Data on that site keeps answering callers and parks their requests in Redis, then replays them when the core is back. Nothing is dropped, it just processes late. |
| **A whole site** | The other site keeps taking traffic on its own One-Data and core. If the lost site was IPC2, an operator promotes the Data Guard standby in IPC1 so writes have somewhere to land again. |
| **Oracle primary** | The standby in IPC1 is promoted. Until it is, reads still work off the read-only replicas, but nothing new can be written. |
| **Temporal in us-east-1** | No workflow can start or advance until either the cluster returns or an operator promotes the us-west-1 standby and billpay-core reconnects to it. Either way nothing is lost: every history is in Postgres rather than in a worker, so workflows resume exactly where they stopped. This is the durability Temporal was [chosen for](./overview.md#why-temporal). |

Two rules hold this together. The front door stays open on both sites, and there is only ever one place where writes land. Moving that place is a call someone makes, not something that happens by itself.
