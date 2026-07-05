---
title: Replay Tests
---

import Lead from '@site/src/components/Lead';

# Replay Tests

<Lead>Replay tests guard **workflow determinism** — making sure code changes can't derail workflows already in flight.</Lead>

A replay test feeds a previously recorded workflow history back through the current workflow code; a change that would break an in-flight execution makes the replay fail. These tests run as part of CI where possible.
