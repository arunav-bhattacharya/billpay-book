---
title: Testing
description: "Billpay's tests split into two tracks."
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Testing

<Lead>Billpay's tests split into two tracks. **Functional** tests (unit, integration, replay and end-to-end) prove the platform does the right thing. **Non-functional** tests prove it keeps doing it at the volumes the midnight runs bring.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Functional',
      to: '/docs/testing/functional',
      desc: `Unit, integration, replay and end-to-end tests, from one stage on its own out to the real integrations.`,
    },
    {
      term: 'Non-Functional',
      to: '/docs/testing/non-functional',
      desc: `The seven load-test runs that show whether the design holds, and what each one must show to pass.`,
    },
  ]}
/>
