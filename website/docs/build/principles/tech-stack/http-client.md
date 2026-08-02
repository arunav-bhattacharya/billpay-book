---
title: 'HTTP Client: OkHttpClient'
description: 'Every outbound HTTP call goes through OkHttp: clearing, Accounts Receivable, Open-To-Buy, validation lookups, notifications.'
sidebar_label: HTTP Client
---

import Lead from '@site/src/components/Lead';

# HTTP Client: OkHttpClient

<Lead>Every outbound HTTP call goes through OkHttp: clearing, Accounts Receivable, Open-To-Buy, validation lookups, notifications. A payment fans out to a dozen downstream systems, so the HTTP client is what keeps one slow dependency from filling a worker with hung activities.</Lead>

## Why OkHttp

| Reason | Why it matters for Billpay |
| --- | --- |
| **Connection pooling out of the box** | billpay-core fans out to many downstreams per payment. A pooled, keep-alive client is the difference between tens and tens of thousands of connections under load. |
| **HTTP/2 with transparent negotiation** | Several Amex internal services are HTTP/2. OkHttp negotiates it via ALPN without per-service configuration. |
| **Four independent timeouts** | Connect, read, write, and full-call timeouts are set separately, and none inherits silently. Every activity has a Temporal deadline; a misconfigured downstream must not be able to hang an activity past it. |
| **First-class interceptors** | Auth, tracing headers, and correlation IDs are layered once as interceptors, never re-implemented per service. |
| **Predictable retry semantics** | OkHttp's transport-level retry is explicit and configurable. Combined with Temporal's activity retry, we get two cleanly separated retry layers: transport and business. |
| **Well proven at scale** | The failure modes are known quantities. Payments is not where you want to discover a client library's surprises. |
| **Lightweight footprint** | Roughly a 1 MB JAR with no transitive Spring, Netty, or Vert.x. Startup time matters for workers we scale aggressively. |

## What we turned down

- **`HttpURLConnection`** has no pooling, no interceptors, and awkward timeout control.
- **Apache HttpClient 5** is capable, but the configuration is heavier and the pooled-lifecycle model is error prone.
- **Spring `WebClient` and `RestTemplate`** drag the Spring web or reactive stack into workers we deliberately keep framework-light.
- **`java.net.http.HttpClient`** is fine for scripts, but the interceptor story is weak and the observability hooks are limited for a platform.

## How we use it

There is one shared `OkHttpClient` per service *category*: clearing, posting, validation, notification. Each is owned by the [clients](../core-build/clients.md) for that category. Never instantiate a client per call, or you silently discard the connection pool.

The tuning rule that matters: **per-call timeouts are set to about half the corresponding Temporal activity timeout.** If the request hangs, we want the HTTP layer to give up first and hand the failure to Temporal, whose retries are deterministic and observable, rather than let the activity itself time out. Transport retries are a convenience, and Temporal's retries are the ones we rely on.
