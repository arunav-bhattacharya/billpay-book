---
name: tone-of-voice
description: The house voice for the Billpay wiki. Load before writing or editing any page prose, component copy, sidebar label, or user-visible string. Defines the seven qualities the writing must have, the six it must never have, and the concrete tests that separate them.
---

# Tone of voice

Every page on this site is read by three kinds of people at once: a company leader who needs the shape of the thing, a product owner who needs the rules, and an engineer who needs the detail. One voice has to serve all three. That voice does not change based on who is reading. It is the same on the Vision page as it is in the SLA tables.

Use this skill together with `humanizer`. The humanizer removes the machine tells. This skill sets what should be there instead.

## What we sound like

**Approachable.** A person wrote this, and that person has actually worked on the system. Write the way you would explain it to a colleague who is new to the team and smart. Use "you" when addressing the reader. Say "we" when describing what the team decided.

**Sophisticated.** Precise about the thing being described. Sophistication shows up as accuracy and restraint, not vocabulary. A sentence that names the exact state, the exact API, the exact failure is sophisticated. A sentence that gestures at complexity is not.

**Professional.** Steady and considered. No hype, no filler, no apology. Assume the reader's time is worth something.

**Aspirational.** Say what the platform is for and where it is going, in terms someone could actually act on. Aspiration comes from a clear goal, not from adjectives.

**Authentic.** Only claim what is true. The legacy estate had real gaps, so name them. A workflow has real limits, so state them. Trust is built by being straight about the parts that are hard.

**Supportive.** Anticipate where the reader gets stuck and answer it there, on the page. Define a term the first time it appears. Link to the page that goes deeper instead of assuming they already read it.

**Trustworthy.** Every technical fact traces to the spec. No invented numbers, endpoint names, states, or thresholds. If something is not known, the page says so or leaves it out.

## What we never sound like

**Overly casual.** No slang, no chattiness, no "let's dive in", no exclamation marks. Lighthearted is fine in the right moment. Breezy is not.

**Wavering or trendy.** The voice does not shift by audience or by year. Avoid buzzwords and industry fashion words. Avoid acronyms and internal shorthand unless the page spells them out on first use: write "Accounts Receivable (AR), the system that tracks what the cardmember owes" before you write "AR".

**Formal.** We are a relationship-centred brand, not a legal department. Avoid "shall", "herein", "the aforementioned", "it should be noted that", "in order to", and the passive constructions that hide who is doing what. Say "the router picks the workflow", not "the workflow is selected".

**Out of reach.** Aspirational, not unattainable. Skip the rarefied reference and the lifestyle flex. Examples should be ordinary: a cardmember paying a bill, a company paying across several accounts, an operator checking why a payment stalled.

**Humorous.** No jokes, no puns, no winking asides. A light touch in a natural moment is allowed. A punchline is not.

**Pretentious.** No aphorisms, no "at its core", no manufactured profundity. If a sentence sounds quotable but says nothing new, cut it.

## Hard rules

1. **No em dashes or en dashes.** Not one, anywhere, including inside JSX strings and component props. Use a period, a comma, a colon, or parentheses. This is the single most reliable AI tell and it is non negotiable.
2. **Straight quotes only.** `"` and `'`, never the curly variants.
3. **No emoji** in headings, bullets, or body copy.
4. **Short bullets beat paragraphs.** Verbosity is the problem, not page length.
5. **No `**Bold header:** explanation` bullet lists.** Write the point directly. Bold is for a term the reader will meet again, not for decoration.
6. **Spell out jargon on first use, on every page.** Readers land on pages from search, not from page one.
7. **No fact that is not in `docs/Wiki_Spec.md`.** The spec wins over the reference site, over memory, and over what would read better.

## Tests to run on a draft

Read the draft against these. Any "yes" is a rewrite.

- Does a sentence tell the reader something is important instead of showing why? ("plays a key role", "is critical to", "underscores the")
- Does a paragraph restate the heading before it starts saying anything?
- Are there three things in a list because there are three things, or because three sounded complete?
- Does a bullet start with a bold label and a colon?
- Would a person say this out loud? Read it aloud and find out.
- Is there a sentence that could be deleted with nothing lost?
- Does any sentence sound like it is selling the platform rather than describing it?
- Is a term used before it is defined?

## Before and after

Puffed up:
> The Billpay Router serves as a critical component that plays a pivotal role in ensuring payments are seamlessly directed to the appropriate workflow, underscoring the platform's commitment to reliability.

House voice:
> The Billpay Router reads the request date, the instructions, and the market's dimensions, then picks the workflow that will run. Nothing is branched by hand in code.

Too formal:
> It should be noted that in the event that validation is not successfully completed, the payment shall be declined and no further processing shall be undertaken.

House voice:
> A payment that fails validation is declined. Nothing downstream runs.

Too casual:
> So basically the worker just picks up the task and does its thing. Easy!

House voice:
> The Online worker picks up the task and runs the stage. If it fails, Temporal retries it from the same point.

Bold-header bullets:
> - **Durability:** Workflows are durable and survive restarts.
> - **Traceability:** Every transition is persisted and published.

House voice:
> - A workflow survives a worker restart and resumes from its last completed step.
> - Every state transition is written to the database and published as an event.

Pretentious:
> At its core, the payment lifecycle is the language the enterprise speaks.

House voice:
> Every market describes a payment with the same set of states, so reporting and operations can treat them the same way.

## When the page is a table or a reference list

Most of this site is reference material. The voice still applies, but it lives in the lead sentence, the column headings, and the one line of context above the table. Do not pad a reference page with prose to give the voice somewhere to live. A clean table with one honest sentence in front of it is the house voice working correctly.
