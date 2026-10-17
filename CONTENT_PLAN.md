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
| 2 | Architecture | — | **Rewrite** | Reference site (structure) + Spec (APIs, workflows, routing) | Must reflect the spec's two Temporal clusters, the Router and the "Overall Payments View" |
| 3 | Design | Payment Lifecycle States · Journeys · Routing and start modes · Core Components (Workflow / Stage / Activity / Client) · Pacing · Throttling · Corporate allocations · Sequence Diagrams | **Redesign** | Spec (primary) | **No "Payment Services" subsection** |
| 4 | Market Onboarding | Overview · Market profile · Operations settings · Releases and environments · Provisioning | **New** (2026-10-15) | Spec §Market Onboarding | Between Design and Build. The billpay-ui deployable and screen pages link here |
| 5 | Build | API Gateway (One Data Functions) · Billpay REST APIs · Router · Workflows, stages, activities and clients · Dispatchers and the governor · Database · Schedules | **Redo** | Spec (primary) | **No "Services" subsection** |
| 6 | Testing | Functional · Non-functional, with the seven load-test runs | **Redo** (was Copy) | Spec (primary) | Follows the spec; extend or rewrite in full (decision 3, 2026-10-15) |
| 7 | Deploy | Deployables · Pipeline · Temporal Server | **Redo** (was Copy) | Spec (primary) | Follows the spec; extend or rewrite in full |
| 8 | Observability | Monitoring · SLA/SLI/SLO · Alerts | **Redo** (was Copy) | Spec (primary) | Follows the spec; extend or rewrite in full |
| 9 | Operations | Familiarity · Dispatch controls · SOPs | **Redo** (was Copy) | Spec (primary) | Follows the spec like every other section |

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
| Router: trigger to workflow, start modes, workflow IDs | `design/routing.md` |
| Schedule to workflow | `design/component-model/workflows/periodic.md` |
| Online / Offline cluster split | `design/component-model/workflows/index.md` |
| Per-workflow behaviour | `design/component-model/workflows/*.md` |
| Per-stage behaviour | `design/component-model/stages.md` |
| Activities | `design/component-model/activities.md` |
| Flow diagrams | `design/sequence-diagrams.md` |
| One-Data functions, core endpoints | `build/api-spec/one-data.md`, `billpay-core.md` |
| Tables and schema | `build/database.md` |
| Tech choices | `build/principles/tech-stack/*.md` |
| Code rules and enforcement | `build/principles/core-build/*.md` |
| Why Temporal, durable execution | `architecture/overview.md#why-temporal` |
| Physical topology, failover | `architecture/high-availability.md` |
| Work Tracker lifecycle, dispatchers, governor | `design/pacing.md` |
| Task queues, throttling, priority, fairness | `design/throttling.md` |
| Corporate allocations flow | `design/corporate-allocations.md` |
| Market profile and behaviors | `onboarding/market-profile.md` |
| Operations settings | `onboarding/operations-settings.md` |
| Releases and environments | `onboarding/releases.md` |
| Provisioning API and workflow | `onboarding/provisioning.md` |
| Building the Router | `build/principles/core-build/router.md` |
| Building dispatchers and the governor | `build/dispatchers.md` |
| Cluster settings, shards, standby | `deployment/temporal-server.md` |
| Alert catalogue | `observability/alerts/kibana.md` |
| Pacing dashboards | `observability/monitoring/pacing.md` |
| Dispatch controls for operators | `operations/familiarity/dispatch-controls.md` |
| Load-test runs | `testing/non-functional/performance.md` |

### Page changes

- **New:** `design/routing.md` (the router table, moved out of Architecture
  and out of the orphaned `design/journeys/api.md`, which nothing linked to). It sits first
  under Component Model, before Workflows, because routing is what picks the workflow.
- **Moved:** `design/diagrams/sequence-diagram.md` → `design/sequence-diagrams.md`.
- **Deleted:** `design/journeys/api.md`, `design/diagrams/state-diagram.md` (9 of its 12
  diagrams were strict subsets of `payment-state-model`; the Update Payment one was salvaged
  into `workflows/core.md`), `design/diagrams/index.md`, `design/database.md` (superseded by
  `build/database.md`), `architecture/components.md` (merged into `overview.md`).
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

### The AWS region contradiction, resolved (2026-07-31)

`architecture/high-availability.md` used to say the Temporal cluster was **a single cluster in
us-east-1**, with a failure row reading "no workflow can start or advance while the cluster is
down". `deployment/temporal-server.md` said **us-east-1 active with a us-west-1 passive
standby** and manual promotion, and pointed at the HA page for "the full regional picture",
which that page did not draw.

**Resolved on user direction in favour of two regions**, which is what `temporal-server.md`
already described in detail. This was a judgement call by the user, not something a document
settled: neither `docs/Wiki_Spec.md` nor `reference/` mentions any AWS region, so both accounts
came from outside the source hierarchy. Treat the two-region topology as the authority now,
and if that is ever wrong, the HA page and `temporal-server.md` have to move together.

What changed on the HA page:
- The lead no longer says "single cluster", and names the standby alongside Oracle's, since the
  two are promoted the same way and for the same reason.
- `## Temporal` gains the us-west-1 standby with its replicated Postgres and manual promotion.
- The failure row now says an operator can promote the standby, rather than implying there is
  nothing to fail over to.
- `HADiagram` gains a us-west-1 band under the us-east-1 one: a dimmed Postgres drum, a
  `STANDBY` pill, and a replication edge from the east writer. The canvas grew from 850 to 1030
  to fit it, and the legend moved down. Verified against the live DOM as the original was: zero
  text collisions in screen space, nothing outside the canvas, and the new edge crosses no
  label. It routes down x=1088 because the "Histories…" line above reaches x=1071, which is the
  only clear lane to the region edge.
