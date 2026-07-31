# Content Plan — Billpay Wiki

Status legend: `☐` not started · `◐` drafted, needs review · `✅` reviewed & approved

This file is the ground truth for what goes where. Update the status column as you go — don't let this drift out of sync with the repo.

---

## Phase 0 — Snapshot the reference site (do this before anything else) ✅

The reference site is a client-rendered Docusaurus SPA, so a plain HTTP fetch only returns an empty shell. Instead of browser-scraping the DOM, the **source repo was cloned directly** (the reference site is itself a Docusaurus project) — this yields the exact authored Markdown plus the real nav tree and theme. See `reference/README.md` for provenance (commit `a21fd36`, captured 2026-07-03).

- [x] Reference content saved to `reference/docs/**` (all 101 pages, verbatim), plus `sidebars.js`, `docusaurus.config.js`, and theme (`src/css`, `src/theme`, `src/clientModules`).
- [x] Actual page list and nav tree confirmed from `sidebars.js` — documented in `reference/README.md`. The reconstruction below understated it: the real site has **10 top-level sections** (adds Operations, Contributing, `intro`) and much deeper Design/Build trees. The navbar promotes only 6 (Vision · Architecture · Design · Build · Testing · Observability); the rest live in the sidebar. **The forbidden subsections (Design "Payment Services", Build "Services") do exist in the reference and must be dropped.** The Phase 1 table below is retained as the target-structure intent — reconcile it against the confirmed tree during Phase 1.

---

## Phase 1 — Page-by-page source map

| # | Section | Proposed subsections | Treatment | Primary source | Notes |
|---|---------|----------------------|-----------|-----------------|-------|
| 1 | Vision | — | **Rewrite** | Reference site (narrative/tone) + Spec (scope, intro) | Understand how the reference site frames the vision, restate it grounded in what the spec actually covers |
| 2 | Architecture | — | **Rewrite** | Reference site (structure) + Spec (APIs, workflows, routing) | Must reflect the updated API/workflow changes in the spec — especially the "Overall Payments View" routing table |
| 3 | Design | Payment Lifecycle States · Market Onboarding & Dimensions · Core Components (Workflow / Stage / ActivityGroup / Activity / Client) · Workflow Logic · Sequence Diagrams · State Diagrams | **Redesign** | Spec (primary) | **No "Payment Services" subsection** |
| 4 | Build | API Gateway (One Data Functions) · Billpay REST APIs · Temporal Workflows (Core / Composite / Periodic) · Activities & ActivityGroups · Overall Payments View | **Redo** | Spec (primary) | **No "Services" subsection** |
| 5 | Testing | mirror reference site | **Copy** | Reference site | Re-theme only, no content rewrite |
| 6 | Deploy | mirror reference site | **Copy** | Reference site | Re-theme only, no content rewrite |
| 7 | Observability | mirror reference site | **Copy** | Reference site | Re-theme only, no content rewrite |

---

## Diagrams required (called out explicitly in the spec)

- [ ] **Sequence diagrams** — end-to-end billpay flows spanning One-Data-Function → API → Router → Workflow → Schedule
- [ ] **State diagrams** — payment lifecycle state transitions, sourced from the state-transition column in the Activities & ActivityGroups table

Good sub-agent candidates: each diagram is a self-contained "one table in, one Mermaid diagram out" task.

---

## Build order

1. **Phase 0** ✅ — snapshot reference site content, finalize the page map above
2. **Phase A** ✅ — Docusaurus scaffold, design tokens, empty nav skeleton
3. **Phase B** — Vision + Architecture (sequential, review each before moving on — these set the voice)
4. **Phase C** — Design + Build (sequential prose/structure on main thread; diagrams can branch to sub-agents once source tables are settled)
5. **Phase D** — Testing + Deploy + Observability + Operations (copy/re-theme, can batch or sub-agent)
6. **Phase E** — QA pass: dark/light mode, nav links, Mermaid rendering, responsive check, cross-section links

---

## Phase A — decisions & outcome (2026-07-03) ✅

Scaffolded `website/` (Docusaurus 3.10.1, React 19, built-in Mermaid). Build passes
with `onBrokenLinks: 'throw'`; `npm audit` reports **0 vulnerabilities** (build/dev-only
transitive CVEs patched via `overrides` for `serialize-javascript` + `uuid`, without
downgrading Docusaurus). 82 stub pages authored; every entry links from `sidebars.js`.

