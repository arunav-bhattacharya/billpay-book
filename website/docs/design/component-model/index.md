---
title: Component Model
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Component Model

<Lead>The [design principles](../principles.md) set out five layered components and the rule that each may only call the layers beneath it. These pages take three of those layers and list what actually exists: every workflow, every stage, and every activity group the platform runs.</Lead>

## Pages in this section

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Workflows',
      to: '/docs/design/component-model/workflows',
      desc: `Every payment journey the platform orchestrates, split into core, composite, and periodic, with the worker each one runs on and the behaviors it varies by.`,
    },
    {
      term: 'Stages',
      to: '/docs/design/component-model/stages',
      desc: `The sixteen state-transition steps workflows compose, what each one does, and which workflows run it.`,
    },
    {
      term: 'ActivityGroups & Activities',
      to: '/docs/design/component-model/activities',
      desc: `The retryable actions the stages call: what each one does, which stage or workflow invokes it, and whether its behavior varies by market.`,
    },
  ]}
/>
