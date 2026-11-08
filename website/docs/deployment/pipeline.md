---
title: Pipeline
description: 'The pipeline takes a release or hotfix branch to production as one build of billpay-core.'
---

import Lead from '@site/src/components/Lead';

# Deployment Pipeline

<Lead>The pipeline takes a release or hotfix branch to production as one build of billpay-core. One run builds both apps, billpay-online and billpay-offline, from the same commit, and a new build never changes the code under a payment that is already running.</Lead>

What the pipeline ships is catalogued under [Deployables](./deployables/index.md), and the gates a change clears before it merges are on [CI Checks](./ci-checks.md), and the branches it travels on are on [Code Merge Strategy](./code-merge-strategy.md). The stage-by-stage description of the pipeline itself is still to come.

## One build, two apps

billpay-core has two app modules, `apps/online` and `apps/offline`, and each builds its own Quarkus artifact: billpay-online, which connects to the Online cluster, and billpay-offline, which connects to the Offline cluster. One pipeline run builds both from the same commit, so the two never drift apart. More capacity means more pods of the app that needs it.

## Running payments during a deploy

Deploys are rolling: the new build's pods replace the old ones a few at a time. When a new build goes out:

- New payments start on the new build.
- Payments already running carry on in the new build, replaying their history first.
- A change that would make a running payment take a different step is patched with `Workflow.getVersion`, so a payment past that point keeps its old path. The replay tests in CI prove the old histories still replay.

No payment workflow sleeps until a due date, because dated work waits in Oracle as a Work Tracker row, so most running payments are seconds or minutes old when a deploy lands. Worker Versioning, which would pin each payment to the build it started on, is parked for later (2026-11-08): it needs the old and new builds running side by side.

## The capability manifest

Every build ships a manifest of the behavior combinations it can run, worked out when the app starts by the same lookup that picks stages at runtime. `GET /market-onboarding/capabilities` returns it, and the onboarding workflow checks every market release against it.

This is where the pipeline and market onboarding meet. A release built only from combinations in the manifest goes live with config alone. A release that needs a new combination is flagged as needing a build while it is authored, and the onboarding workflow stops at its first step until a build with that combination is deployed.

The check runs the other way too. Before a build rolls out to an environment, the pipeline compares its manifest with every release live there, and stops the rollout if a combination a live release uses is missing. A build that dropped a class a live market needs never rolls out there.

## Three environments

A build moves through E1, E2 and E3, and E3 is production. Each environment has its own billpay-online and billpay-offline, its own Online and Offline clusters and its own Oracle schema.

How a build is set up per environment:

- One build runs in every environment. What differs is config or a secret, read when the app starts. Nothing environment-specific goes into the image.
- Both Temporal namespaces keep their names everywhere, `billpay-online` and `billpay-offline`, the names of the apps that serve them, so moving between environments changes only the cluster endpoints.
- Config per environment and app: its cluster's Temporal endpoint, its Oracle pool's connection, One-Data's base URL, each downstream's base URL, the Prometheus address and the OpenTelemetry collector's address.
- Secrets come from the organization's secret store, under one path per environment: each app's Oracle pool login, the client certificate for each app's Temporal cluster, the credentials One-Data and each downstream take (held the way the current app holds them), and the Prometheus login the governor reads with. No secret sits in a config file.
