---
title: Journeys
---

import Lead from '@site/src/components/Lead';

# Journeys

<Lead>A payment reaches a workflow one of two ways: a request arrives through the APIs, or a scheduler fires. Both pass through the Billpay Router, which reads the request and the market's dimensions and picks the workflow to run.</Lead>

- **[APIs](./apis.md)** — how each One-Data function and core API routes to a workflow, and the child workflows a payment fans out into.
- **[Schedulers](./schedulers.md)** — which periodic workflow each Temporal Schedule drives.
