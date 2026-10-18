---
title: Build Principles
description: 'The decisions that hold across billpay-core.'
sidebar_label: Principles
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Build Principles

<Lead>The decisions that hold across billpay-core. Each page records the alternatives we weighed and why the winner won, because knowing *why* Exposed beat Hibernate is what tells you how to use it well.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Tech Stack',
      to: '/docs/build/principles/tech-stack',
      desc: `What we buy: the third-party libraries and infrastructure we standardise on, each with the alternatives we weighed and why the winner won.`,
    },
    {
      term: 'Core Build',
      to: '/docs/build/principles/core-build',
      desc: `What we write: the Router, and how our own code is organised into workflows, stages, activities and clients, with the rules that keep those layers honest.`,
    },
  ]}
/>
