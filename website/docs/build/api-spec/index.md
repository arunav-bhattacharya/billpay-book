---
title: API Spec
sidebar_label: API Spec
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# API Spec

<Lead>Two contract layers stand between a channel and a workflow. <strong>One-Data Functions</strong> are the versioned public contracts the rest of Amex integrates with; each delegates to a <strong>Billpay core REST API</strong>, where the router decides which workflow runs. Most integration questions come down to knowing which of the two layers you are in.</Lead>

<SectionIndex
  items={[
    {
      term: 'One-Data Functions',
      to: '/docs/build/api-spec/one-data',
      desc: `is the gateway. Every function, what it is for, and which core API it delegates to, including the event-handler functions that bring asynchronous outcomes back in.`,
    },
    {
      term: 'Billpay Core APIs',
      to: '/docs/build/api-spec/billpay-core',
      desc: `is the REST surface. Each endpoint, how the router branches it to a workflow, and how idempotency is enforced at the boundary.`,
    },
  ]}
/>

Request and response schemas live with the code as OpenAPI definitions and are rendered from there. These pages document the contract *structure*, not the field lists.
