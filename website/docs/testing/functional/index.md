---
title: Functional Testing
description: 'Four layers of functional tests, from the innermost out: unit, integration, replay, and end-to-end.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Functional Testing

<Lead>Four layers of functional tests, from the innermost out: **unit**, **integration**, **replay**, and **end-to-end**.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Unit',
      to: '/docs/testing/functional/unit',
      desc: `covers workflow and activity tests built on Temporal's testing primitives.`,
    },
    {
      term: 'Integration',
      to: '/docs/testing/functional/integration',
      desc: `uses TestContainers where a dependency can run for real, and mocks where it cannot yet.`,
    },
    {
      term: 'Replay',
      to: '/docs/testing/functional/replay',
      desc: `covers the Temporal replay tests that guard workflow determinism.`,
    },
    {
      term: 'E2E',
      to: '/docs/testing/functional/e2e',
      desc: `covers manual or automated runs against actual API integrations.`,
    },
  ]}
/>
