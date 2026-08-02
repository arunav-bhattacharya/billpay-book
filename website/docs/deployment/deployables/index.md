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
      desc: `The API gateway, and the functions it fronts.`,
    },
    {
      term: 'Worker App',
      to: '/docs/deployment/deployables/worker-app',
      desc: `The Online and Offline Temporal workers, in one JVM.`,
    },
    {
      term: 'Codec Server App',
      to: '/docs/deployment/deployables/codec-server-app',
      desc: `Decrypts Temporal Web UI content, so workflow payloads read as plain data when you inspect them there.`,
    },
    {
      term: 'UI App',
      to: '/docs/deployment/deployables/ui-app',
      desc: `A standalone UI on top of Billpay.`,
    },
    {
      term: 'Mocks App',
      to: '/docs/deployment/deployables/mocks-app',
      desc: `A stand-in for downstream integrations until an end-to-end testing environment is ready.`,
    },
  ]}
/>

The Temporal server itself is not a deployable of this monorepo. It is self-hosted infrastructure, covered under [Temporal Server](../temporal-server.md).