**Confirmed 10-section structure** (navbar promotes 6: Vision · Architecture · Design ·
Build · Testing · Observability + GitHub; Deployment/Operations/Contributing sidebar-only):

- **Spec-authored** (facts from `docs/Wiki_Spec.md`, sub-agent verified): Vision,
  Architecture, Design, Build.
- **Mirror-from-reference** (re-theme only, no spec facts): Testing, Deployment,
  Observability, **Operations** *(kept per user direction)*.
- **Meta / housekeeping**: Contributing (run-locally, publish).

**Dropped vs. reference:**
- **Banned (hard rule):** Design → `services` ("Payment Services"); Build → entire
  `services/**` tree incl. Proposal (13 files); `build/principles/core-build/payment-services`.
- **Not spec-supported:** `build/principles/tool-selection/**` (5 files).

**Design system:** house style ported onto Docusaurus — Google Sans (Flex/Code) font
stack + **pink accent** (`#cf1d6e` light / `#ee5d9d` dark) in both themes, dark default,
subtle-3D cards, per-category accents, Mermaid state-machine semantic colors. Tokens in
`website/src/css/custom.css`.

**Follow-ups (not blocking):**
- Self-hosted Google Sans woff2 files not yet added — font stack falls back to system-ui
  cleanly meanwhile.
- A spec-driven **Core Components** page (Workflow/Stage/ActivityGroup/Activity/Client)
  to be added under Design in Phase C — carries the Services→Stages divergence.
