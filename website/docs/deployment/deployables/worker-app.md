---
title: Worker App
description: 'One deployable, one JVM, both worker pools.'
---

import Lead from '@site/src/components/Lead';

# Worker App (Online + Offline Temporal Workers)

<Lead>One deployable, one JVM, both worker pools. The Worker App hosts the Online and Offline Temporal workers together, so deploying, scaling, and restarting happen at the level of this single app.</Lead>

The [Online/Offline split](../../design/component-model/workflows/index.md#workers) is **logical, not physical**. The two pools run side by side in the same JVM, each polling its own task queues, sharing the app's [connection pool](../../build/principles/tech-stack/datasource.md).

Deployment detail for the app is still to come. How the app reaches Temporal, and what happens when a region fails, is on the [High Availability](../../architecture/high-availability.md) page.
