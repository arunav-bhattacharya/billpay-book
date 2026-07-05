---
title: Unit Tests
---

import Lead from '@site/src/components/Lead';

# Unit Tests

<Lead>Workflows and activities are unit-tested with **Temporal's testing primitives**, so each can be verified on its own before anything is wired together.</Lead>

This is the innermost layer of [functional testing](./index.md): unit-level test patterns for workflow logic and for the activities workflows call, built on the test support that ships with the Temporal SDK. Everything outside the unit under test stays out of the picture — real dependencies first appear in [integration tests](./integration.md).