- `architecture/index.md` still does not assert a region count, which stays correct either way.

## Phase H — Target design (2026-10-15)

Every page moves to the target design in the *Billpay Temporal Scaling Design* doc. The plan below comes from that doc's **Wiki changes** tab (rev 38); the facts come from the rewritten `docs/Wiki_Spec.md`. 61 of the 85 pages change and 13 pages are new, 5 of them in a new Market Onboarding section.

**Decisions behind it** (Wiki changes tab, settled by the user):

1. Every page shows the target design now, not the rollout steps.
2. `Wiki_Spec.md` is rewritten with the new design, keeping nothing of the old, and stays the source of truth.
3. Testing, Deployment and Observability may be extended or rewritten in full.
4. Credit balance refunds run on Online (Update-With-Start) from channels, and on Offline for refunds AR raises, which the AR intake dispatcher pulls from One-Data's inbox.
5. Periodic workflows: `ProcessPaidEventsWorkflow`, `ProcessMissingPaidEventsWorkflow`, `PurgeTransactionDataWorkflow`.
6. Each cluster is active-passive, with a passive standby in us-west-1 promoted on its own.
7. The allocations callback function is `CreatePaymentAllocations.v1`, a placeholder name.
8. Provisioning API paths as in the spec: `/provisioning/releases`, `/provisioning/markets/{market}/{account-type}/pause` and `/resume`, `GET /provisioning/capabilities`.
9. PAID (2026-10-16): One-Data keeps the inbox in Postgres and marks a payment `READY` when its second event arrives. Billpay pulls `READY` rows through two One-Data functions and settles them in batches; Oracle holds no inbox. A split payment turns `PAID` leg by leg: a leg's AR posting pairs with the settlement of its payment (the ID before the `_`), and the parent stays `PROCESSED`. An event without a payment ID is matched through `ReadPayments.v1`.
10. Pull (2026-10-16): AR intake, returns and inbound payments are stored in One-Data's inbox and pulled by dispatchers at the governor's pace; their async APIs go away. Of payment work, only the allocations callback still starts async.
11. One app (2026-10-16, firmed up 2026-10-17): billpay-core is one app for both clusters, with offline work's own Oracle pool and slot caps. There is no separate online or offline app, and none is planned: more capacity means more pods of the same app. Load-test runs 4 and 6 run on it, and online p99 must hold while offline work runs. Every page and diagram shows one billpay-core.
12. Rejected requests (2026-10-16): when a dispatcher marks a pulled request `REJECTED`, only operations hear of it, through the alert. AR and other senders are not told.
13. Domain model (2026-10-16): `docs/domainModel/Payment.kt.md` is the payment model as the user supplied it, replacing `Other Domain Objects.md` and `Transaction.kt.md`. A new Design page, Domain Model, shows it with `DomainModelMap` and lists its gaps against the lifecycle; the spec has a Payment Domain Model section.
14. Corporate (2026-10-17): a corporate payment can't be cancelled or updated once its allocations are fetched (409). Legs are written only once the parent is `ACCEPTED`: a batch that arrives earlier waits in `allocation_batch`, and the leg dispatcher writes it when the parent is released. `HELD` is gone, no leg is ever cancelled, a declined parent never gets legs, and `ALLOCATED` means the batches add up to the amount. The completion check also needs every batch written.
15. Corporate, corrected (2026-10-17, replaces 14 where they differ): `ALLOCATING` and `ALLOCATED` are payment states, after `ACCEPTED` for pay today and after `SCHEDULED` for a scheduled payment; `allocation_status` is gone. No workflow waits and no parent starts the next step: every step is a Work Tracker row a dispatcher picks up. Verify's commit writes an `ALLOC_REQUEST` row, due at once for pay today or at the market's fetch time (on the due date, or a set number of hours or days before it). The batch that completes the amount commits `ALLOCATED` with an `ALLOC_EXEC` row, and the new allocated-payments dispatcher (every minute, control queue `ctl-allocated`) starts `ExecuteScheduledPaymentWorkflow` for both kinds: Reverify for a scheduled payment only, then Execute, which clears once and releases the legs. `SCHED_EXEC` is for every other scheduled payment. Late allocations wait in `ALLOCATING`, with an alert at the market's alert point. Each leg turns `PAID` and the parent stays `PROCESSED`. No `ACCEPTED` → `CANCELLED`.
16. Four answers (2026-10-17): a Work Tracker row the Router refuses is marked `FAILED` and raises the retries-exhausted alert; the Online cluster's one queue is `online-wf`; channels call `CreatePaymentIntent.v1` and `CreatePaymentInstallment.v1`; Accounts Receivable never raises a corporate payment.

**Voice** (user direction, 2026-10-15). Blog-post style: a senior engineer or product owner explaining the system, so the reader learns something and stays with it. Run `human-writing` with `tone-of-voice` and `humanizer`. A page marked **Style pass** keeps its facts; its prose is reworked only where it lists without explaining.

**Commits, one phase each:**

1. Spec and repo files: `Wiki_Spec.md`, this file, `CLAUDE.md`, the `--amex-cat-onboarding` token.
2. Intro, Vision and Architecture. Stop for review before Design.
3. Design and Market Onboarding, together with the new section's navigation: `sidebars.js`, `sections.js` (`onboarding` after `design`; later sections renumber), the sidebar section numbers in `custom.css`, and a ninth tile on the homepage board. `intro.md` gets its Market Onboarding link at the same time. The navigation waits for phase 3 because the build fails on links to pages that don't exist yet.
4. Build.
5. Deployment, Observability, Operations, Testing and Contributing.

