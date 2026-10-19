---
title: Pipeline
description: 'The pipeline takes a merged commit to production as one build of billpay-core.'
---

import Lead from '@site/src/components/Lead';

# Deployment Pipeline

<Lead>The pipeline takes a merged commit to production as one build of billpay-core. The app deploys as one, and a new build never changes the code under a payment that is already running.</Lead>

What the pipeline ships is catalogued under [Deployables](./deployables/index.md), and the gates a change clears before it merges are on [CI Checks](./ci-checks.md). The stage-by-stage description of the pipeline itself is still to come.

## One app, one deploy

billpay-core runs the APIs and the workers for both Temporal clusters, and it ships as one app. There is no online build and offline build to keep in step. When the platform needs more capacity, it gets more pods of the same app, not a new deployable.

## Old builds keep running for a while

Payment workflows are pinned to the build they started on, through Temporal's Worker Versioning. When a new build goes out:

- New payments start on the new build.
- Payments already running finish on the build they started on, so the old build's workers keep running until its pinned workflows are done.
- The dispatchers and the governor move to the new build the next time they continue-as-new.

That is why a deploy can't change the rules under a payment halfway through it. No payment workflow sleeps until a due date, because dated work waits in Oracle as a Work Tracker row, so pinned workflows don't hold an old build for days.

## The capability manifest

Every build ships a manifest of the behavior combinations it can run, worked out when the app starts by the same lookup that picks stages at runtime. `GET /provisioning/capabilities` returns it, and provisioning checks every market release against it.

This is where the pipeline and market onboarding meet. A release built only from combinations in the manifest goes live with config alone. A release that needs a new combination is flagged as needing a build while it is authored, and provisioning stops at its first step until a build with that combination is deployed.

## Three environments

A build moves through E1, E2 and E3, and E3 is production. Each environment has its own billpay-core, its own Online and Offline clusters and its own Oracle schema.

How a build is set up per environment is Proposed (2026-10-18):

- One build runs in every environment. What differs is config or a secret, read when the app starts. Nothing environment-specific goes into the image.
- Both Temporal namespaces keep their names everywhere, `billpay-online` and `billpay-offline`, so moving between environments changes only the cluster endpoints.
- Config per environment: the two Temporal endpoints, the Oracle connection for each pool, One-Data's base URL, each downstream's base URL, the Prometheus address and the OpenTelemetry collector's address.
- Secrets come from the organization's secret store, under one path per environment: the two Oracle pools' logins, the client certificate for each Temporal cluster, the credentials One-Data and each downstream take (held the way the current app holds them), and the Prometheus login the governor reads with. No secret sits in a config file.
