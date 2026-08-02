---
title: Familiarity
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Familiarity

<Lead>The surfaces an operator should be comfortable with, from the **UIs used every day** down to the **infrastructure underneath** them.</Lead>

<SectionIndex
  items={[
    {
      term: 'Temporal Web UI',
      to: '/docs/operations/familiarity/temporal-web-ui',
      desc: `covers workflow search, the history view, signals, and queries.`,
    },
    {
      term: 'Billpay UI',
      to: '/docs/operations/familiarity/billpay-ui',
      desc: `covers what each screen does and when to reach for it.`,
    },
    {
      term: 'OpenSearch Logs',
      to: '/docs/operations/familiarity/opensearch-logs',
      desc: `covers saved searches, common queries, and retention.`,
    },
    {
      term: 'Tracing UI',
      to: '/docs/operations/familiarity/tracing-ui',
      desc: `covers following a payment end to end.`,
    },
    {
      term: 'Temporal Server (AWS)',
      to: '/docs/operations/familiarity/temporal-server-aws',
      desc: `covers namespaces, task queues, and scaling considerations.`,
    },
    {
      term: 'Temporal DB (AWS)',
      to: '/docs/operations/familiarity/temporal-db-aws',
      desc: `covers the Temporal persistence layer on AWS.`,
    },
    {
      term: 'Oracle DB',
      to: '/docs/operations/familiarity/oracle-db',
      desc: (
        <>covers escalating Oracle DB issues via <code>#oracle-dbo-support</code>.</>
      ),
    },
  ]}
/>
