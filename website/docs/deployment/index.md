---
title: Deployment
description: 'How code moves from a pull request to production: the artifacts we ship, the checks every change must pass, and the pipeline that promotes it.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Deployment

<Lead>How code moves from a pull request to production: the artifacts we ship, the checks every change must pass, and the pipeline that promotes it.</Lead>

Market releases don't travel this way. A new market, or a change to one, is config rather than code: the Market Onboarding UI in Control Tower sends the frozen release to each environment's Market Onboarding API, E1 first, then E2, then E3, and no deploy is involved. A market needs a deploy only when it asks for a behavior combination the running build can't do yet. [Market Onboarding](../onboarding/index.md) follows a release. This section follows the code.

## In this section

<SectionIndex
  items={[
    {
      term: 'Deployables',
      to: '/docs/deployment/deployables',
      desc: `The five things we ship: billpay-core, One-Data's functions and inbox, the Market Onboarding UI, the codec server and the mocks.`,
    },
    {
      term: 'CI Checks',
      to: '/docs/deployment/ci-checks',
      desc: `The checks every pull request must pass before it merges.`,
    },
    {
      term: 'Code Merge Strategy',
      to: '/docs/deployment/code-merge-strategy',
      desc: `How pull requests are reviewed, approved and merged.`,
    },
    {
      term: 'Deployment Pipeline',
      to: '/docs/deployment/pipeline',
      desc: `How one build reaches production, why old builds keep running for a while, and what each environment sets for itself.`,
    },
    {
      term: 'Temporal Server',
      to: '/docs/deployment/temporal-server',
      desc: `The two self-hosted Temporal clusters: their settings, their standbys, and what runs on each.`,
    },
  ]}
/>
