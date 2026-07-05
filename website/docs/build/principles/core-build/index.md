---
title: Core Build
sidebar_label: Core Build
---

import Lead from '@site/src/components/Lead';

# Core Build

<Lead>Tool Selection covers what we buy. This covers what we write — how the component model from Design becomes code, one layer at a time, and the rules that keep each layer doing only its own job.</Lead>

The call chain is strict — **Workflow → Stage → ActivityGroup → Activity → Client → external system**, exactly as the [component model](../../../design/principles.md) defines it — and each page below is a how-to for one link in it:

- **[Code layout](./code-layout.md)** — the Gradle monorepo, where each component lives, and the dependency rule the build enforces.
- **[Workflows](./workflows.md)** — deterministic orchestration: one workflow per journey, composed from stages, with the spec's worked example.
- **[Stages](./stages.md)** — one state transition each, typed by the domain model.
- **[Activities & ActivityGroups](./activities.md)** — the I/O units and the groups that compose them.
- **[Clients](./clients.md)** — the adapters that actually talk to external systems.

If you're new, read them in that order once — top of the chain to the bottom — and the rest of the section will read like detail instead of doctrine.
