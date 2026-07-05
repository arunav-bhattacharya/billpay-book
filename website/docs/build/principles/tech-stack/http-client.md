---
title: 'HTTP Client: OkHttp'
sidebar_label: HTTP Client
---

import Lead from '@site/src/components/Lead';

# HTTP Client: OkHttpClient

<Lead>Every outbound HTTP call — clearing, Accounts Receivable, Open-To-Buy, validation lookups, notifications — goes through OkHttp. A payment fans out to a dozen downstream systems, so the HTTP client is not a detail; it's the thing standing between one slow dependency and a worker full of hung activities.</Lead>

## Why OkHttp

| Reason | Why it matters for Billpay |
| --- | --- |
| **Connection pooling out of the box** | billpay-core fans out to many downstreams per payment. A pooled, keep-alive client is the difference between tens and tens of thousands of connections under load. |
| **HTTP/2 with transparent negotiation** | Several Amex internal services are HTTP/2. OkHttp negotiates it via ALPN without per-service configuration. |
| **Four independent timeouts** | Connect, read, write, and full-call timeouts are set separately, and none inherits silently. Every activity has a Temporal deadline; a misconfigured downstream must not be able to hang an activity past it. |
| **First-class interceptors** | Auth, tracing headers, correlation IDs — layered once as interceptors, never re-implemented per service. |
| **Predictable retry semantics** | OkHttp's transport-level retry is explicit and configurable. Combined with Temporal's activity retry, we get two cleanly separated retry layers: transport and business. |
| **Battle-tested at scale** | The failure modes are known quantities. Payments is not where you discover a client library's surprises. |
| **Lightweight footprint** | Roughly a 1 MB JAR with no transitive Spring, Netty, or Vert.x — startup time matters for workers we scale aggressively. |

## What we turned down

- **`HttpURLConnection`** — no pooling, no interceptors, awkward timeout control.
- **Apache HttpClient 5** — capable, but heavier configuration and an error-prone pooled-lifecycle model.
- **Spring `WebClient` / `RestTemplate`** — drags the Spring web (or reactive) stack into workers we deliberately keep framework-light.
- **`java.net.http.HttpClient`** — fine for scripts; weak interceptor story and limited observability hooks for a platform.

## How we use it

One shared `OkHttpClient` per service *category* — clearing, posting, validation, notification — each owned by the [clients](../core-build/clients.md) for that category. Never instantiate a client per call; you'd silently discard the connection pool.

The tuning rule worth memorising: **per-call timeouts are set to about half the corresponding Temporal activity timeout.** If the request hangs, we want the HTTP layer to give up first and hand the failure to Temporal — whose retries are deterministic and observable — rather than let the activity itself time out. Transport retries are a convenience; Temporal retries are the contract.