Each new page gets its `sidebars.js` line and its parent's SectionIndex entry in the phase that writes it.

### Global changes, on every page

| Topic | Change to |
|---|---|
| Where workflows run | Online and Offline Temporal clusters, each with its own Aurora DB, both served by one app, each active-passive. Nothing calls across them; an Oracle Work Tracker row is the only hand-off |
| Layers | Workflow → Stage → Activity → Client. A stage is one business step and the only layer that varies by behavior. `{System}Activities` per system, throttled systems on their own `ds-*` queue, Oracle through the `PaymentStore` local activity |
| Names | `...Workflow`. `CreateScheduledPaymentWorkflow`; `RequestAllocationsWorkflow` plus `ReceiveAllocationsWorkflow`; the three periodic jobs above |
| Dated work | A Work Tracker row until it is due; a dispatcher starts the workflow on the day at the governor's rate |
| Work nobody waits for | AR intake, returns and inbound payments wait in One-Data's inbox, and dispatchers pull them at the governor's pace. Of payment work, only the allocations callback still starts async |
| Corporate payments | `ALLOCATING` and `ALLOCATED` are payment states. No workflow waits: each step is a Work Tracker row a dispatcher picks up (`ALLOC_REQUEST`, `ALLOC_EXEC`, `ALLOC_LEG`), the same for pay today and scheduled. Once `ALLOCATED`, `ExecuteScheduledPaymentWorkflow` clears the parent once, at payment level, and releases the legs. No signals |
| Cancel and update | `SCHEDULED` only, inside the market's cancellation window, by a guarded update; a late request gets 409 |
| Before PROCESSED | Clearing, AR, OTB, accounting, eBNC and risk must succeed, then RTF and Raven, comms last. There is no outbox: lifecycle events and customer messages are activities, and every other state change announces itself right after its commit |
| PAID | Settlement and AR posting land in One-Data's inbox (Postgres), never in Oracle. One-Data marks a payment's row `READY` when the second event arrives. `ProcessPaidEventsWorkflow` pulls `READY` rows every 30 s through two One-Data functions, settles up to 500 at a time in one guarded transaction, sends the `PAID` events to RTF and marks the rows. A split payment turns `PAID` leg by leg: a leg's AR posting pairs with its payment's settlement (the ID before the `_`), and the parent stays `PROCESSED`. An event without a payment ID is matched through `ReadPayments.v1` |
| Realtime clearing | Only pay-today payments from channels. BOTH is resolved per journey |

### Pages

Treatments: **Update** (facts change, rewritten in the house voice), **Style pass** (facts stay), **New**. Status uses the legend at the top of this file.

#### Intro and Vision

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `intro.md` | Update | Router row: a library in the core APIs and dispatchers that admits (422 when not live), picks the journey, pins a plan key and places the work. Workflows row drops "long-running". Schedules row: dispatchers that release dated work and pull from One-Data's inbox, paced by the governor, plus periodic jobs. Event Handlers row: events land in One-Data's inbox; a return waits for the returns dispatcher, settlement and AR posting until a payment or leg has both. Naming: `{Verb}{Object}Workflow`, stages named for their step, `{System}Activities`, `{System}Client` | ◐ |
| `vision/index.md` | Style pass | | ◐ |
| `vision/payments-overview.md` | Style pass | Sources stay as recorded in Phases F and G. Read in phase 2; it already reads well, so it is unchanged | ◐ |
| `vision/product.md` | Update | Onboarding adds the Operations step and versioned releases, which each environment tests and signs off (RFC in production). Behaviors are Y, N or BOTH. One-Data collects the two confirmations, and Billpay marks a payment PAID once both are in; a corporate payment is tracked per allocation, and asks for its allocations before any money moves (`ALLOCATING`, then `ALLOCATED`). Bulk intake from AR is answered once stored | ◐ |
| `vision/engineering.md` | Update | Stages picked at runtime from the plan key. Event handlers record settlement, AR posting and returns in One-Data's inbox, which marks a payment or leg ready once both confirmations are in; Billpay pulls ready ones in batches, and no workflow waits on the events. Dispatchers pull returns, inbound and AR intake at the governor's pace, and the governor also watches online response times. BOTH in the behavior answers. CompositionMap shows releases, provisioning and the plan key | ◐ |

