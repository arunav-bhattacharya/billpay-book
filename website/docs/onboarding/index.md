---
title: Market Onboarding
description: "Adding a market to Billpay is a configuration change, as long as the deployed build can already run the market's behaviors."
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';
import OnboardingFlow from '@site/src/components/OnboardingFlow';

# Market Onboarding

<Lead>Adding a market to Billpay is a configuration change, as long as the deployed build can already run the market's behaviors. The market is described once in the Market Onboarding UI in Control Tower, frozen as a release, and sent to each environment through one API, where a workflow checks it, tests it and switches it on.</Lead>

Onboarding has its own frontend, backend and tables, kept apart from payments. That separation is deliberate. A market's config decides how real money moves, so it should change only through a path that is approved, versioned and tested, and never by someone editing a table in production.

## What onboarding decides

A market is onboarded one **market profile** at a time: one market and one account type, such as consumer accounts in Germany. For each profile, onboarding records:

- The Billpay APIs the profile takes, and its five behaviors, the answers that decide what each step of its payments does ([Market Profile](./market-profile.md)).
- The operations settings that drive it at runtime: its time zone and execution time, its cancellation window, its cutoff and more ([Operations Settings](./operations-settings.md)).

## From draft to live

<OnboardingFlow />

1. Freeze. When a release is approved, the Market Onboarding UI's backend saves the draft as release vN: the profile's full config as JSON, a checksum, the author and the approver. A release never changes; later edits become vN+1.
2. Send. The backend calls E1's Market Onboarding API with vN, using its own service identity. The call is idempotent, so sending the same release twice starts one workflow, not two.
3. Track. A deployment row per release and environment follows the workflow through requested, running, waiting for sign-off, active or failed. The readiness screen reads it.
4. Sign off. Once its test payments pass, someone signs off in the UI, and the backend sends the sign-off through the same API. In E3, which is production, the change request (RFC) must pass the ServiceNow check first.
5. Promote. Once vN is active and signed off in E1, the same vN goes to E2, then to E3.
6. Enable traffic. A new market's traffic is enabled only once vN is live in E3. Market profiles change rarely, and every change is tested in the lower environments before it reaches production.

There are only two human checks: approval once, on the content, by a maker and a different checker; and sign-off in each environment, after its test payments pass.

## What runs where

| Part | What it is | Lives in |
| --- | --- | --- |
| Market Onboarding UI frontend | The onboarding wizard, with an Operations step, BOTH rules, and pause and resume | The control plane |
| Market Onboarding UI backend | The control plane itself: single sign-on, maker-checker, audit, versioned releases | The control plane, one for all environments |
| Authoring tables | Drafts, revisions, releases, approvals, deployments and audit | The control plane's own schema, outside billpay-core |
| Market Onboarding API | Takes releases, sign-offs, pause and resume; reports progress and the build's capability manifest | Each environment's app |
| `MarketOnboardingWorkflow` | Checks, tests and activates a release | Each environment's Offline cluster |
| Published config | `market_config_version` and `market_config_active` | Each environment's billpay-core database |

The control plane never reads or writes an environment's Oracle or Temporal, and an environment never reads the authoring tables. Everything crosses through the Market Onboarding API.

## In this section

<SectionIndex
  items={[
    {
      term: 'Market Profile',
      to: '/docs/onboarding/market-profile',
      desc: `One market and account type: the APIs it takes, its five behaviors (four of them Y, N or BOTH), and what the build's capability manifest allows.`,
    },
    {
      term: 'Operations Settings',
      to: '/docs/onboarding/operations-settings',
      desc: `Each setting in the Operations step, and the part of Billpay it drives at runtime.`,
    },
    {
      term: 'Releases and Environments',
      to: '/docs/onboarding/releases',
      desc: `Maker-checker approval, frozen versions, promotion from E1 to E3, test payments, sign-off, the RFC, rollback, and pausing a live market.`,
    },
    {
      term: 'Market Onboarding API',
      to: '/docs/onboarding/market-onboarding-api',
      desc: `The Market Onboarding API, the five steps of MarketOnboardingWorkflow, the published config tables, and how new payments pick up a version.`,
    },
  ]}
/>
