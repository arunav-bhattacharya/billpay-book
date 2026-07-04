---
title: Build
sidebar_position: 1
---

# Build

How the platform is built — the technology choices, the modules in the monorepo, the contracts exposed, the data model, and the schedules wired up at boot.

- [**Principles**](./principles/index.md) — the choices we've made for HTTP client, database, datasource, ORM.
- [**One-data**](./one-data.md) — the One-Data layer.
- [**Billpay-core**](./billpay-core/index.md) — the Billpay-core service.
- [**API Spec**](./api-spec/one-data.md) — public contracts.
- [**Data Model**](./data-model/domain.md) — domain and database models.
- [**Workflows · Services · Activities**](./workflows/interfaces.md) — interfaces and strategies.
- [**Schedules**](./schedules.md) — Temporal Schedules wired into batch executors.

The artifacts we actually ship live under [**Deployment › Deployables**](../deployment/deployables/index.md).
