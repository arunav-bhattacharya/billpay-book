---
title: End-to-End Tests
description: 'End-to-end tests, manual or automated, exercise the platform against its actual API integrations.'
sidebar_label: E2E Tests
---

import Lead from '@site/src/components/Lead';

# End-to-End Tests

<Lead>End-to-end tests, manual or automated, exercise the platform against its actual API integrations.</Lead>

This is the outermost layer of [functional testing](./index.md). No containers or mocks stand in here: whether scripted or run by hand, an end-to-end test goes against the real integrations.

A market release gets an end-to-end check of its own in every environment. Before anyone signs a new version off, test payments run against it: the Router accepts a pinned config version for test accounts only, so the new version can be tried while every other payment keeps the active one. [Releases](../../onboarding/releases.md) covers the sign-off that follows.
