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
- Account types now include **Small Business** (`accountType`: CONSUMER, CORPORATE,
  SMALL_BUSINESS).
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
