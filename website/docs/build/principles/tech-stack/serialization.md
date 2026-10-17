---
title: 'Serialization: Jackson'
description: 'A payment crosses process boundaries constantly: REST requests in, Temporal workflow payloads between workers, lifecycle events out.'
sidebar_label: 'Serialization: Jackson'
---

import Lead from '@site/src/components/Lead';

# Serialization: Jackson

<Lead>A payment crosses process boundaries constantly: REST requests in, Temporal workflow payloads between workers, lifecycle events out. Our domain model is a family of sealed hierarchies, so serialization has one job it cannot get wrong. A <code>PaidFullPayment</code> written on one side must come back as a <code>PaidFullPayment</code> on the other, never as a vague base type.</Lead>

## Jackson, with type discriminators

Jackson does that job, with `jackson-module-kotlin` so it understands Kotlin constructors and nullability. Every sealed hierarchy in the [domain model](../../domain-model/index.md) carries the same annotation:

```kotlin
@JsonTypeInfo(
    use = JsonTypeInfo.Id.SIMPLE_NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = Payment.PROPERTY_NAME,   // "type"
)
sealed interface Payment : Transaction { … }
```

Serialized, every payment, option, instrument, and timeline carries a `"type"` property holding the concrete class's simple name: `"AcceptedFullPayment"`, `"VerifiedMinimumDuePaymentOption"`, `"ScheduledTimeline"`. On the way back in, Jackson uses that discriminator to reconstruct the exact subtype. This is what lets workflow code receive a `Payment` and safely `when` over the sealed hierarchy: the concrete type survived the wire.

Three conventions to keep:

- **Every new sealed hierarchy gets the same `@JsonTypeInfo` block**, with a `PROPERTY_NAME = "type"` companion constant. Do not invent a second discriminator name.
- **Formatting quirks are annotated at the field.** The debit card expiry is the example: `@field:JsonFormat(shape = STRING, pattern = "MM/yyyy") val expiryDate: YearMonth?`.
- **A new field gets a default value.** Temporal keeps a workflow's payloads for as long as it runs, so a payload written last week has to read in this week's code. With a default, an old payload still reads, and because the mapper ignores fields it doesn't know, code one release behind reads the new payload too.

## One mapper for every boundary

billpay-core builds one `ObjectMapper` at startup and uses it everywhere: Quarkus REST for request and response bodies, the [clients](../core-build/clients.md) for downstream calls, and Temporal for workflow and activity payloads on both clusters. Temporal's Java SDK already writes JSON through Jackson, so we hand it our mapper instead of adding a converter of our own:

```kotlin
val mapper: ObjectMapper = jacksonObjectMapper()   // registers the Kotlin module
    .registerModule(JavaTimeModule())
    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

val dataConverter = DefaultDataConverter.newDefaultInstance()
    .withPayloadConverterOverrides(JacksonJsonPayloadConverter(mapper))
```

Both Temporal clients take `dataConverter` in their `WorkflowClientOptions`. One mapper means one set of rules, so a payment a REST handler wrote reads back the same way inside a workflow.

## Why not kotlinx.serialization

We looked hard at kotlinx.serialization, the Kotlin team's own library. It generates codecs at compile time, needs no reflection, and gets the sealed subtypes from the compiler instead of from annotations. On paper it suits a sealed domain model better. Three things decided it the other way.

| What we checked | Jackson | kotlinx.serialization |
| --- | --- | --- |
| Temporal support | Built in. The Java SDK's default converter uses it, and takes our mapper | None ships. We would write and own the `PayloadConverter` that every workflow and activity payload passes through |
| Speed on the JVM | 29.5 µs per round trip | 41.1 µs per round trip |
| Code we keep | The domain model already carries `@JsonTypeInfo`, so nothing changes | Every class needs `@Serializable`, and Java types such as `BigDecimal` and `YearMonth` need serializers of our own |

The speed figures come from [ej-technologies' benchmark of August 2026](https://www.ej-technologies.com/blog/2026/08/java-vs-kotlin-who-can-deserialize-faster/): two million round trips of the same object graph on JDK 25, with Jackson's Kotlin module against kotlinx's JSON format. Next to a network call, either would do. The converter is what settles it: the code that turns every workflow argument into bytes is the last place we want something home-made.

kotlinx.serialization would earn another look if workers ever move to GraalVM native image, where Jackson's reflection is the obstacle.
