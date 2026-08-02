---
title: Deployment
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
      desc: `lists every artifact the platform ships to production.`,
    },
    {
      term: 'CI Checks',
      to: '/docs/deployment/ci-checks',
      desc: `covers the checks every PR must pass before it merges.`,
    },
    {
      term: 'Code Merge Strategy',
      to: '/docs/deployment/code-merge-strategy',
      desc: `covers how PRs are reviewed, approved, and merged.`,
    },
    {
      term: 'Deployment Pipeline',
      to: '/docs/deployment/pipeline',
      desc: `covers how a merged commit is promoted through environments to production.`,
    },
  ]}
/>
