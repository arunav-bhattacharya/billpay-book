---
title: Deployables
---

import Lead from '@site/src/components/Lead';

# Deployables

<Lead>Every artifact the platform **ships to production** — five deployables in all, from the API gateway functions to the worker app that runs the workflows.</Lead>

- [**One-Data Functions** (API Gateway)](./one-data-functions.md)
- [**Worker App** (Online + Offline Temporal Workers, one JVM)](./worker-app.md)
- [**Codec Server App** (decrypts Temporal Web UI content)](./codec-server-app.md)
- [**UI App** (standalone UI on top of Billpay)](./ui-app.md)
- [**Mocks App** (until the E2E testing environment is ready)](./mocks-app.md)

The Temporal server itself isn't a deployable of this monorepo — it's self-hosted infrastructure, covered under [Temporal Server](../temporal-server.md).
