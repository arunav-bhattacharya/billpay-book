---
title: Worker App
---

import Lead from '@site/src/components/Lead';

# Worker App (Online + Offline Temporal Workers)

<Lead>One deployable, one JVM, both worker pools. The Worker App hosts the **Online Temporal Workers** — the immediate, API-triggered workflows a caller is waiting on — and the **Offline Temporal Workers** that carry the scheduled, event-driven, and periodic work.</Lead>

The Online/Offline split is **logical, not physical**: the two worker pools run side by side in the same JVM, each polling its own task queues, sharing the app's [Agroal connection pool](../../build/principles/tech-stack/datasource.md). Deploying, scaling, and restarting happen at the level of this single app.

Deployment detail for the app is still to come. Which workflows run on which worker — and why — is covered in [Design › Workflows](../../design/workflows/index.md); how the app reaches Temporal, and what happens when a region fails, is on the [High Availability](../../architecture/high-availability.md) page.
