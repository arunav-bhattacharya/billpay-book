---
title: Schedules
description: 'The periodic workflows do not run on cron jobs bolted to a host.'
sidebar_label: Schedules
---

import Lead from '@site/src/components/Lead';

# Schedules

<Lead>The periodic workflows do not run on cron jobs bolted to a host. They run on <strong>Temporal Schedules</strong>, registered with the cluster and durable like everything else. If the worker fleet restarts, the schedules carry on.</Lead>

Every schedule fires on the **Offline worker**, because nothing here has a user waiting. Which schedule starts which workflow, and what each one does, is in [Design → Periodic Workflows](../design/component-model/workflows/periodic.md).

## How batching works

Executors work in waves rather than draining everything at once. They pick up **2,500 items, spread over the next minute, then the next 2,500 a minute later**. The cadence is deliberate. It turns a morning spike of due payments into a flat, predictable load on the Offline worker and every downstream system behind it, and it means a stuck batch delays the next wave rather than swallowing the whole backlog.

## Build-time wiring

Schedules are configuration, registered with the Temporal cluster when the Offline worker deploys. That makes changing a cadence a code-reviewed, versioned change like any other, not a box someone edits in a console. Where each schedule fires in the life of a payment is in [Design → Journeys](../design/journeys/index.md).
