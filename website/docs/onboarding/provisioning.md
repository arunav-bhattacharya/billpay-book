---
title: Provisioning
description: 'Each environment takes market releases through one API, and one workflow per release checks it, tests it and switches it on.'
sidebar_label: Provisioning
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Provisioning

<Lead>Each environment takes market releases through one API, and one workflow per release checks it, tests it and switches it on. Nothing else writes a market's published config.</Lead>

## The provisioning API

Each environment's app exposes the provisioning API, and only billpay-ui's backend calls it, with its own service identity.

| Path | What it does |
| --- | --- |
| `/provisioning/releases` | Takes a frozen market release, reports its provisioning progress, records a sign-off and rolls a release back |
| `/provisioning/markets/{market}/{account-type}/pause` | Pauses a live market's dispatchers |
| `/provisioning/markets/{market}/{account-type}/resume` | Resumes them |
| `GET /provisioning/capabilities` | Returns the deployed build's capability manifest: every behavior combination the build can run |

Sending a release is idempotent: there is one provisioning workflow per market, account type, version and environment. While the environment's Offline cluster is down, the API answers 503 with `Retry-After`, and the backend sends again later.

## MarketProvisioningWorkflow

<WorkflowMeta cluster="Offline" id="provision-{market}-{accountType}-v{N}" start="The provisioning API, on control queue ctl-provision" />

One run takes one release through five steps in its environment.

1. Check vN against the deployed build's capability manifest. A behavior combination the build can't run stops the release here, marked as needing a build.
2. Save vN as an inactive version, together with the Schedules, dispatcher settings, rate rows and fairness settings it needs, all inactive too.
3. Test with payments against vN. The Router accepts a pinned config version for test accounts only, so test payments can use vN before anyone else can.
4. Wait for sign-off, and in E3 for the change request (RFC) as well.
5. Activate: switch `market_config_active` to vN and apply its Schedules and settings. Every running copy (pod) of billpay-core keeps the onboarding config in memory and reloads it now, so new payments use vN at once. A rollback reloads the same way.

If a step fails, the workflow stops before activation and the readiness screen shows which step failed. The fix is to correct the profile, which makes a new release, vN+1, or to ship the build it needs. Until that build is deployed, provisioning stops at its first step.

## The published config

Each environment keeps its published market config in its own billpay-core database, in two tables:

| Table | What it holds |
| --- | --- |
| `market_config_version` | Every published version of every profile. A version never changes once it is saved |
| `market_config_active` | The active version for each market and account type |

The Router reads both, and only `MarketProvisioningWorkflow` writes them. Because versions are immutable and activation is a pointer, rolling back is the same operation as going live: the pointer, and the Schedules and settings, move back to the previous version.

## How payments pick up a version

- A new payment uses the active version from the moment it is activated. The Router resolves the market's behaviors from it and pins the version in the payment's plan key.
- A running workflow keeps the version in its plan key until it finishes, so a release never changes config under a payment in flight.
- A scheduled payment is routed again on its due date, so it executes with that day's active version. The version it was scheduled under stays in its timeline for audit.
