---
title: CI Checks
description: 'Every pull request to billpay-core runs the same required checks on GitHub Actions, and none of them can be skipped to get a change in.'
---

import Lead from '@site/src/components/Lead';

# CI Checks

<Lead>Every pull request to billpay-core runs the same required checks on GitHub Actions, and none of them can be skipped to get a change in. They are aimed at the mistakes that hurt most in this design: workflow code that decides differently on replay, a write that isn't safe to repeat, and a change to what a market runs that nobody noticed.</Lead>

The checks are Proposed (2026-10-20), for the team to confirm. Where they sit in the branch model is on [Code Merge Strategy](./code-merge-strategy.md).

## When they run

- On every pull request, to `develop`, to a `release/*` branch or to `main`. A pull request can't merge until every required check has passed on its latest commit.
- On every merge to `develop`. The run ends by publishing an image, but nothing deploys from `develop`.
- On a `release/*` or `hotfix/*` branch. The image built here is the one the [pipeline](./pipeline.md) takes through E1, E2 and E3.

## The required checks

| Check | What it runs | What it catches |
| --- | --- | --- |
| Build | The Gradle build of the monorepo | A breach of the layer rules, such as stage code reaching an activity's implementation. The module graph makes it a compile error ([Code Layout](../build/core-build/code-layout.md#the-dependency-rule-the-build-enforces)) |
| Lint | ktlint and detekt | Formatting drift and the code smells detekt is set to fail on |
| Unit tests | Stages, checks, methods, verification rules, workflows and activities ([Unit Tests](../testing/functional/unit.md)) | A stage that commits the wrong state, a rule without a decline code, an activity that retries a business error |
| Registry tests | The stage, check and rule registries, built from the classes in the build | Two classes tied for one job, a combination in the manifest with no stage, a class missing its module's `META-INF/beans.xml`, a market class without its market's code in front |
| Stage report | Writes, for each step, market and combination, the stage and strategies it gets, and compares that with the checked-in report | A change to what a combination runs that the pull request didn't show |
| Integration tests | `PaymentStore` and the other tests against Oracle in TestContainers ([Integration Tests](../testing/functional/integration.md)) | A guarded update that changes a row the second time, or an insert that adds a duplicate |
| Replay tests | Recorded workflow histories, one or more per journey, fed back through the new code ([Replay Tests](../testing/functional/replay.md)) | Workflow or stage code that would take a different path when a worker restarts and replays a payment |
| Security scans | The organization's dependency, static-analysis and secret scanners | A vulnerable library, an unsafe pattern, a credential committed by mistake |

## What the reviewer reads

Most checks answer yes or no. The stage report is different: it is a file, and a pull request that changes what any combination runs must change the checked-in copy too, or the check fails. So the reviewer sees every moved row as a diff.

Adding `MandateCheck`, for example, shows up as new rows for every combination with mandate authorization, and as no change anywhere else. A diff that touches markets the pull request wasn't meant to touch is the thing to stop on.

## The replay histories

The replay tests are only as good as the histories they replay. One or more per journey are checked in, and each release adds histories recorded in E2 for the journeys it changed.

Worker Versioning pins a payment to the build it started on, so a new build never replays an old build's payments. The replay tests guard something else: a worker that restarts mid-payment, and another worker of the same build that replays the history. Code that reads the clock or iterates in an unstable order takes a different path the second time, and these tests find it before production does.

## When a check fails

1. See which check failed with `gh pr checks <number>`.
2. Read the failure with `gh run view <run-id> --log-failed`.
3. Reproduce it locally with the same Gradle task, fix the code, and push. The checks run again on the new commit.
4. Rerun only when the log shows a failure outside the code, such as a runner that couldn't start a container: `gh run rerun <run-id> --failed`.

A test that fails now and then is fixed or removed within the sprint. Rerunning until it passes teaches everyone to ignore red.

## What CI doesn't check

Two gates sit outside CI, because they need an environment:

- Whether a build can run every market release live in an environment. The pipeline compares the build's capability manifest with those releases before it rolls out, and stops on a gap ([Pipeline](./pipeline.md#the-capability-manifest)).
- Whether the platform works against the real integrations. That is the job of [end-to-end tests](../testing/functional/e2e.md) in each environment.
