---
title: Core Build
sidebar_label: Core Build
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Core Build

<Lead>[Tech Stack](../tech-stack/index.md) covers what we buy. This covers what we write: how the component model from Design becomes code, one layer at a time, and the rules that keep each layer doing only its own job.</Lead>

The call chain is strict, **Workflow → Stage → ActivityGroup → Activity → Client → external system**, exactly as the [component model](../../../design/principles.md) defines it. Each page below is a how-to for one link in it.

<SectionIndex
  items={[
    {
      term: 'Code layout',
      to: '/docs/build/principles/core-build/code-layout',
      desc: `covers the Gradle monorepo, where each component lives, and the dependency rule the build enforces.`,
    },
    {
      term: 'Workflows',
      to: '/docs/build/principles/core-build/workflows',
      desc: `covers deterministic orchestration: one workflow per journey, composed from stages, with the spec's worked example.`,
    },
    {
      term: 'Stages',
      to: '/docs/build/principles/core-build/stages',
      desc: `covers the state transitions, one each, typed by the domain model.`,
    },
    {
      term: 'Activities & ActivityGroups',
      to: '/docs/build/principles/core-build/activities',
      desc: `covers the I/O units and the groups that compose them.`,
    },
    {
      term: 'Clients',
      to: '/docs/build/principles/core-build/clients',
      desc: `covers the adapters that actually talk to external systems.`,
    },
  ]}
/>

If you are new, read them once in that order, top of the chain to the bottom.
