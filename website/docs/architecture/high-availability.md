---
title: High Availability
sidebar_label: High Availability
---

import Lead from '@site/src/components/Lead';
import HADiagram from '@site/src/components/HADiagram';

# High Availability

<Lead>Billpay runs across **two on-prem Hydra sites and two AWS regions**, and every component answers the same question differently: what happens when your half of the world goes away? The entry layer is active-active, the core and the databases are active-passive — and a Redis buffer makes sure a billpay-core outage delays processing rather than losing it.</Lead>

## The topology

<HADiagram />

## The entry layer: active-active, with a buffer

**One-Data Functions run active on both sites** — the on-prem Hydra servers in US East (IPC2) and US West (IPC1) — so the front door survives the loss of either site. Both route requests to the active billpay-core on the East.

The interesting piece is the **Redis instance the gateway shares** — active-active across both sites, and empty in normal operation. It exists for exactly one scenario: **billpay-core is down.** When the gateway can't reach the core — for whatever reason — it writes the request into Redis instead of failing the caller, and **One-Data replays** the buffered requests into billpay-core once it's healthy again. The trade is deliberate: availability now, processing eventually. A core outage becomes a processing delay instead of a dropped payment.

## The core: active on East, passive on West

**billpay-core** — the REST APIs, the Billpay Router, and the [Worker App](../deployment/deployables/worker-app.md) hosting both Temporal worker pools — runs **active on the East Hydra site (IPC2)** and holds a **passive on the West (IPC1)**, promoted if the East is lost. The active core connects to the Temporal cluster in **us-east-1** by default.

## The data: replicated, promoted on failure

- **Oracle** — the payments schema is **active-passive with Data Guard replication**: primary on the East (IPC2), standby on the West (IPC1). This is the [same Oracle setup](../build/principles/tech-stack/database.md) whose operations the DBO team runs.
- **Temporal** — **self-hosted on AWS with PostgreSQL persistence**: the active cluster in **us-east-1**, a passive standby in **us-west-1** with replicated Postgres. Failover is a **manual promotion**; billpay-core reconnects to the west cluster, and because every workflow's state lives in the replicated persistence — not in worker memory — in-flight payments resume from their event histories. Deployment detail is on the [Temporal Server](../deployment/temporal-server.md) page.

## How failures play out

| Failure | What happens |
| --- | --- |
| **billpay-core down** (either instance state) | One-Data keeps accepting requests and buffers them in Redis. When the core is back, One-Data replays the buffer — every request eventually processes. |
| **East site (IPC2) lost** | West One-Data keeps the front door open; the passive billpay-core on IPC1 is promoted; Oracle's Data Guard standby on the West is promoted. Requests buffered in Redis during the switch replay afterwards. |
| **Temporal us-east-1 lost** | An operator promotes the us-west-1 standby; billpay-core reconnects; workflows replay from their persisted histories and carry on. No workflow state is lost — durability is the platform's [founding bet](./overview.md). |

The pattern across all three: the **front door stays open** (active-active gateway + buffer), while the **stateful tiers fail over deliberately** (promotion, not split-brain) — availability at the edge, consistency at the core.
