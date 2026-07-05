---
title: Temporal Server
---

import Lead from '@site/src/components/Lead';

# Temporal Server

<Lead>Temporal is <strong>self-hosted on AWS</strong>, with <strong>PostgreSQL</strong> as its persistence backend. The active cluster runs in <strong>us-east-1</strong>; <strong>us-west-1</strong> holds a passive standby. It's infrastructure we run, not an artifact the monorepo ships — which is why it lives here rather than under Deployables.</Lead>

## The setup

- **Active cluster — us-east-1.** The Temporal server the platform actually talks to. The [Worker App](./deployables/worker-app.md) (billpay-core's Online and Offline workers, on the on-prem East Hydra servers) connects here by default, and the Temporal Schedules that drive the periodic workflows are registered against it.
- **Persistence — PostgreSQL.** Temporal's own state — workflow histories, task queues, schedules — lives in Postgres on AWS. This is Temporal's database, separate from Billpay's own [Oracle schema](../build/principles/tech-stack/database.md).
- **Passive region — us-west-1.** A standby cluster with replicated Postgres. It takes no traffic in normal operation.

## Failover

Failover to us-west-1 is a **manual promotion**: during a us-east-1 outage an operator promotes the standby, and billpay-core reconnects to the west cluster. Because every workflow's state is in the replicated persistence layer — not in worker memory — in-flight payments resume from their event histories once workers reconnect; that durability is the property the whole platform [leans on](../architecture/overview.md).

The full regional picture — how Temporal's two regions line up with the on-prem Hydra sites, Oracle's Data Guard pair, and the Redis buffer — is on the [High Availability](../architecture/high-availability.md) page.

## Day-2 operations

Operational familiarity with the cluster lives under Operations: [Temporal Server on AWS](../operations/familiarity/temporal-server-aws.md) (namespaces, task queues, scaling), [Temporal DB on AWS](../operations/familiarity/temporal-db-aws.md) (the persistence layer), and the [Temporal Web UI](../operations/familiarity/temporal-web-ui.md) — noting that workflow payloads in the Web UI are decrypted via the [Codec Server](./deployables/codec-server-app.md).
