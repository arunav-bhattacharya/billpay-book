# CLAUDE.md — Billpay Wiki Project

## What this is
A Docusaurus site documenting Billpay's credit card payment processing platform at American Express, for company leaders, product owners, and technology leaders. Structure is modeled on the existing site at https://arunav-bhattacharya.github.io/billpay-wiki/, but content is refined against `docs/Wiki_Spec.md`, which reflects updated APIs and workflows.

Repo currently contains only `docs/Wiki_Spec.md`. Everything else — reference snapshot, Docusaurus project, generated content — gets built from scratch. See `CONTENT_PLAN.md` for the build order; don't skip Phase 0 there.

## Source of truth hierarchy
1. **`docs/Wiki_Spec.md`** — authoritative for every technical fact (APIs, workflows, lifecycle states, dimensions, activities). If the reference site and the spec disagree, the spec wins.
2. **`reference/`** — a snapshot of the existing billpay-wiki site. Used only for structure, tone, and section boundaries — never for facts.
3. **`CONTENT_PLAN.md`** — authoritative for which treatment (rewrite / redesign / copy / remove) applies to each page. Check it before writing or editing any page.

## Hard rules — do not violate silently
- **Design** section must not include a "Payment Services" subsection, in any form.
- **Build** section must not include a "Services" subsection, in any form.
- **Testing, Deploy, Observability** should closely mirror the reference site's content. Adapt formatting/theme only — don't materially rewrite these.
- Audience includes non-engineering leadership. Vision and Architecture prose should stay accessible. Design and Build can go technical (the audience includes tech leaders) but should still explain jargon on first use, not just dump it.

## Design system
- Docusaurus, latest stable
- Dark mode default, light mode supported, gradients via CSS custom properties (not hardcoded per-component)
- Palette: *(fill in once chosen — reuse the warm-orange/teal/gold gradient system from other projects if you want visual consistency, or specify a fresh one)*
- Diagrams: Mermaid via Docusaurus's built-in mermaid support, for every sequence/state diagram the spec calls out

## Working conventions
- No page gets written ad hoc — every page starts from an entry in `CONTENT_PLAN.md`.
- One phase per session/commit. Don't jump ahead to Design before Vision/Architecture are reviewed and approved.
- Commit after every phase, not just at the end.
- Sub-agents are appropriate for: Mermaid diagram generation from spec tables, and mechanical copy/re-theme of Testing/Deploy/Observability. Keep Vision/Architecture/Design/Build authoring on the main thread — these need consistent voice and judgment calls that sub-agents can't coordinate on independently.

## Proposed repo layout
```
/docs/Wiki_Spec.md      # source spec — do not edit
/reference/             # snapshot of the existing site, read-only reference
/CONTENT_PLAN.md
/CLAUDE.md
/website/               # Docusaurus project root
```
