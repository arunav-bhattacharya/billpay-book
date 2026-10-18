---
title: Building Clients
description: 'A client is the adapter to exactly one external system: SystemClient, in core/lib/clients/.'
sidebar_label: Clients
---

import Lead from '@site/src/components/Lead';

# Building Clients

<Lead>A client is the adapter to exactly one external system: <code>&#123;System&#125;Client</code>, in <code>core/lib/clients/</code>. It owns that system's protocol, contract and quirks, and translates between Billpay's payment language and whatever the other side speaks. Everything above a client stays protocol-free.</Lead>

## What a client does

When an activity needs clearing, it calls `ClearingClient.clear(…)` with domain-shaped arguments and gets a domain-shaped answer. The client is where that becomes an HTTP call: the URL, the headers, the request body the clearing system expects, and the mapping of its status codes back into something the activity can act on.

```kotlin
class ClearingClient(
    private val http: OkHttpClient,                 // the shared clearing-category client
) {
    fun clear(p: ClearingInput, idempotencyKey: String): ClearingResult {
        val request = Request.Builder()
            .url("$clearingBaseUrl/clear")
            .header(IDEMPOTENCY_HEADER, idempotencyKey)  // the header name is the system's
            .post(/* the clearing system's request shape */)
            .build()
        http.newCall(request).execute().use { response ->
            return response.toClearingResult()      // their contract, our language
        }
    }
}
```

*(Shape, simplified.)* The rules:

- Each external system gets one `{System}Client`: clearing, Accounts Receivable, open-to-buy, Raven, the allocations manager and the rest. When a system changes its contract, one file changes.
- A client calls its own system and nothing else. It never calls another client, and never a workflow, a stage or an activity: it is the bottom of the chain on purpose. When two systems' answers have to be combined, a stage does it, through two activities.
- The constructor takes the shared OkHttp client for its category, and nothing builds one per call. Which categories exist, how their timeouts are set and what the interceptors already do are on the [HTTP client](../tech-stack/http-client.md) page. Its own retries are off: Temporal retries the activity instead.
- External enums, codes and field names stop at the client. If a clearing status code shows up in a stage, the client didn't finish its job.