#### Architecture

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `architecture/index.md` | Update | "The two worker pools" becomes "the two Temporal clusters and what each runs" | ◐ |
| `architecture/overview.md` | Update | LayerStack: admission and placement in the Router; the two clusters and the dispatchers replace Workers; drop "Composed per market behaviors". Router steps: admit, pick the journey, resolve behaviors, pin the plan key, place, start. Periodic work: one dispatcher per kind of work, each with its own Schedule and budget, at rates the governor resets every 15 s. New two-cluster diagram (`ClusterMap`: CSS box diagram on the panel recipe, tokens, aria-label). The inbox is One-Data's, so Oracle holds payments and the Work Tracker; One-Data records settlement and AR posting and marks a payment ready, and `ProcessPaidEventsWorkflow` pulls it. A split payment turns PAID leg by leg. Returns, inbound and AR intake wait in One-Data's inbox for their dispatchers, and `ClusterMap` labels the Offline start "Dispatcher or async start". One app hosts both clusters' workers. A corporate payment asks for its allocations first, then clears once and posts each allocation as a leg | ◐ |
| `architecture/high-availability.md` | Update | Aurora and OpenSearch 2 per cluster; Offline has 4K shards. One app (core APIs, Router, dispatchers, governor, both clusters' workers, a client per cluster), with offline work's own Oracle pool and slot caps; more capacity means more pods. Failure rows per cluster: Online down stops caller-facing journeys; Offline down pauses paced work while dated work waits in Oracle. Oracle row: `PaymentStore` rides out patching. HADiagram redrawn with a us-west-1 standby per cluster, and billpay-core as one box per site: active in IPC2, a standby of the same app in IPC1, and one gRPC run that forks to both clusters. The inbox sits in One-Data's Postgres (one primary, replicated across IPC1 and IPC2), not in Oracle; a failure row for it | ◐ |

#### Design

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `design/index.md` | Update | Four layers. The Router entry adds admission, plan keys, placement and start modes. SectionIndex lists the new pages | ◐ |
| `design/principles.md` | Update | A stage is one business step that returns its outcome; no ActivityGroup. Call rules: a workflow calls stages and starts children on its own cluster, a stage calls activities and helpers, an activity calls clients, a client calls only its own system. Naming table from the spec. Stages looked up from the plan key (most specific match); combinations not onboarded get 422 | ◐ |
| `design/payment-state-model.md` | Update | Consumer and Corporate diagrams on a toggle (Docusaurus Tabs with `className="toggle-tabs"`, styled in custom.css). Corporate diagram has every state, with `ALLOCATING` and `ALLOCATED` after `ACCEPTED` for pay today and after `SCHEDULED` for a scheduled payment, then Reverify to `ACCEPTED`; no cancel once a corporate payment is `ALLOCATING`. A Corporate payments section compares pay today and scheduled. No ACCEPTED → CANCELLED. Corporate PROCESSED and PAID rules: a corporate parent turns PROCESSED in the completion check, once every leg is PROCESSED or PAID, and stays there; its legs turn PAID one by one through `ProcessPaidEventsWorkflow`'s Settle. A short section on guarded updates. Late allocations leave the payment `ALLOCATING`, with an alert at the market's alert point | ◐ |
| `design/domain-model.md` | New | The payment model as types: the class is the state, Full and Split shapes, what `VerifiedPayment` and `RepresentmentPayment` guarantee, timelines, `ReturnedInfo` and `SplitSlice`, the 28 transitions as functions, and the gaps against the lifecycle, `ALLOCATING` and `ALLOCATED` among them. `DomainModelMap` draws it. Code detail stays on Build's domain-model pages | ◐ |
| `design/journeys/index.md` | Update | Future-dated journeys never clear in real time. Wait steps become Work Tracker rows that a dispatcher releases. Fulfil lists accounting, eBNC and risk, then RTF and Raven, all before `PROCESSED` (Lumi becomes RTF). Update: a guarded cancel, then child `{newId}-init`. Corporate: pay today, scheduled and the allocations callback as three journeys, each step started by a dispatcher from a Work Tracker row; batches wait in `allocation_batch` until the parent's Execute releases them; no cancel or update once `ALLOCATING`. AR-initiated payments, returns and inbound: stored in One-Data's inbox, pulled by their dispatchers. Refunds: Online from channels, Offline when AR raises them. The External Transaction Events Tracker step becomes One-Data's inbox and the PAID pull | ◐ |
| `design/routing.md` | Update | RouteMap tags mean clusters; a start-mode column; rows for the allocations callback, representments that fall due and both refund routes. AR intake, returns and inbound are pulled by dispatchers from One-Data's inbox; only the allocations callback starts async. Corporate: CreateImmediatePayment stops at `ACCEPTED`, and dispatchers start RequestAllocations, then ExecuteScheduledPayment from an `ALLOC_EXEC` row, then one leg workflow per allocation, all on Offline. The dispatcher re-routes on the due date. Stages come from the plan key; Worker Versioning pins the build. A section on start modes and workflow IDs. Admit: a Work Tracker row is refused only if its market went out of service after it was written, and its dispatcher marks it `FAILED`. Trigger to workflow is the fork tree (option A2, chosen 2026-10-17): one tray per trigger; colour means cluster only; the line into a workflow says how it starts (solid starts at once, dashed waits for a dispatcher, an elbow is a child on the parent's cluster); every payment workflow that branches by account type forks three ways, and a consumer payment that isn't split ends in a box saying the workflow runs it all itself; the future-dated route runs down the page with its fork hanging from CreateScheduledPayment, so the corporate branch can go through RequestAllocations before it executes. `RouteMap` draws it | ◐ |
| `design/complete-picture.md` | New | Titled "The Complete Picture" (renamed from Function to Activity, 2026-10-17). Every road on one sheet: One-Data function, core API or dispatcher, the Router, the workflow, its stages and the activities they call, grouped by how work arrives (a caller waits, stored then pulled, the allocations callback, scheduled work, and the PAID drain, which a Schedule starts without the Router). `RouteLedger` draws it; picking a journey lights its calls. Workflow names drop the `Workflow` suffix. Hides the contents rail so the sheet fits the column. Redesign under review (2026-10-17): every option must keep the endpoints, the activity list and the stage-to-activity mapping, and add each road's trigger (function and caller) and the Router's six steps | ◐ |
| `design/component-model/index.md` | Update | Twelve business steps. "ActivityGroups & Activities" becomes Activities, and none vary by behavior | ◐ |
| `design/component-model/workflows/index.md` | Update | WorkerSplit by cluster. Isolation is physical at the Temporal layer; one app runs both clusters' workers, with offline work's own pool and slot caps. The "Either worker" box goes: create scheduled runs on Online from channels and on Offline from AR, corporate legs only on Offline, no child crosses clusters. Control workflows as a kind. Balance refund on both clusters | ◐ |
| `design/component-model/workflows/core.md` | Update | WorkflowMeta shows cluster and workflow ID. New stage names. Create Scheduled writes its Work Tracker rows and ends. Execute Scheduled is started by the scheduled-payments dispatcher, or for every corporate payment by the allocated-payments dispatcher; a corporate parent skips Reverify when paid today, and its Execute clears once and releases the legs. Create Immediate stops at Verify for a corporate payment. Corporate legs: AR and OTB, then accounting, eBNC and risk, at priority 2 with the parent's ID as fairness key. Update starts child `{newId}-init`. QueueRepresentment writes a `REPRESENT` row. No signals. Balance refund on both clusters | ◐ |
| `design/component-model/workflows/composite.md` | Update | Started with Update-With-Start; children on the same cluster | ◐ |
| `design/component-model/workflows/periodic.md` | Update | Dispatchers (scheduled payments and representments per market, allocation requests, allocated payments and legs every minute, AR intake, returns and inbound from One-Data's inbox every minute) and GovernorWorkflow, with no fixed batch. Paid events: the pull from One-Data's inbox every 30 s (fetch, Settle, announce, mark), the batch ID that makes a retry safe, `UNMATCHED` rows and their hourly retry, and how a split payment turns PAID leg by leg. Missing paid events: payments and legs still `PROCESSED` after 48 hours | ◐ |
| `design/component-model/stages.md` | Update | Twelve stages: Verify absorbs the four Pending stages; RequestAllocations (→ `ALLOCATING`), ReceiveAllocations (→ `ALLOCATED`, with the `ALLOC_EXEC` row) and Settle added (Settle takes a batch of up to 500 `READY` inbox rows); one Cancel stage. Each stage commits state and timeline entry (with cluster) in one guarded `PaymentStore` commit, then announces the change to RTF, and to Raven where the customer is told; Fulfil announces before its commit | ◐ |
| `design/component-model/activities.md` | Update | Retitled Activities: one row per `{System}Activities` with its queue, plus `PaymentStore`. ActivityTable gets a queue column in place of the behavior filter. No decline when allocations are late: the payment waits in `ALLOCATING` | ◐ |
| `design/sequence-diagrams.md` | Update | Participants become stages. Router hops and start modes. #1: RTF and Raven last in Fulfil, before `PROCESSED`. #2: a `SCHED_EXEC` row and the dispatcher. #3 and #4: the corporate flow, each step from a Work Tracker row (`ALLOC_REQUEST`, `ALLOC_EXEC`, `ALLOC_LEG`), with Execute in `ExecuteScheduledPaymentWorkflow` for both kinds. #5 and #6: guarded cancel and 409. #7: the returns dispatcher pulls the return from One-Data's inbox, then QueueRepresentment. #8: the representment dispatcher. #9: the inbound dispatcher. #10: One-Data's inbox sets a payment or leg `READY`, then the fetch, Settle, the PAID events to RTF and the status update. #11: payments and legs still `PROCESSED` after 48 hours. New #13: the allocations callback, where the batch that completes the amount commits `ALLOCATED` with its `ALLOC_EXEC` row | ◐ |
| `design/pacing.md` | New | Dispatchers and the governor: the Work Tracker types (`ALLOC_EXEC` included) and lifecycle (a row the Router refuses goes from `DISPATCHING` to `FAILED`), each dispatcher (the allocated-payments dispatcher included) (the AR intake, returns and inbound dispatchers read One-Data's inbox), the governor's loop, floors and costs. The PAID drain is the governor's last class: its rate is in payments a second, and the Oracle signals cut it first | ◐ |
| `design/throttling.md` | New | Queues, throttling and priority: `ds-*` queues and their limits, 429 and Retry-After, must-succeed calls, priorities 1 to 5, fairness keys. The Online cluster's one queue, `online-wf`, and why it has no `ds-*` queues. One control queue per dispatcher kind, `ctl-allocated` included | ◐ |
| `design/corporate-allocations.md` | New | Two ways in, one path: pay today and scheduled differ only until `ALLOCATED`, with `CorporateTracks` as the diagram. A corporate payment always comes from a channel, never from AR. Fetch timing (on the due date, or a set number of hours or days before it), and the request ends cancel and update. Callback batches wait in `allocation_batch`; the one that completes the amount commits `ALLOCATED` with an `ALLOC_EXEC` row; the allocated-payments dispatcher starts the execution, which clears once and releases the legs. Completion rules, the late alert, volumes | ◐ |

#### Market Onboarding (new section, between Design and Build)

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `onboarding/index.md` | New | What onboarding covers, who does what, and the path from draft to live, with an onboarding diagram | ◐ |
| `onboarding/market-profile.md` | New | One market and account type, the APIs it takes, the four behaviors with Y, N or BOTH per journey, and what the capability manifest allows | ◐ |
| `onboarding/operations-settings.md` | New | Each operations setting and what it drives. The settings table lives here and nowhere else. Allocation fetch timing: on the due date, or a set number of hours or days before it; the request ends cancel and update | ◐ |
| `onboarding/releases.md` | New | Maker-checker approval, frozen vN, promotion E1 → E2 → E3, test payments, sign-off, RFC in E3, rollback, pause and resume | ◐ |
| `onboarding/provisioning.md` | New | The provisioning API, MarketProvisioningWorkflow's five steps, `market_config_version` and `market_config_active`, and how new payments pick up a version | ◐ |

#### Build

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `build/index.md` | Update | Schedules and Database blurbs match their pages. "The worker app" becomes billpay-core, one app for both clusters. SectionIndex lists the new pages | ☐ |
| `build/api-spec/index.md` | Style pass | | ☐ |
| `build/api-spec/billpay-core.md` | Update | Start-mode column. The allocations callback and the provisioning API. Admission: 422 when not live; 429 only for an allocations callback over budget. `POST /payments/returns`, `POST /payments/inbound` and the AR paths of `POST /payments` and `POST /refunds` go away: that work is pulled from One-Data's inbox. No account-type fan-out and no direct hand-off from returns to representment. `PaymentStore` replaces the persist and idempotency activities | ☐ |
| `build/api-spec/one-data.md` | Update | Update and Delete only inside the window, 409 after. Inbound and the AR composite store their requests in One-Data's inbox and reply 202; dispatchers pull them. `CreatePaymentAllocations.v1` (placeholder). Event handlers store returns, settlement and AR posting in the inbox; a leg's AR posting pairs with its payment's settlement (the ID before the `_`), and an event without a payment ID is matched through `ReadPayments.v1`. The four inbox functions `ReadPaidReadyPayments.v1`, `UpdatePaidReadyPayments.v1`, `ReadStartRequests.v1` and `UpdateStartRequests.v1` (placeholders) | ☐ |
| `build/database.md` | Update | New tables: `work_tracker`, `allocation_batch`, `market_config_version`, `market_config_active`, and the control tables `dispatch_run`, `rate_allocation`, `downstream_limit`, `governor_decision`. `trans_dtl` gains the statuses `ALLOCATING` and `ALLOCATED`, and `legs_released_at`, `stlmt_ts` and `ar_pstd_ts`, and `split_trans_dtl` gains `stlmt_ts` and `ar_pstd_ts`. `trans_lfcyc_event` and `split_trans_lfcyc_event` are append-only, and `trans_lfcyc_event` is one row per status per presentment; their rows name the cluster, and Settle's `PAID` rows carry `batch_id`. There is no inbox in Oracle (it is One-Data's) and no outbox. "Written by" becomes `PaymentStore`. Habits: guarded updates; Work Tracker rows in the same commit as the state change | ☐ |
| `build/domain-model/index.md` | Update | The model as supplied on 2026-10-16. The gaps match the spec's list: no `DISALLOWED` type, no `PROCESSING` → `RETURNED`, `REPRESENTING` → `RETURNED` in place of `DECLINED`, no edge for legs under a scheduled parent, no cancelled leg type, no classes for `ALLOCATING` and `ALLOCATED`, no concrete `Refund` types. Behaviors resolved per journey and pinned in the plan key | ☐ |
| `build/domain-model/payment.md` | Update | `TransactionId` for IDs; `VerifiedPayment` also narrows the account to `TokenizedAccount` and the timeline to `ExecutableTimeline`; `RepresentmentPayment` and `ReturnedInfo`, which the moves into `RETURNED` take; the `Refund` branch. Corporate legs are written only at the parent's release, once its Execute has committed `PROCESSING`, so the model's split edge from `ProcessingFullPayment` covers them and no leg is ever cancelled; the 28 stay. The leg dispatcher's release writes the legs (the fan-out sentence was corrected on 2026-10-17). A stage is one business step: a `PaymentStore` commit, then its announcement to RTF and Raven | ☐ |
| `build/domain-model/instruments.md` | Style pass | | ☐ |
| `build/domain-model/payment-options.md` | Style pass | | ☐ |
| `build/principles/index.md` | Update | No activity groups in the layer list; the Router among what we build | ☐ |
| `build/principles/core-build/index.md` | Update | Call chain without ActivityGroup; stages may call helpers; children start only on the workflow's own cluster. Activities card: `{System}Activities` plus `PaymentStore`. SectionIndex adds the Router page | ☐ |
| `build/principles/core-build/activities.md` | Update | Retitled "Building Activities", named `{System}Activities`. `PaymentStore` example: guarded update, timeline entry and Work Tracker rows in one commit, as a local activity with a long schedule-to-close. `LifecycleEventActivities` (RTF) and `CommunicationActivities` (Raven) take over the publish that sat inside the transition. ActivityGroup material moves into stages | ☐ |
| `build/principles/core-build/clients.md` | Update | A client calls only its own system, never another client | ☐ |
| `build/principles/core-build/code-layout.md` | Update | No ActivityGroup row and no `market/{m}/activityGroups/`; no market-specific workflows. Market timing and BOTH rules come from billpay-ui releases, not code. One app for both clusters | ☐ |
| `build/principles/core-build/stages.md` | Update | A stage is one journey step that returns its outcome. A `{Step}Stage` interface with implementations named for the behavior, such as `MandateVerifyStage`. Example: an Execute stage. `PaymentStore` guarded updates, then the stage's announcement to RTF and Raven. Selection by plan key through the KSP index, and how market overrides enter the match | ☐ |
| `build/principles/core-build/workflows.md` | Update | No signals and no timers for dated work. The plan key picks stages at runtime. Worker Versioning (pinned) replaces version branches. Start modes replace "early return"; no eager start. Placement by the Router. A new sketch | ☐ |
| `build/principles/core-build/router.md` | New | Building the Router: admission, journey pick, behavior resolution, plan key and KSP index, placement, start calls, re-routing on the due date | ☐ |
| `build/principles/tech-stack/index.md` | Update | Temporal: two self-hosted clusters on Aurora with OpenSearch 2; Update-With-Start, Schedules, Worker Versioning, priority and fairness. KSP adopted (in the decisions table since 2026-10-17, with OkHttp and Jackson; kotlinx.serialization leaves "Under evaluation"). The Temporal line is still to do | ☐ |
| `build/principles/tech-stack/database.md` | Update | Only `PaymentStore` reaches Oracle; the habit count changes | ☐ |
| `build/principles/tech-stack/datasource.md` | Update | billpay-core, one app, replaces the worker app; offline work has its own Oracle connection pool | ☐ |
| `build/principles/tech-stack/orm.md` | Update | Only `PaymentStore` opens Oracle transactions | ☐ |
| `build/principles/tech-stack/http-client.md` | Update | Titled OkHttp, sidebar label included (2026-10-17). OkHttp's own retries are off, as the spec says: one task is one call | ◐ |
| `build/principles/tech-stack/serialization.md` | Update | Jackson is the decision (2026-10-17): one `ObjectMapper` for Quarkus REST, the clients and Temporal's `JacksonJsonPayloadConverter`, new fields get defaults. kotlinx.serialization turned down for Temporal support, speed (ej-technologies, Aug 2026) and the code we keep | ◐ |
| `build/schedules.md` | Update | Schedules start dispatchers, the governor and periodic jobs, each with its own control queue and budget. `ProcessPaidEventsWorkflow` every 30 s, overlap SKIP. No batching section: the governor sets rates every 15 s. Market Schedules arrive in a release and apply when it goes live; rollback switches back | ☐ |
| `build/dispatchers.md` | New | Building dispatchers and the governor: claiming rows with SKIP LOCKED, the inbox dispatchers that read One-Data's inbox instead, run IDs, heartbeats, budgets, `rate_allocation`, overrides, sizing | ☐ |

#### Testing

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `testing/index.md` | Style pass | | ☐ |
| `testing/functional/index.md` | Update | The Unit line adds stages | ☐ |
| `testing/functional/unit.md` | Update | Each stage implementation per behavior, and the plan-key lookup | ☐ |
| `testing/functional/integration.md` | Style pass | | ☐ |
| `testing/functional/replay.md` | Style pass | | ☐ |
| `testing/functional/e2e.md` | Style pass | | ☐ |
| `testing/non-functional/index.md` | Style pass | | ☐ |
| `testing/non-functional/performance.md` | Update | The seven load-test runs and their pass criteria, against stubs at agreed TPS with real latency; reconcile Work Tracker rows and PAID payments and legs after every run. Runs 4 and 6 decide whether billpay-core ships as one app | ☐ |

#### Deployment

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `deployment/index.md` | Update | Temporal Server in the SectionIndex. Market releases reach E1, E2 and E3 through each environment's provisioning API, not the pipeline | ☐ |
| `deployment/deployables/index.md` | Update | Five deployables: billpay-core, one app, replaces the Worker App. billpay-ui is the onboarding control plane. The two clusters are not deployables | ☐ |
| `deployment/deployables/ui-app.md` | Update | One control plane for all environments: SSO, maker-checker, audit, versioned releases. Authoring tables in their own schema, outside billpay-core | ☐ |
| `deployment/deployables/worker-app.md` | Update | Path kept, retitled "billpay-core". One app for both clusters: what it contains, offline work's own Oracle pool and slot caps, a worker per `ds-*` queue (slots ≈ queue limit × call latency), and more pods for more capacity. Payment workflows pinned with Worker Versioning | ☐ |
| `deployment/pipeline.md` | Update | The app deploys as one. Old builds keep running until their pinned workflows finish. Each build ships a capability manifest that provisioning checks | ☐ |
| `deployment/temporal-server.md` | Update | Two clusters on server 1.30.1 or later: 2K and 4K shards, OpenSearch 2, 30-day retention. Schedules on Offline. A passive standby per cluster in us-west-1, promoted on its own. With Offline down, Online keeps serving, dated work waits in Oracle, pulled work in One-Data's inbox, and allocation callbacks get 503. Offline: fairness on, priorities 1 to 5, no eager start | ☐ |
| `deployment/ci-checks.md` | Style pass | | ☐ |
| `deployment/code-merge-strategy.md` | Style pass | | ☐ |
| `deployment/deployables/codec-server-app.md` | Style pass | | ☐ |
| `deployment/deployables/mocks-app.md` | Style pass | | ☐ |
| `deployment/deployables/one-data-functions.md` | Update | One-Data also runs the inbox: its Postgres database (one primary, replicated across IPC1 and IPC2), the handlers' upsert and their `ReadPayments.v1` lookup, the start requests for AR intake, returns and inbound, the four inbox functions and the daily purge | ☐ |

#### Observability

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `observability/index.md` | Style pass | | ☐ |
| `observability/alerts/index.md` | Style pass | | ☐ |
| `observability/alerts/kibana.md` | Update | The alert catalogue from the spec's Platform section | ☐ |
| `observability/monitoring/index.md` | Update | Both clusters, and a fourth view for the governor and dispatchers | ☐ |
| `observability/monitoring/app-health.md` | Style pass | | ☐ |
| `observability/monitoring/pacing.md` | New | Governor and dispatchers: rates per class, backlog and in-flight against the cap, inbox backlogs per dispatcher, cutoff projection, downstream limits and 429s, payments waiting on RTF or Raven | ☐ |
| `observability/monitoring/sla-sli-slo/index.md` | Update | Pulled entries measure time to One-Data's 202, once stored, then the backlog age until a dispatcher starts them; the allocations callback's 202 goes out after its workflow starts, with 429 over budget | ☐ |
| `observability/monitoring/sla-sli-slo/billpay-apis.md` | Update | Channels reply through Update-With-Start within the 500 ms p99. AR, returns and inbound get One-Data's 202 once stored; after that, the measure is their backlog age. Update and Cancel: 409 outside the window. Refunds on both routes. The allocations callback | ☐ |
| `observability/monitoring/sla-sli-slo/one-data-functions.md` | Update | Cancel: the round trip to CANCELLED, or 409 outside the window | ☐ |
| `observability/monitoring/temporal-health.md` | Update | Both clusters. Panels for the governor's inputs and for backlog and rate limit on each `ds-*` and `ctl-*` queue | ☐ |

#### Operations

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `operations/index.md` | Style pass | | ☐ |
| `operations/familiarity/index.md` | Update | One Temporal UI per cluster, billpay-ui as the control plane, two Aurora DBs. SectionIndex adds dispatch controls | ☐ |
| `operations/familiarity/billpay-ui.md` | Update | The Operations step and releases in brief, linking to Market Onboarding for the process. Readiness shows real provisioning progress. Pause and resume stop and restart a live market's dispatchers | ☐ |
| `operations/familiarity/oracle-db.md` | Update | Oracle is the only hand-off between the clusters; a scheduled payment is a Work Tracker row until it is due. During patching payments pause and resume; escalate only past the `PaymentStore` schedule-to-close | ☐ |
| `operations/familiarity/temporal-db-aws.md` | Update | Two Aurora DBs and their sizing; OpenSearch 2; Offline CPU and persistence p99 feed the governor | ☐ |
| `operations/familiarity/temporal-server-aws.md` | Update | Offline queues, priorities 1 to 5 by class, Schedules on Offline | ☐ |
| `operations/familiarity/temporal-web-ui.md` | Update | Search by `{paymentId}-{suffix}` and by the search attributes. A scheduled payment has no workflow until its due date. No signals | ☐ |
| `operations/familiarity/tracing-ui.md` | Update | One trace per workflow; span links through `trace_parent`; the lookup path | ☐ |
| `operations/familiarity/opensearch-logs.md` | Style pass | | ☐ |
| `operations/familiarity/dispatch-controls.md` | New | Work Tracker statuses, `dispatch_run`, rate overrides, pausing Schedules, `governor_decision`, the exception list | ☐ |
| `operations/sops.md` | Update | Runbooks for Oracle patching, late allocations, a failed release, SEPA cutoff at risk (overrides in `rate_allocation`), retries exhausted, Offline cluster down, promoting a cluster's standby, PAID backlog age, a payment not PAID after 48 hours, an event without a payment ID that matches no payment, a rejected pulled request, One-Data's inbox down, billpay-core short of capacity (add pods) | ☐ |

#### Contributing

| Page | Treatment | What changes | Status |
|---|---|---|---|
| `contributing/index.md` | Style pass | | ☐ |
| `contributing/publish.md` | Style pass | | ☐ |
| `contributing/run-locally.md` | Update | The onboarding folder in the project layout tree | ☐ |

### Components

- New: `ClusterMap` (the two-cluster architecture), `CorporateTracks` (the corporate flow, redrawn 2026-10-17: pay today and scheduled enter on lanes of their own and join one shared path of five steps, Request, Receive, Execute, Legs and Complete, each with the state it commits and the Work Tracker row or callback that starts it; timing chips beside the steps show what differs between the kinds) and `OnboardingFlow` (billpay-ui above the three environments, every line through the provisioning API). The last two are coordinate SVG on the panel recipe, built in phase 3. `ClusterMap` is built as a CSS box diagram rather than coordinate SVG: it is boxes in groups with short connectors, and as HTML it reflows to one column on a phone instead of shrinking its type (phase 2).
- `HADiagram` redrawn with a standby per cluster, its colours moved onto tokens (phase 2). `CompositionMap` now takes `steps` and `settings`, so it can show the release, the plan key and the workflow (phase 2).
- Phase 3: `ActivityTable` lists one row per `{System}Activities` with its task queue, and filters by kind of queue instead of by behavior. `WorkflowMeta` shows the cluster, the workflow ID, what starts the workflow and, optionally, the behaviors its stages vary by. `WorkerChip` takes `cluster` (with `worker` kept as the old name), `WorkerSplit` describes clusters, and `RouteMap` takes `cluster` per workflow and a `start` column. `JourneyMap` gains `inbox` and `dispatcher` route chips, RTF in place of Lumi, and links and code in its step notes. `ScheduleTable` gains a `runs` column. The homepage board has nine tiles, the ninth spanning the row.
- `RouteMap` rewritten as the fork tree (2026-10-17): HTML and CSS on the panel recipe, one tray per trigger. Props: `triggers`, each a `term` and its `routes`; a route has a `desc`, a `flow` of workflows (each with `via`, how it starts: `uws`, `async`, `inbox`, `row` or `child`, plus `detail`, `name` and `cluster`), and optionally a three-way `fork`. Three widths by container query on the panel's content box: the trigger beside its tree from 660px, above it from 530px, and below that every fork runs down the page as stacks. A route marked `across` runs left to right from 820px.
- `RouteLedger` (new, phase 3): a CSS grid sheet, sized in em with the font following the container width, so it scales as one piece and scrolls sideways below 10.5px. Columns: function, API or dispatcher, the Router bar, workflow, the five shared stages, a stage of its own; the stage columns carry on into one row per activity interface. Clicking a journey lights its request line, its row and the calls it makes. Full screen uses the panel recipe's own tokens.
- `DomainModelMap` (new, phase 3): the payment classes by state and shape, the 28 transitions, the two traits and the value types, with the one missing move drawn as a ghost. Payment and Refund are the deepest fills, colour-coded (Deep Blue and a deep Bright Blue), and the two shapes take a pale tint of Payment's colour. `DISALLOWED` and the move from `REPRESENTING` to `DECLINED` are drawn as ordinary parts of the model; a leg is never made from a `SCHEDULED` payment and never cancelled, so neither move is drawn.
- `mermaid.css` (phase 3): the sequence diagrams' regions are repainted from tokens through exact-match sentinels: the caller and platform groups, the Online and Offline clusters (the WorkerChip cluster tokens), a dashed grey wait, and one Light Blue commit chip. The gold async span and the cyan offline worker are gone. Two links into renamed Design headings were fixed on the way: Build's code layout now points at `principles#naming`, and Deployment's worker app at `workflows#two-clusters`.
- `docs/domainModel/*.kt.md` stay as supplied (`Payment.kt.md` replaced on 2026-10-16); the domain-model pages list the gaps instead.
