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

1. **Phase 0** — snapshot reference site content, finalize the page map above
2. **Phase A** — Docusaurus scaffold, design tokens, empty nav skeleton matching the 7 sections
3. **Phase B** — Vision + Architecture (sequential, review each before moving on — these set the voice)
4. **Phase C** — Design + Build (sequential prose/structure on main thread; diagrams can branch to sub-agents once source tables are settled)
5. **Phase D** — Testing + Deploy + Observability (copy/re-theme, can batch or sub-agent)
6. **Phase E** — QA pass: dark/light mode, nav links, Mermaid rendering, responsive check, cross-section links
