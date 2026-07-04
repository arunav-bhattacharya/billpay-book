---
title: HTTPClient — OkHttpClient
sidebar_position: 1
---

# Choice of HTTPClient — OkHttpClient

Billpay-core uses **[OkHttpClient](https://square.github.io/okhttp/)** as its HTTP client for every outbound call — clearing networks, posting integrations, GPA, notification services, and the validation / lookup services we depend on.

## Why OkHttpClient

| Reason | Why it matters for Billpay |
| --- | --- |
| **Connection pooling out of the box** | Billpay-core fans out to a dozen downstream systems per payment. A pooled, keep-alive client is the difference between hundreds of connections and tens of thousands under load. |
| **HTTP/2 + ALPN support** | Several Amex internal services are HTTP/2. OkHttp negotiates this transparently — no special configuration to flip between versions. |
| **Strict, independent timeouts** | Every Temporal activity has a deadline. OkHttp lets us set **connect**, **read**, **write** and **call** timeouts independently — none of them inherit silently. A misconfigured downstream cannot hang an activity past its activity timeout. |
| **First-class interceptors** | Auth, tracing headers, correlation IDs, and per-call retry budgets are layered as interceptors. We never re-implement them per service. |
| **Predictable retry semantics** | OkHttp's retry behaviour is explicit and configurable. Combined with Temporal's activity-level retries, we get two clearly-separated retry layers (transport vs. business). |
| **Battle-tested at scale** | Used by Square, Pinterest, and effectively every JVM mobile app. The failure modes are well-understood; there are no surprises in production. |
| **Lightweight footprint** | ~1 MB JAR with no transitive Spring / Netty / Vert.x dependencies. Predictable startup time matters for Temporal workers we scale aggressively. |

## Why not the alternatives

- **`HttpURLConnection`** — JDK built-in, but no pooling, no interceptors, awkward timeouts, no HTTP/2 in older JDKs. Operationally we would re-implement OkHttp.
- **Apache HttpClient 5** — feature-complete but heavier configuration; the pooled client lifecycle is more error-prone and the default tuning is conservative for our latency budget.
- **Spring `WebClient` / `RestTemplate`** — pulls in the Spring reactive or web stack, neither of which Billpay-core needs. We deliberately stay framework-light at the worker layer.
- **`java.net.http.HttpClient` (Java 11+)** — modern API, but interceptor story is weaker and observability hooks are limited compared to OkHttp.

## How we configure it

A single, shared `OkHttpClient` instance per service category (clearing, posting, validation, notification). Per-call timeouts are tuned to **half** the corresponding Temporal activity timeout so that a hanging request is preferred to a timed-out activity — Temporal retries are deterministic, transport-level retries are not.

:::tip
If you're adding a new outbound integration, **reuse** the shared `OkHttpClient` for that category. Do not instantiate a new client per call — the connection pool is the whole point.
:::
