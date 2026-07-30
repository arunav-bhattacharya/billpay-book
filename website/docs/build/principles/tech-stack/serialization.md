---
title: Serialization
sidebar_label: Serialization
---

import Lead from '@site/src/components/Lead';

# Serialization

<Lead>A payment crosses process boundaries constantly: REST requests in, Temporal workflow payloads between workers, lifecycle events out. Our domain model is a family of sealed hierarchies, so serialization has one non-negotiable job. A <code>PaidFullPayment</code> written on one side must come back as a <code>PaidFullPayment</code> on the other, never as a vague base type.</Lead>

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

Serialized, every payment, option, instrument, and timeline carries a `"type"` property holding the concrete class's simple name: `"AcceptedFullPayment"`, `"VerifiedMinimumDuePaymentOption"`, `"ScheduledTimeline"`. On the way back in, Jackson uses that discriminator to reconstruct the exact subtype. This is what lets workflow code receive a `Payment` and safely `when` over the sealed hierarchy: the concrete type survived the wire.

Two conventions to keep:

- **Every new sealed hierarchy gets the same `@JsonTypeInfo` block**, with a `PROPERTY_NAME = "type"` companion constant. Do not invent a second discriminator name.
- **Formatting quirks are annotated at the field.** The debit card expiry is the example: `@field:JsonFormat(shape = STRING, pattern = "MM/yyyy") val expiryDate: YearMonth?`.

## Where we're heading

The reflection-based approach has a known ceiling. It is the main obstacle between us and GraalVM native-image workers, and polymorphic config is manual work Jackson cannot check at compile time. Four things are under evaluation and clearly **not adopted yet**.

- **kotlinx.serialization** generates codecs for the sealed hierarchies at compile time. No reflection, native-image friendly, and the sealed-subtype registry comes from the compiler instead of annotations.
- **KSP** (Kotlin Symbol Processing) does build-time code generation and validation, so conventions become compile errors instead of review comments.
- **Konsist** writes architecture tests in Kotlin. Naming rules, module placement, and "no Exposed in workflow code" get asserted in CI.
- **Arrow `Either`** gives structured validation errors (`rule`, `code`, `message`) for the validation path only. Everywhere else, plain exceptions and Temporal retries stay the model.

Until any of that lands, Jackson is the contract. If you are adding a type that crosses a boundary, follow the `@JsonTypeInfo` pattern above and move on.
