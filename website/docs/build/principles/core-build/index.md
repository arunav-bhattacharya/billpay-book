---
title: Core Build
description: 'Tech Stack covers what we buy.'
sidebar_label: Core Build
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Core Build

<Lead>[Tech Stack](../tech-stack/index.md) covers what we buy. This covers what we write: how the component model from Design becomes code, one layer at a time, and the rules that keep each layer doing only its own job.</Lead>

The call chain is strict, **Workflow → Stage → Activity → Client → external system**, exactly as the [component model](../../../design/principles.md#the-four-layers) defines it. Nothing calls up or sideways. A stage may also call the checks and methods the stage resolver gives it, and plain helper functions, and a workflow may start child workflows, but only on its own cluster. The Router sits in front of all of it: it is the only code that starts a payment workflow.

## In this section

<SectionIndex
  items={[
    {
      term: 'Code layout',
      to: '/docs/build/principles/core-build/code-layout',
      desc: `The Gradle monorepo, where each layer lives, and the dependency rule the build enforces.`,
    },
    {
      term: 'Router',
      to: '/docs/build/principles/core-build/router',
      desc: `The library that admits, routes, pins and places every workflow start, in six steps.`,
    },
    {
      term: 'Workflows',
      to: '/docs/build/principles/core-build/workflows',
      desc: `Deterministic orchestration: one workflow per journey, its stages from the resolved profile, and the spec's sketch.`,
    },
    {
      term: 'Stages',
      to: '/docs/build/principles/core-build/stages',
      desc: `One business step each: the calls, one guarded commit, the announcement, naming, and the verification rules.`,
    },
    {
      term: 'Stage Resolver',
      to: '/docs/build/principles/core-build/stage-resolver',
      desc: `How a workflow finds its stages, checks and methods with no mapping code, worked through for Verify from the resolved profile to the commit.`,
    },
    {
      term: 'Activities',
      to: '/docs/build/principles/core-build/activities',
      desc: `The calls to one system: {System}Activities, PaymentStore for Oracle, and RTF and Raven as activities like the rest.`,
    },
    {
      term: 'Clients',
      to: '/docs/build/principles/core-build/clients',
      desc: `The adapters that talk to one external system each, and translate its contract at the boundary.`,
    },
  ]}
/>

If you are new, read them once in that order, from the start of a payment down to the wire.
