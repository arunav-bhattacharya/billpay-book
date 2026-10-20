---
title: Onboarding Step by Step
description: 'Every onboarding job ends the same way: a frozen release that moves through E1, E2 and E3.'
sidebar_label: Step by Step
---

import Lead from '@site/src/components/Lead';
import OnboardingPaths from '@site/src/components/OnboardingPaths';

# Onboarding Step by Step

<Lead>Every onboarding job ends the same way: a frozen release that moves through E1, E2 and E3. What changes from job to job is what you do before the release, and what has to happen after it. This page walks through each path one step at a time.</Lead>

The unit of onboarding is a **profile**: one market and one account type. So "onboard Germany" really means onboarding DE consumer, then DE corporate, each with its own release. E3 is production, and the only environment that needs a change request (RFC).

## Which path are you on

| Path | Example | What's different about it |
| --- | --- | --- |
| [A new market](#path-1-a-new-market) | DE consumer, when nothing in DE is live | Everything is authored from scratch, and channels start sending once it is live in E3 |
| [A new account type in a live market](#path-2-a-new-account-type-in-a-live-market) | US corporate, with US consumer already live | A new profile with its own v1, beside a market that already takes payments |
| [A change to a live profile](#path-3-a-change-to-a-live-profile) | Raising the largest payment the market takes | A new version of the same profile; no traffic step |
| [A change that needs new code](#path-4-a-change-that-needs-new-code) | A behavior combination the build can't run yet | A build goes out first, through the deploy pipeline |

<OnboardingPaths />

## The manifest, in plain words

Before any path, it helps to know what the build can run. A **behavior combination** is an account type plus Y or N for each of the other four behaviors: AR posting, realtime clearing, mandate authorization and bank confirmation. The **capability manifest** is the list of combinations the deployed build of billpay-core can run.

Nobody writes the manifest by hand. When the app starts, the stage registries look at every stage, check and method class in the build and work out which combinations they cover. Mandate authorization Y needs `MandateCheck`, for example, so combinations with mandate authorization appear only once that class is in the build. It is the same lookup a workflow uses to find its stages, so the manifest and the running code can't disagree.

`GET /market-onboarding/capabilities` returns it, with the build version. The field names inside each entry are illustrative:

```json
{
  "buildVersion": "2026.10.3",
  "combinations": [
    { "accountType": "CONSUMER", "arPosting": "Y", "realtimeClearing": "Y",
      "mandateAuthorization": "Y", "bankConfirmation": "N" }
  ]
}
```

It is checked in three places:

1. While a profile is being authored, the Market Onboarding UI flags any combination missing from the manifest as needing a build.
2. When a release reaches an environment, the onboarding workflow's first step checks it against that environment's manifest, and stops there if a combination is missing.
3. Before a new build rolls out, the [deploy pipeline](../deployment/pipeline.md#the-capability-manifest) checks that its manifest still covers every release live in that environment.

A profile whose combinations are all in the manifest goes live with config alone. One that needs something new waits for a build.

## Path 1: a new market

1. **Check the build covers it.** As you set the profile's behaviors in the Market Onboarding UI, any combination missing from the manifest is flagged. If one is, take [path 4](#path-4-a-change-that-needs-new-code) first.
2. **Author the profile.** Pick the Billpay APIs the market takes and answer the five behaviors. Where a behavior is BOTH, set its rule: which journeys get Y, or for bank confirmation, which payment methods ([Market Profile](./market-profile.md)).
3. **Fill in the Operations step.** Time zone and execution time, cancellation window, cutoff, allocation timing for corporate payments, representment rules, which status changes send a Raven message, the bank-confirmation provider and window, the go-ahead setting, the verification rule settings and the expected volumes ([Operations Settings](./operations-settings.md)).
4. **Get it approved.** A second person checks the content and approves it. The backend then freezes it as release **v1**: the full profile as JSON, a checksum, the author and the approver. A release never changes after this.
5. **Send it to E1.** The backend calls E1's Market Onboarding API with v1. In E1, `MarketOnboardingWorkflow` checks v1 against the manifest, saves it as an inactive version with the Schedules, dispatcher settings and rate rows it needs, and sends test payments through it. The Router takes the pinned v1 for test accounts only, so nothing else sees it.
6. **Sign off in E1.** Once the test payments pass, someone signs off in the UI, and the backend sends the sign-off through the same API. The workflow activates v1: `market_config_active` points at it, its Schedules and settings go live, and every billpay-core pod reloads its copy of the config.
7. **Repeat in E2.** The same v1 goes to E2, and steps 5 and 6 run there.
8. **Repeat in E3, with the RFC.** Raise the change request first. The E3 sign-off counts only once the RFC passes the ServiceNow check.
9. **Channels start sending.** Live in E3 doesn't mean traffic. Payments come from the channels, mostly through One-Data, and the market gets none until they start sending it. Before the profile is live, a request for it gets 422.

The readiness screen in the UI shows each environment's progress: requested, running, waiting for sign-off, active or failed. If a step fails, the screen says which one and why.

## Path 2: a new account type in a live market

Take US corporate, added while US consumer is already live. It is a profile of its own, so it follows path 1 from step 1 with its own behaviors, its own operations settings and its own release, starting at v1. US consumer doesn't change.

Three things are different:

- **Settings at market level apply to it.** The Market Onboarding UI can hold a Raven setting for the whole market. The new account type follows that setting unless it sets its own, and when it does, its own setting wins.
- **The manifest check is its own.** A combination includes the account type, so the corporate combinations must be in the manifest even when the consumer ones already are.
- **Its traffic starts on its own.** Once v1 is live in E3, channels start sending US corporate payments when they are ready. US consumer traffic carries on as before throughout.

## Path 3: a change to a live profile

Say the GB consumer profile is on v7, and its largest payment goes up.

1. **Edit the profile.** The change becomes a draft of **v8**. v7 is frozen and stays as it is.
2. **Check the manifest.** A change to a setting, such as a limit or a cancellation window, never needs a build. A change to a behavior can, and if it does, take [path 4](#path-4-a-change-that-needs-new-code) first.
3. **Get it approved** by a second person, which freezes v8.
4. **Release it through E1, E2 and E3,** as in path 1, steps 5 to 8, with the RFC in E3.
5. **Watch it take effect.** New payments use v8 the moment it is active. Payments already running keep v7, because the version is pinned in each payment's resolved profile. A scheduled payment is routed again on its due date, so it runs with whatever version is active that day.

There is no traffic step: the profile is already taking payments.

## Path 4: a change that needs new code

Say a market needs mandate authorization, and the build can't run that combination yet.

1. **The UI flags it.** While the profile is authored, the combination shows as needing a build.
2. **Engineers add what's missing,** such as `MandateCheck` and its rules, through the usual pull request and [CI checks](../deployment/ci-checks.md). The new build's manifest now includes the combination.
3. **The build ships through the pipeline** to E1, E2 and E3. Before each rollout, the pipeline checks that the new manifest still covers every release already live there.
4. **The release follows.** Continue with path 1, 2 or 3. A release that reaches an environment before its build simply stops at the onboarding workflow's first step, and carries on once the build is deployed there.

## Going back, and pausing

None of these needs a new release:

- **Rollback** points the profile back at its previous version, and puts that version's Schedules and settings back with it. Nothing is deleted, so it is as quick as going live.
- **Pause** stops the profile's dispatchers. Its due work waits in Oracle, and its config doesn't change.
- **Resume** starts the dispatchers again, and the waiting work flows in at the governor's pace.

On every path there are only two human checks: approval once, on the content, and sign-off in each environment after its test payments pass.
