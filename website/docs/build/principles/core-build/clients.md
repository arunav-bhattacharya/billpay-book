---
title: Building Clients
sidebar_label: Clients
---

import Lead from '@site/src/components/Lead';

# Building Clients

<Lead>A client is the adapter to exactly one external system — <code>&#123;System&#125;Client</code>, in <code>core/lib/clients/</code>. It owns that system's protocol, contract, and quirks, and translates between Billpay's payment language and whatever the other side speaks. Everything above a client stays protocol-free.</Lead>

## The job

When an activity needs clearing, it calls `ClearingClient.clear(…)` with domain-shaped arguments and gets a domain-shaped answer. The client is where that becomes an HTTP call: the URL, the headers, the request body the clearing system expects, the mapping of its status codes back into something the activity can act on.

```kotlin
class ClearingClient(
    private val http: OkHttpClient,   // the shared clearing-category client
) {
    fun clear(paymentId: String, amount: MonetaryAmount): ClearingResult {
        val request = Request.Builder()
            .url("$clearingBaseUrl/clear")
            .post(/* the clearing system's request shape */)
            .build()
        http.newCall(request).execute().use { response ->
            return response.toClearingResult()   // their contract -> our language
        }
    }
}
```

*(Shape, simplified.)* The rules:

- **One client per system.** Clearing, Accounts Receivable, Authorizations, the allocations manager, Raven — each gets its own `{System}Client`. When a downstream changes its contract, the blast radius is one file.
- **Clients may call other clients and external systems — nothing above them.** A client never touches a workflow, stage, activity group, or activity. It's the bottom of the chain on purpose.
- **Use the shared OkHttp client for your category.** The [HTTP client](../tech-stack/http-client.md) page explains the categories (clearing, posting, validation, notification) — take the shared instance in your constructor; never build a client per call, or you throw away the connection pool.
- **Respect the activity's deadline.** Per-call timeouts sit at about half the Temporal activity timeout above you, so a hung downstream surfaces as a clean, retryable failure instead of a timed-out activity.
- **Translate at the boundary.** External enums, codes, and field names stop at the client. If a clearing status code leaks into a stage, the client didn't finish its job.

Auth, tracing headers, and correlation IDs arrive via the shared client's interceptors — you get them for free; don't re-implement them per system.
