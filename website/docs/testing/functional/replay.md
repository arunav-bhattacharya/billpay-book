---
title: Replay Tests
description: 'Replay tests guard workflow determinism, making sure a code change cannot derail a workflow already in flight.'
---

import Lead from '@site/src/components/Lead';

# Replay Tests

<Lead>Replay tests guard workflow determinism, making sure a code change cannot derail a workflow already in flight.</Lead>

A replay test feeds a recorded workflow history back through the workflow code. If the code would now make a different decision at any step, the replay fails. These tests run in CI where possible. What determinism asks of workflow code in the first place is in [Build → Building Workflows](../../build/principles/core-build/workflows.md#why-workflow-code-must-be-deterministic).

Worker Versioning lowers the stakes without removing them. Payment workflows are pinned to the build they started on, so a deploy never changes the code under a running payment. A determinism bug inside one build still bites, though: when a worker restarts, another worker replays the payment's history on the same code, and code that reads the clock or iterates in an unstable order can take a different path the second time. Stage code runs inside the workflow, so it is held to the same rules and caught by the same tests.
