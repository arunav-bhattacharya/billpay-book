---
title: Modules in the Monorepo
sidebar_label: Modules in the Monorepo
---

import Lead from '@site/src/components/Lead';

# Modules in the Monorepo

<Lead>The code is laid out along the component model. A shared **core** library holds the default implementations; each onboarded **market** holds only its overrides.</Lead>

## Layout

| Component | Default (shared) | Market override |
| --- | --- | --- |
| **Workflow** | `core/lib/workflows/impl/` | `market/{market}/workflows/` |
| **Stage** | `core/lib/stages/impl/` | `market/{market}/stages/` |
| **ActivityGroup** | `core/lib/activityGroups/` | `market/{market}/activityGroups/` |
| **Activity** | `core/lib/activities/` + `impl/` | — |
| **Client** | `core/lib/clients/` | — |

## How it composes

There is one workflow per journey, in `core/lib`. A market never forks the workflow; it contributes only the Stage and ActivityGroup implementations that differ for its dimensions, under `market/{market}/`. At runtime the market's profile selects which implementation each workflow composes — so shared behaviour is written once in `core`, and market-specific behaviour stays isolated in that market's package.

Naming follows the component: `{Market}InitiatePaymentWorkflow`, `{From}To{To}Stage`, `{Responsibility}ActivityGroup`, `{Action}Activity`, `{System}Client`. See the [component model](../../design/principles.md) for the call rules these packages enforce.
