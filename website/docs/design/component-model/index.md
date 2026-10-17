---
title: Component Model
description: 'The design principles set out four layers and what each may call. These pages list what actually exists at three of them.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Component Model

<Lead>The [design principles](../principles.md) set out four layers and what each may call. These pages list what actually exists at three of them: every workflow, the thirteen stages those workflows run, and the activities the stages call.</Lead>

A journey reads top to bottom across the three. `ExecuteScheduledPaymentWorkflow` runs the Reverify, Execute and Fulfil stages in order. For a consumer payment, Execute calls `ClearingActivities`, `ReceivablesActivities` and `AuthorizationActivities` at the same time, each on its own rate-limited queue. Only the stages change between markets; the activities are shared, and none of them vary by behavior.

## In this section

<SectionIndex
  items={[
    {
      term: 'Workflows',
      to: '/docs/design/component-model/workflows',
      desc: `Every workflow, grouped as core, composite, periodic and control, with the cluster each runs on, its workflow ID and what starts it.`,
    },
    {
      term: 'Stages',
      to: '/docs/design/component-model/stages',
      desc: `The thirteen business steps the workflows compose: the move each makes, what it calls, and which behaviors change it.`,
    },
    {
      term: 'Activities',
      to: '/docs/design/component-model/activities',
      desc: `One activity interface per system, the task queue it runs on, and the stages that call it, plus PaymentStore, the only code that reaches Oracle.`,
    },
  ]}
/>
