---
title: Serialization
sidebar_label: Serialization
---

import Lead from '@site/src/components/Lead';

# Serialization

<Lead>A payment crosses process boundaries constantly — REST requests in, Temporal workflow payloads between workers, lifecycle events out. Our domain model is a family of sealed hierarchies, so serialization has one non-negotiable job: a <code>PaidFullPayment</code> written on one side must come back as a <code>PaidFullPayment</code> on the other, never as a vague base type.</Lead>

## Jackson, with type discriminators

Today that job is done by **Jackson**. Every sealed hierarchy in the [domain model](../../data-model/index.md) carries the same annotation:

```kotlin
@JsonTypeInfo(
    use = JsonTypeInfo.Id.SIMPLE_NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = Payment.PROPERTY_NAME,   // "type"
)
sealed interface Payment : Transaction { … }
```

Serialized, every payment, option, instrument, and timeline carries a `"type"` property holding the concrete class's simple name — `"AcceptedFullPayment"`, `"VerifiedMinimumDuePaymentOption"`, `"ScheduledTimeline"`. On the way back in, Jackson uses that discriminator to reconstruct the exact subtype. This is what lets workflow code receive a `Payment` and safely `when` over the sealed hierarchy: the concrete type survived the wire.

Two conventions to keep:

- **Every new sealed hierarchy gets the same `@JsonTypeInfo` block** with a `PROPERTY_NAME = "type"` companion constant. Don't invent a second discriminator name.
- **Formatting quirks are annotated at the field**, e.g. the debit card expiry: `@field:JsonFormat(shape = STRING, pattern = "MM/yyyy") val expiryDate: YearMonth?`.

## Where we're heading

The reflection-based approach has a known ceiling — it's the main obstacle between us and GraalVM native-image workers, and polymorphic config is manual work Jackson can't check at compile time. Under evaluation, clearly **not adopted yet**:

- **kotlinx.serialization** — compile-time generated codecs for the sealed hierarchies, no reflection, native-image friendly, and the sealed-subtype registry comes from the compiler instead of annotations.
- **KSP** (Kotlin Symbol Processing) — build-time code generation and validation, so conventions become compile errors instead of review comments.
- **Konsist** — architecture tests in Kotlin: naming rules, module placement, "no Exposed in workflow code" — asserted in CI.
- **Arrow `Either`** — structured validation errors (`rule`, `code`, `message`) for the validation path only; everywhere else plain exceptions and Temporal retries remain the model.

Until any of that lands, Jackson is the contract. If you're adding a type that crosses a boundary, follow the `@JsonTypeInfo` pattern above and move on.
