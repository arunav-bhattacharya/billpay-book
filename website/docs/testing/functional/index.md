---
title: Functional Testing
---

import Lead from '@site/src/components/Lead';

# Functional Testing

<Lead>Four layers of functional tests, from the innermost out: **unit**, **integration**, **replay**, and **end-to-end**.</Lead>

- **[Unit](./unit.md)** — workflow and activity tests built on Temporal's testing primitives.
- **[Integration](./integration.md)** — TestContainers where a dependency can run for real, mocks where it can't yet.
- **[Replay](./replay.md)** — Temporal replay tests that guard workflow determinism.
- **[E2E](./e2e.md)** — manual or automated runs against actual API integrations.
