---
title: Market Onboarding API
description: 'Each environment takes market releases through one API, and one workflow per release checks it, tests it and switches it on.'
sidebar_label: Market Onboarding API
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Market Onboarding API

<Lead>Each environment takes market releases through one API, and one workflow per release checks it, tests it and switches it on. Nothing else writes a market's published config.</Lead>

## The API

Each environment's billpay-offline exposes the Market Onboarding API, because the onboarding workflow runs on the Offline cluster, and only the Market Onboarding UI's backend calls it, with its own service identity.

| Path | What it does |
| --- | --- |
| `/market-onboarding/releases` | Takes a frozen market release, reports its onboarding progress, records a sign-off and rolls a release back |
| `/market-onboarding/markets/{market}/{account-type}/pause` | Pauses a live market's dispatchers |
| `/market-onboarding/markets/{market}/{account-type}/resume` | Resumes them |
| `GET /market-onboarding/capabilities` | Returns the deployed build's capability manifest: every behavior combination the build can run |

Sending a release is idempotent: there is one onboarding workflow per market, account type, version and environment. While the environment's Offline cluster is down, the API answers 503 with `Retry-After`, and the backend sends again later.

## MarketOnboardingWorkflow

<WorkflowMeta cluster="Offline" id="onboard-{market}-{accountType}-v{N}" start="The Market Onboarding API, on control queue ctl-onboard" />

One run takes one release through five steps in its environment.

1. Check vN against the deployed build's capability manifest. A behavior combination the build can't run stops the release here, marked as needing a build. So does a profile whose cancellation window doesn't close before its execution time.
2. Save vN as an inactive version, together with the Schedules, dispatcher settings, rate rows and fairness settings it needs, all inactive too.
3. Test with payments from mock accounts set up for vN, so test payments can use vN before anyone else can (agreed 2026-11-07). Proposed: vN's JSON lists them, `testAccounts` by account token, and the Router pins vN for any payment from one of them, for its updates, cancels and due-date execution too (agreed 2026-11-08). A version set up this way exists before it is active, and adding it doesn't change `market_config_active`, so each pod's 15-second read takes `market_config_version`'s keys as well (Proposed, 2026-11-07).
4. Wait for sign-off, and in E3 for the change request (RFC) as well.
5. Activate: switch `market_config_active` to vN and apply its Schedules and settings. Every running copy (pod) of both apps, billpay-online and billpay-offline, keeps the onboarding config in memory and reloads it now, so new payments use vN at once. The workflow runs on the Offline cluster, so billpay-online learns of the change through Oracle (Proposed: each pod reads `market_config_active` every 15 seconds). A rollback reloads the same way.

If a step fails, the workflow stops before activation and the readiness screen shows which step failed. The fix is to correct the profile, which makes a new release, vN+1, or to ship the build it needs. Until that build is deployed, the workflow stops at its first step.

## The published config

Each environment keeps its published market config in its own Billpay schema, `BPYSCH`, in two tables:

| Table | What it holds |
| --- | --- |
| `market_config_version` | Every published version of every profile, its release JSON in `CONFIG_DA`. A version never changes once it is saved |
| `market_config_active` | The active version for each market and account type, and `IN_SERVICE_IN`: N once the market is taken out of service, so the active version stays readable (Proposed) |

The Router reads both, and only `MarketOnboardingWorkflow` writes them.

The release JSON the Router reads holds billpay-ui's `apis` and behavior keys (`requiresArPosting`, `requiresRealtimeClearing`, `requiresMandateAuthorization`), plus `requiresBankConfirmation`, `bankConfirmation` (`provider`, `confirmationWindow`), `cardAuthentication` (`provider`, `authenticationWindow`), `payWithMrPoints`, `ruleSettings` and `testAccounts`, the mock accounts that test the version. A behavior set to BOTH lists the journeys that get Y as `yesForJourneys`. These keys are Proposed (2026-11-07). The release also sets `timeZone`, `executionTime` (local midnight when unset), `cancellationWindow` (`PT1H` when unset) and the `representment` block, `{representableReasons, maxRepresentments, delayDays}` (agreed 2026-11-07). A corporate release also sets `allocationFetchBefore` and `allocationAlertAfter`, both ISO durations, and any release can set `ravenStatuses`, the statuses that send a Raven message for that market and account type (agreed 2026-11-08). Because versions are immutable and activation is a pointer, rolling back is the same operation as going live: the pointer, and the Schedules and settings, move back to the previous version.

## How payments pick up a version

- A new payment uses the active version from the moment it is activated. The Router resolves the market's behaviors from it and pins the version in the payment's resolved profile.
- A running workflow keeps the version in its resolved profile until it finishes, so a release never changes config under a payment in flight.
- A scheduled payment is routed again on its due date, so it executes with that day's active version. The version it was scheduled under stays in its timeline for audit.
