---
title: Deployables
description: 'Every artifact the platform ships to production.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Deployables

<Lead>Every artifact the platform ships to production. There are five, and billpay-core, the one app that runs the APIs and the workflows, is the one most changes touch.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'One-Data Functions',
      to: '/docs/deployment/deployables/one-data-functions',
      desc: `The API gateway, the functions it fronts, and the inbox database that holds work nobody waits for.`,
    },
    {
      term: 'billpay-core',
      to: '/docs/deployment/deployables/worker-app',
      desc: `The one app: the core APIs, the Router, the dispatchers, the governor and the workers for both Temporal clusters.`,
    },
    {
      term: 'Codec Server App',
      to: '/docs/deployment/deployables/codec-server-app',
      desc: `Decrypts Temporal Web UI content, so workflow payloads read as plain data when you inspect them there.`,
    },
    {
      term: 'billpay-ui',
      to: '/docs/deployment/deployables/ui-app',
      desc: `The market onboarding control plane: one for every environment, reaching each one only through its provisioning API.`,
    },
    {
      term: 'Mocks App',
      to: '/docs/deployment/deployables/mocks-app',
      desc: `A stand-in for downstream integrations until an end-to-end testing environment is ready.`,
    },
  ]}
/>

The two Temporal clusters are not deployables. They are self-hosted infrastructure, covered under [Temporal Server](../temporal-server.md).
