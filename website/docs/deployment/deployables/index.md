---
title: Deployables
description: 'Every artifact the platform ships to production.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Deployables

<Lead>Every artifact the platform **ships to production**. There are five, and the worker app that runs the workflows is the one most changes touch.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'One-Data Functions',
      to: '/docs/deployment/deployables/one-data-functions',
      desc: `API Gateway`,
    },
    {
      term: 'Worker App',
      to: '/docs/deployment/deployables/worker-app',
      desc: `Online + Offline Temporal Workers, one JVM`,
    },
    {
      term: 'Codec Server App',
      to: '/docs/deployment/deployables/codec-server-app',
      desc: `decrypts Temporal Web UI content`,
    },
    {
      term: 'UI App',
      to: '/docs/deployment/deployables/ui-app',
      desc: `standalone UI on top of Billpay`,
    },
    {
      term: 'Mocks App',
      to: '/docs/deployment/deployables/mocks-app',
      desc: `until the E2E testing environment is ready`,
    },
  ]}
/>

The Temporal server itself is not a deployable of this monorepo. It is self-hosted infrastructure, covered under [Temporal Server](../temporal-server.md).
