---
title: Contributing
description: 'How to run the site on your machine, how a change gets published, and how to change a diagram without touching code.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Contributing to these docs

<Lead>How to run the site on your machine, how a change gets published, and how to change a diagram without touching code.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Run Locally',
      to: '/docs/contributing/run-locally',
      desc: `How to start the dev server and preview your changes.`,
    },
    {
      term: 'Publish',
      to: '/docs/contributing/publish',
      desc: <>How a push to <code>main</code> becomes the live site.</>,
    },
    {
      term: 'Diagram Studio',
      to: '/studio',
      desc: `Change a journey diagram by clicking on it, then propose the change on GitHub. Every journey's "Edit this diagram" opens it too.`,
    },
  ]}
/>
