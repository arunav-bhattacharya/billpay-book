---
title: billpay-core
description: 'billpay-core is the one app behind Billpay: one deployable, one JVM, running the work for both Temporal clusters.'
---

import Lead from '@site/src/components/Lead';

# billpay-core

<Lead>billpay-core is the one app behind Billpay: one deployable, one JVM, running the work for both Temporal clusters. It hosts the core APIs, the Billpay Router, the dispatchers, the governor and the workers for the Online and Offline clusters, with a Temporal client for each.</Lead>

The two [Temporal clusters](../../design/component-model/workflows/index.md#two-clusters) are separate, but the app isn't. Online and offline work share it safely because offline work reaches it at the governor's pace and is fenced in two ways: it has its own Oracle [connection pool](../../build/principles/tech-stack/datasource.md), and a cap on how many offline tasks run at once, so it can never take a whole pod. The governor also cuts offline rates as soon as online response times climb.

There is no separate online or offline app. billpay-core ships and deploys as one app, and when it needs more capacity it gets more pods of the same app. Load-test runs 4 and 6 prove that online response times hold while offline work runs at full rate.

Deployment detail for the app is still to come. Where it runs, how it reaches Temporal, and what happens when a site or a region fails, is on the [High Availability](../../architecture/high-availability.md) page.
