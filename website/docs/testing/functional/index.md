---
title: Functional Testing
description: 'Four layers of functional tests, from the innermost out: unit, integration, replay, and end-to-end.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Functional Testing

<Lead>Four layers of functional tests, from the innermost out: <strong>unit</strong>, <strong>integration</strong>, <strong>replay</strong>, and <strong>end-to-end</strong>. Each layer adds what the one inside it leaves out: real dependencies, then old histories, then the real integrations.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Unit',
      to: '/docs/testing/functional/unit',
      desc: `Workflow, stage and activity tests on Temporal's testing primitives, with each stage, check and method, and the profile lookup.`,
    },
    {
      term: 'Integration',
      to: '/docs/testing/functional/integration',
      desc: `TestContainers where a dependency can run for real, and mocks where it can't yet.`,
    },
    {
      term: 'Replay',
      to: '/docs/testing/functional/replay',
      desc: `The replay tests that guard workflow determinism.`,
    },
    {
      term: 'E2E',
      to: '/docs/testing/functional/e2e',
      desc: `Manual or automated runs against the real API integrations.`,
    },
  ]}
/>
