---
title: Core Build
sidebar_position: 2
---

# Core Build

The internal building blocks Billpay-core composes payments out of. Whereas [Tool Selection](../tool-selection/index.md) covers *which third-party libraries* we use, this section covers *how we organise our own code* into Temporal workflows, services and activities.

- [Temporal Workflows](./temporal-workflows.md) — orchestration: what must happen, in what order, with what retry policy.
- [Payment Services](./payment-services.md) — business-rule units that workflows compose; the place where market / account-type variance lives.
- [Temporal Activities](./temporal-activities.md) — the I/O-bearing wrappers that workflows actually invoke; the bridge from deterministic workflow code to the real world.
