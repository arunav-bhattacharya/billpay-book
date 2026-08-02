---
title: Deployment
description: 'How code moves from a PR to production: the artifacts we ship, the checks every change must pass, and the pipeline that promotes it.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Deployment

<Lead>How code moves **from a PR to production**: the artifacts we ship, the checks every change must pass, and the pipeline that promotes it.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Deployables',
      to: '/docs/deployment/deployables',
      desc: `Every artifact the platform ships to production.`,
    },
    {
      term: 'CI Checks',
      to: '/docs/deployment/ci-checks',
      desc: `The checks every PR must pass before it merges.`,
    },
    {
      term: 'Code Merge Strategy',
      to: '/docs/deployment/code-merge-strategy',
      desc: `How PRs are reviewed, approved, and merged.`,
    },
    {
      term: 'Deployment Pipeline',
      to: '/docs/deployment/pipeline',
      desc: `How a merged commit is promoted through environments to production.`,
    },
  ]}
/>
