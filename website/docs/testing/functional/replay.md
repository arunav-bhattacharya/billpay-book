---
title: Replay Tests
---

import Lead from '@site/src/components/Lead';

# Replay Tests

<Lead>Replay tests guard **workflow determinism**, making sure a code change cannot derail a workflow already in flight.</Lead>

A replay test feeds a previously recorded workflow history back through the current workflow code; a change that would break an in-flight execution makes the replay fail. These tests run as part of CI where possible. What determinism demands of workflow code in the first place is in [Build → Building Workflows](../../build/principles/core-build/workflows.md#why-workflow-code-must-be-deterministic).
