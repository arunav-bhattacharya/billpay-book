---
title: Functional Testing
---

import Lead from '@site/src/components/Lead';

# Functional Testing

<Lead>Four layers of functional tests, from the innermost out: **unit**, **integration**, **replay**, and **end-to-end**.</Lead>

- [Unit](./unit.md) covers workflow and activity tests built on Temporal's testing primitives.
- [Integration](./integration.md) uses TestContainers where a dependency can run for real, and mocks where it cannot yet.
- [Replay](./replay.md) covers the Temporal replay tests that guard workflow determinism.
- [E2E](./e2e.md) covers manual or automated runs against actual API integrations.
