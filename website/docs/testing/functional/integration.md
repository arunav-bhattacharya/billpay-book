---
title: Integration Tests
description: 'Integration tests run against real dependencies in TestContainers, falling back to mocks for the integrations not yet containerised.'
---

import Lead from '@site/src/components/Lead';

# Integration Tests

<Lead>Integration tests run against real dependencies in TestContainers, falling back to mocks for the integrations not yet containerised.</Lead>

One layer up from [unit tests](./unit.md), these tests check the platform against its dependencies rather than in isolation. Where a dependency can run in a container, the test exercises the real thing. Where it can't yet, a mock stands in until it can.

`PaymentStore`, the only code that reaches Oracle, is the clearest case. Its writes are insert-if-absent or a guarded update on the current state, and that only means something against a real database: a second commit from the same state must change no row, and a repeated insert must add none. Those two properties are what make a retried activity harmless, so they are worth proving where they actually happen.
