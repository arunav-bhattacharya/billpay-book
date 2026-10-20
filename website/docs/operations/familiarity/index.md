---
title: Familiarity
description: 'The surfaces an operator should be comfortable with, from the UIs used every day down to the infrastructure underneath them.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Familiarity

<Lead>The surfaces an operator should be comfortable with, from the UIs used every day down to the infrastructure underneath them.</Lead>

Two things about this platform change where you look. There are two Temporal clusters, each with its own UI and its own database, so the first question about any workflow is which cluster ran it. And a lot of what is happening isn't in Temporal at all: scheduled payments wait in Oracle until they are due, and work nobody waits for waits in One-Data's inbox.

## In this section

<SectionIndex
  items={[
    {
      term: 'Temporal Web UI',
      to: '/docs/operations/familiarity/temporal-web-ui',
      desc: `One UI per cluster: finding a payment's workflows by ID and by search attribute, and why a scheduled payment has no workflow until its date.`,
    },
    {
      term: 'Market Onboarding UI',
      to: '/docs/operations/familiarity/billpay-ui',
      desc: `The onboarding control plane: a market's operations settings, the readiness of a release, and pausing a live market.`,
    },
    {
      term: 'OpenSearch Logs',
      to: '/docs/operations/familiarity/opensearch-logs',
      desc: `Saved searches, common queries, and retention.`,
    },
    {
      term: 'Tracing UI',
      to: '/docs/operations/familiarity/tracing-ui',
      desc: `Following one payment end to end, across workflows and clusters, from its ID alone.`,
    },
    {
      term: 'Temporal Server (AWS)',
      to: '/docs/operations/familiarity/temporal-server-aws',
      desc: `The two clusters' namespaces and task queues, the Offline cluster's priorities, and where the Schedules live.`,
    },
    {
      term: 'Temporal DB (AWS)',
      to: '/docs/operations/familiarity/temporal-db-aws',
      desc: `The two Aurora databases behind the clusters, how they are sized, and what the governor reads from the Offline one.`,
    },
    {
      term: 'Oracle DB',
      to: '/docs/operations/familiarity/oracle-db',
      desc: (
        <>What Oracle holds that Temporal doesn't, what happens during patching, and when to escalate on <code>#oracle-dbo-support</code>.</>
      ),
    },
    {
      term: 'Dispatch Controls',
      to: '/docs/operations/familiarity/dispatch-controls',
      desc: `How to steer offline work: dispatcher runs, rate overrides, pausing a Schedule or a market, the governor's decisions, and the exception list.`,
    },
  ]}
/>
