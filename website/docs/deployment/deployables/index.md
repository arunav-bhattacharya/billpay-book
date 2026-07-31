---
title: Deployables
---

import Lead from '@site/src/components/Lead';

# Deployables

<Lead>Every artifact the platform **ships to production**. There are five, and the worker app that runs the workflows is the one most changes touch.</Lead>

- [**One-Data Functions** (API Gateway)](./one-data-functions.md)
- [**Worker App** (Online + Offline Temporal Workers, one JVM)](./worker-app.md)
- [**Codec Server App** (decrypts Temporal Web UI content)](./codec-server-app.md)
- [**UI App** (standalone UI on top of Billpay)](./ui-app.md)
- [**Mocks App** (until the E2E testing environment is ready)](./mocks-app.md)

The Temporal server itself is not a deployable of this monorepo. It is self-hosted infrastructure, covered under [Temporal Server](../temporal-server.md).