- Visual QA (dark/light, pink accent render) pending — do via `npm start` (browser
  automation wasn't available this session).
- Spec inconsistencies logged for Phase B/C: EventHandler vs EventListener naming,
  singular `/payment/` DELETE path, `instrumentType` dimension, undocumented
  `CreateBalanceRefundWF` / `CreatePaymentWithMultipleInstructionsWF`.

## Phase B — progress (2026-07-03)

**Vision — approved `✅` (2026-07-04).** `vision/index` (TL;DR/"The Big Picture" via a
`Highlights` grid), `vision/product`, `vision/engineering` — authored on the main thread
from a full read of `docs/Wiki_Spec.md`; reference used for tone/structure only. Reusable
`Lead` + `Highlights` components (Amex tokens, light/dark) drive the design.
Rule reinforced (see memory `spec-source-of-truth`): spec is the sole source of truth every
phase; don't carry over reference details it doesn't support; don't invent.

Spec-grounding / corrections vs. reference:
- **Workers renamed** to **Online / Offline Temporal Workers** (spec §Billpay Workflows) —
  reference's "Realtime / Batch workers" is stale. Online = end-user-triggered, awaits a
  response; Offline = async (events / RTF / scheduler), no user waiting.
- Account types now include **Business Travel** (`accountType`: CONSUMER, CORPORATE,
  BUSINESS_TRAVEL).
- Removed non-spec embellishments carried over from the reference: voice-servicing /
  mobile channels, hardship plans, "wait hours / batch cycles", market "cutoffs /
  settlement windows / regulators", and "recurring" as a core frequency.
- Grounded in spec instead: refunds, inbound/third-party payments, composite flows
  (*Pay & Plan*, *Pay with MR Points*), installments, split/allocations, the **Billpay
  Router**, the real periodic workflows, and the downstream domains (clearing / AR / OTB /
  fulfillment) with `PAID` reconciled from settlement + AR-posted events.
- "dimensions" reserved for `accountType`, `requiresArPosting`, `requiresRealtimeClearing`,
  `requiresMandateAuthorization`; full state model (incl. `ALLOCATING`/`ALLOCATED`)
  deferred to Design → payment state model.

**Architecture — approved `✅` (2026-07-04). Phase B (Vision + Architecture) complete.** `architecture/index` (Big
Picture), `architecture/overview` (layered system-map Mermaid + layer responsibilities +
"Why Temporal" + brief persistence), `architecture/components` (One-Data→API table, Router
Mermaid, Online/Offline workers, the component model, async edges). Grounded in the spec's
**Overall Payments View** routing table and **Core Components**. Build passes with
`onBrokenLinks: 'throw'`; Mermaid compiled into client JS (renders in-browser).

Reference divergences corrected (spec wins):
- **Dropped the banned "Payment Services" layer** — replaced with the spec's component
  model (Workflow → Stage → ActivityGroup → Activity → Client). No link to `design/services`.
- **Realtime/Batch workers → Online/Offline.**
- Dropped invented external systems (Instruments/Plans/Mandates/Payment-Options/Customer
  360/AVS) and non-spec tables (`card_acct`, `trans_exec_queue`, `trans_exec_context`);
  kept only spec-grounded downstreams and persistence, deferring the data model to Design/Build.
- Removed the dead link to the Product Vision "speed problem" section (since deleted).

## Phase C — progress (2026-07-04) ✅

**Design — done.** `principles` (Component Nomenclature + call rules), `payment-state-model` (Consumer/Corporate tabs), `journeys` (apis/schedulers), `workflows` (core/composite/periodic, each with a Worker+Dimensions `WorkflowMeta`), `stages` (grouped by workflow, one sub-section per stage), `activities` (Generic/Dimensions column + full spec detail incl. table names), `diagrams` (per-workflow state diagrams + the 12 adapted sequence diagrams). Grounded in the spec; **no "Payment Services"**. Mermaid is Amex-themed (monospace font, brighter sequence palette).

**Build — redone ground-up (2026-07-05), 23 pages.** The first draft was judged too thin; rebuilt per user direction as a tech-lead guide with reference-informed tech stack and the user-supplied `docs/domainModel/*.kt` sources. Structure: `principles/tech-stack` (Oracle, Agroal, Exposed, OkHttp, Serialization — decision tables with rejected alternatives; Kotlin/Quarkus/Gradle/Temporal as project defaults; KSP/Konsist/Arrow/kotlinx flagged forward-looking, Jackson current per the domain model's `@JsonTypeInfo`), `principles/core-build` (code-layout, workflows with the spec's Kotlin sample verbatim, stages/activities/clients with derived skeletons), `api-spec` (one-data incl. event handlers, billpay-core incl. router branching + boundary idempotency), `data-model` (payment / payment-options / instruments from the .kt sources with spec-gap notes; database tables), `schedules`. Reference "Payment Services" rules recast onto Workflow→Stage→ActivityGroup→Activity→Client; **no "Services" subsection**; Realtime/Batch → Online/Offline. **Phase C (Design + Build) complete.**

## Phase D — complete (2026-07-05) ✅

**Testing · Deployment · Observability · Operations** mirrored from the reference (copy/re-theme treatment) via four parallel sub-agents; house style (Lead intros, v3 admonitions), reference placeholders carried as short honest pages, no invented facts. Spec renames applied throughout: Realtime/Batch → Online/Offline (incl. deployables renamed `online-worker-app` / `offline-worker-app` + sidebar), no `#`-prefixed workflow names, endpoint spellings aligned to our API pages. Observability carries the reference's full SLA/SLI/SLO tables (all numbers) re-themed onto `Highlights`.

Also completed (previously unassigned): `intro.md` (layer table without the banned rows, our naming conventions), the three **Contributing** pages grounded in this repo's real toolchain (nvm/arm64, port 3100, publish = push to main → Actions workflow), and the two remaining Design stubs (`design/database.md`, `design/diagrams/index.md`). **Zero stubs remain across all 87 pages.** Next: Phase E QA pass.

## Phase F — Vision ▸ Payments Overview (2026-07-27)

**New page: `vision/payments-overview`** — added **first** under Vision (before
`product`), so the ecosystem context comes before the zoom into Billpay.

**Source-hierarchy exception — read this before editing the page.** This page is *not*
grounded in `docs/Wiki_Spec.md`. Its facts come from two user-supplied sources:

1. `reference/payments-overview.pdf` — an ecosystem diagram of the Amex payments estate,
   mapping 18 numbered domains plus the external parties. Transcribed box-for-box into
   `src/components/LandscapeMap`. The source diagram's `NEW` ribbons on *Bill Pay Inbound
   Processor* and *Allocation Manager* were deliberately dropped. Two further
   departures from the source, both on user direction: **Allocation Manager sits outside
   the Billpay platform**, grouped with the other payments domains, and that group is
   named **Shared payments services** (the source diagram leaves it unnamed).
2. The user's account of the legacy estate — one monolith owning instruments,
   arrangements (mandates and autopays) and Amex-initiated payments; third-party-initiated
   payments in a separate set of applications; a third application consolidating both so
   payment history could be served. Drawn in `src/components/LegacyMap`.
3. The user's account of the **interface rules**, which are on neither the diagram nor the
   spec. These are the authority for the Type-A badges and rails in `LandscapeMap`:
   - Type-A APIs exist on **Bill Pay Core, Plans, Payment Instruments and Mandates**, and
     these four are the only domains channels call.
   - **Multirail Gateway** and **Payments Clearing** also expose Type-A APIs, but
     **Bill Pay Core is their only caller**.
   - Every external party is reached through **Payments Clearing**, except
     **3rd Party Account Verification**, which is reached from Payments Clearing *and*
     Payment Instruments.

   The map carries ownership in the two bands and the interface rules in badges plus
   labelled rails, because the two groupings cut across each other. Drawn connector lines
   were rejected: an SVG overlay on a responsive grid breaks on reflow.

**This supersedes, for this page only, the Phase-B note that called Instruments / Plans /
Mandates "invented external systems".** The diagram confirms they are real neighbouring
domains. Per user direction, they are named on `vision/payments-overview` and nowhere
else — `architecture/overview.md` and `architecture/components.md` were left untouched.
Anyone extending the domain vocabulary into Architecture should treat that as a separate,
explicitly approved change.

New components: `LandscapeMap` (CSS Grid — no flows to draw, and 18 boxes in a fixed SVG
viewBox would force horizontal scroll) and `LegacyMap` (inline SVG, following the
`HADiagram` precedent, because the tangle *is* the argument). Both theme-aware off the
Amex tokens.

## Phase G — Vision ▸ Payments Overview, legacy diagram replaced (2026-07-28)

**`## Before the split` renamed to `## Legacy Payments Landscape`.** `LegacyMap`
(nine conceptual boxes) replaced by **`LegacyEstateMap`**, a ~76-node map of the estate
as it actually runs. `LegacyMap/` deleted; it had exactly one usage.

**Source-hierarchy exception, extending the Phase F note above.** These facts are in
neither `docs/Wiki_Spec.md` nor the reference site. A repo-wide and git-history-wide
search found **zero** hits for AM, GPP, GHDB, FTN, IGOR, TL, WROC/SROC DB2, QREP,
APIGEE, DataPower, Boomerang, the caches and the mainframe chain. The spec has no
current-state section at all. The sole sources are two user-supplied Confluence
screenshots:

1. **`customer-journey.png`** — "Payments Customer Journey / Traceability Mapping".
   Channels, the interface thicket, Arrangement Manager, GPP, IL/IGOR/TL, FTN, the
   file and card rails, the mainframe batch chain and the reporting estate, plus the
   red "systems with traceability challenges" markers.
2. **`parsec.png`** — "Payment Elig Lite and Max Allowed". The modernisation layer:
   APIGEE, Service Facade (Routing / CircuitBreaker / PreEligibilityHandler), SOR
   Cache, Pre-Eligibility Cache, Eligibility (PreEligibilityHandler / CmInfoHandler /
   BalancesHandler), GAR, Legacy Bridge, CAS, AlternatePayment and Boomerang.

**Merges, on user direction:** *AM Legacy = Arrangement Manager* (one node);
*GPHDB = GHDB = HDB/GHDB* (one node, fed from AM over JDBC **and** from FTN by
mainframe batch, read by AlternatePayment). **Merges inferred, flagged in the plan and
not contradicted:** *Globestar* and *CAS* each appear twice in the sources and are
drawn once with both edges.

**Deliberately dropped:** Parsec's numbered `/inquiry` and `/payment` step sequences
and their walkthrough (user chose "structure only"). Non-sequence facts survive as node
sub-labels: the 5-minute cache TTL, "max of GAR and CAS", the routing keys
(channel / market / program).

**Drawing rules** (all in `src/components/LegacyEstateMap/`): orthogonal routing only,
every trunk hand-placed into a numbered lane so parallel runs never overlap; connected
boxes share centrelines so the busiest edges are dead straight. Verified in-browser with
a geometry checker: **0** edges through boxes, **0** node overlaps, **0** label
collisions. Local `--lem-*` colour ramp (channels Amex blue, interfaces cyan, key
systems green, third parties amber, databases pink, replication slate, SDK teal,
fallback red, "added on top" violet); line glyphs for database / file / message /
batch / SFT. Layer-spotlight chips, zoom, pan and a full-screen mode; nothing is ever
removed from the canvas, only dimmed. `showIncremental` prop (default `true`) toggles
the violet "added on top of the legacy estate" treatment.

`## Legacy vs modern` rewritten as a three-column table with a named **What changed**
aspect column, styled by `.compareTable` (section 14 of `src/css/custom.css`).


## Phase G addendum — the estate map after review (2026-07-28)

`LegacyEstateMap` was reworked over several rounds of review. **The two Confluence
screenshots are no longer the only source**, so record what came from where before
treating anything here as transcribed:

**From the screenshots.** The channel list, the interface thicket, Arrangement Manager,
GPHDB, GPP, IL/IGOR/TL, Instream, First Data, FTN, the card rails (Gateway, Amex
Firewall, Datacash), the file paths, the mainframe batch chain, the reporting estate,
and the whole Parsec facade (APIGEE, Service Facade, SOR Cache, Pre-Eligibility Cache,
Eligibility, GAR, Legacy Bridge, CAS, AlternatePayment, Boomerang).

**From the user directly, not on either screenshot:**
- **WCR**, a payments-domain system, replacing Transcentra in the inbound chain.
- The chain direction **Bank to Homebanking Aggregator to WCR to FTN**.
- **Corporate Allocations**: COP and CPM are not channels. They group with CARS and
  interact with AM. CARS therefore no longer hangs off FINCAP on the batch chain,
  though FINCAP still feeds it.
- **AM, GPHDB and WCR each keep their own DB2 pair** in **US-East** and **US-West**,
  QREP-replicated per pair. This replaces the shared WROC / SROC pair the screenshots
  show, and the standalone `DB2` node, which was AM's store under another name.
- **AM to GPHDB is WS**, not JDBC.
- One **Bank**, not the three the customer-journey map draws.
- The payments-domain / outside-the-domain split, which is an ownership judgement the
  screenshots do not encode: **inside** are AM, GPHDB, GPP, FTN, WCR, IL, TL, Gateway,
  APIGEE, the facade components, ABLM and RCPS; **outside** are Instream, IGOR,
  Globestar, GAR, CAS, WEBFOCUS, Corner Stone, Customer Comm, Payment Awareness,
  IDN/ENLIST, FINCAP, TRIUMPH, CRS, Global Billing, DSTO, COP, CPM and CARS.
- **Dropped on instruction:** the red traceability markers, MYCA NGI, and E-Statement DB.

**Still inferred, never confirmed:** Globestar and CAS each appear twice across the
screenshots and are drawn once with both sets of edges.

Every layout change is verified by a geometry checker run against the live DOM: zero
edges through boxes, zero node overlaps, zero label collisions.

## Design ▸ Component Model (2026-07-30)

**Restructure, no content rewrite.** `design/workflows/*`, `design/stages` and
`design/activities` moved under a new `design/component-model/` category with its own
landing page. Paths are now `design/component-model/workflows/{index,core,composite,periodic}`,
`design/component-model/stages`, `design/component-model/activities`; the page bodies are
unchanged apart from relative links. `design/principles` stays where it is and keeps the
call, naming and composition rules: Principles is the *rules*, Component Model is the
*catalogue* of what exists at each layer.

## De-duplication pass (2026-07-30)

A full read of all 91 pages found the same facts documented in up to seven places, with the
copies already drifted apart. Three causes: Design documented each of ~12 flows five times
over, reference tables had no owner (the One-Data list existed in five places with five
memberships), and Vision carried zero outbound links, so every page re-explained the model
from scratch rather than deferring to it.

**The rule now in force.** Vision and Architecture may restate a concept in a sentence or
two for their audience. **No table, diagram, or enumerated list appears twice anywhere.**
Design and Build never restate each other, they link. Mapping tables (what triggers what)
live in Design; contract tables (function, endpoint, type, schema) live in Build.

### Ownership map, authoritative

| Subject | Single home |
|---|---|
| Component model, call rules, naming | `design/principles.md` |
| Payment lifecycle states | `design/payment-state-model.md` |
| Router: trigger to workflow | `design/component-model/routing.md` |
| Schedule to workflow | `design/component-model/workflows/periodic.md` |
| Online / Offline worker split | `design/component-model/workflows/index.md` |
| Per-workflow behaviour | `design/component-model/workflows/*.md` |
| Per-stage behaviour | `design/component-model/stages.md` |
| Activities and ActivityGroups | `design/component-model/activities.md` |
| Flow diagrams | `design/sequence-diagrams.md` |
| One-Data functions, core endpoints | `build/api-spec/one-data.md`, `billpay-core.md` |
| Tables and schema | `build/data-model/database.md` |
| Tech choices | `build/principles/tech-stack/*.md` |
| Code rules and enforcement | `build/principles/core-build/*.md` |
| Why Temporal, durable execution | `architecture/overview.md#why-temporal` |
| Physical topology, failover | `architecture/high-availability.md` |

### Page changes

- **New:** `design/component-model/routing.md` (the router table, moved out of Architecture
  and out of the orphaned `design/journeys/api.md`, which nothing linked to). It sits first
  under Component Model, before Workflows, because routing is what picks the workflow.
- **Moved:** `design/diagrams/sequence-diagram.md` → `design/sequence-diagrams.md`.
- **Deleted:** `design/journeys/api.md`, `design/diagrams/state-diagram.md` (9 of its 12
  diagrams were strict subsets of `payment-state-model`; the Update Payment one was salvaged
  into `workflows/core.md`), `design/diagrams/index.md`, `design/database.md` (superseded by
  `build/data-model/database.md`), `architecture/components.md` (merged into `overview.md`).
- **Rewritten:** `design/component-model/stages.md`, from 10 workflow sections with 30
  repeating stage headings to 16 stage sections plus one workflow-to-stage-sequence table.
  Four verbatim triplications gone.
- Architecture is now two pages: Overview and High Availability.

91 pages → 87, and 3,913 words out (37,625 → 33,712), with no facts lost.
`@docusaurus/plugin-client-redirects` added, with a redirect for every removed path, so old
links keep working.

### Spec questions settled while doing this

- Schedule names normalised to the spec's periodic-workflow list: **Scheduled Payments
  Executor**, **Corporate Allocations Processor**, **Scheduled Representments Executor**,
  **Paid Events Processor**, **Missing Paid Events Processor**, **Data Purger**. The wiki
  previously carried three spellings.
- *AllocationsReady* and *AllocationsReceived* are **two different signals**, not drift. The
  first comes into Get Corporate Payment Allocations from the allocations manager, the
  second goes out to the parent workflow. `workflows/core.md` now says so.
- `ProcessInboundPaymentWF` runs on the **Offline** worker (spec §Core Workflows). The old
  routing table left it untagged.
- `instrumentType` **is** a real dimension (spec line 550, Create Payment Intent). Build's
  "all four dimensions" claim was the thing that was wrong, not the Design page.
- The installments composite has **no `WF` identifier in the spec**. `CreatePaymentAndPlanWF`
  and `CreatePaymentInstallmentWF` were both invented; the wiki now uses the spec's prose
  name, Create Payment & Installments.
- Sequence diagram 7's `Invalid Notify` participant was invented. The spec defines no
  notification on an invalid return, and the diagram now says so.

### Open, needs a human answer

`architecture/high-availability.md` says the Temporal cluster is **a single cluster in
us-east-1**, and its failure row reads "no workflow can start or advance while the cluster is
down". `deployment/temporal-server.md` says **us-east-1 active with a us-west-1 passive
standby** and manual promotion, and points at the HA page for "the full regional picture",
which that page does not draw. Neither `docs/Wiki_Spec.md` nor `reference/` mentions any AWS
region, so both came from outside the source hierarchy and cannot be reconciled from any
document in the repo. `architecture/index.md` no longer asserts a region count. **Someone who
knows the deployment needs to say which page is right.**
