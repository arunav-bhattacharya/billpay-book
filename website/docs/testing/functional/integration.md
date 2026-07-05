---
title: Integration Tests
---

import Lead from '@site/src/components/Lead';

# Integration Tests

<Lead>Integration tests run against **real dependencies in TestContainers**, falling back to mocks for the integrations not yet containerised.</Lead>

One layer up from [unit tests](./unit.md), these tests verify the platform against its dependencies rather than in isolation. Where a dependency can run in a container, the test exercises the real thing; where it can't yet, a mock stands in until it can.
