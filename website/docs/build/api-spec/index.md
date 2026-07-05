---
title: API Spec
sidebar_label: API Spec
---

import Lead from '@site/src/components/Lead';

# API Spec

<Lead>Two contract layers stand between a channel and a workflow. <strong>One-Data Functions</strong> are the versioned public contracts the rest of Amex integrates with; each delegates to a <strong>Billpay core REST API</strong>, where the router decides which workflow runs. Keep the layers straight and every integration question has an obvious home.</Lead>

- **[One-Data Functions](./one-data.md)** — the gateway: every function, what it's for, and which core API it delegates to — including the event-handler functions that bring asynchronous outcomes back in.
- **[Billpay Core APIs](./billpay-core.md)** — the REST surface: each endpoint, how the router branches it to a workflow, and how idempotency is enforced at the boundary.

Request and response schemas live with the code as OpenAPI definitions and are rendered from there — these pages document the contract *structure*, not the field lists.
