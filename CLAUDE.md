# CLAUDE.md — Billpay Wiki Project

## What this is
A Docusaurus site documenting Billpay's credit card payment processing platform at American Express, for company leaders, product owners, and technology leaders. Structure is modeled on the existing site at https://arunav-bhattacharya.github.io/billpay-wiki/, but content is refined against `docs/Wiki_Spec.md`, which reflects updated APIs and workflows.

The site is built and the eight sections are written. `CONTENT_PLAN.md` holds the treatment for each page and is still the place to check before writing or restructuring one.

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
- Light mode default, dark mode supported, gradients via CSS custom properties (not hardcoded per-component)
- Palette: Amex Blue Box blue with navy ink and a gold secondary, all as `--amex-*` tokens in `website/src/css/custom.css`. Theme-independent brand values sit in the palette block at the top; anything that changes between light and dark belongs in the two theme blocks, as a pair. Components never hardcode a colour.

## Diagrams
Four kinds, in the order to reach for them. Authoring guide: `DIAGRAMS.md`.
- **Mermaid** fenced blocks for sequence, state and flowchart diagrams. Theming in `website/src/css/mermaid.css`, expand control in `website/src/theme/Mermaid/`.
- **Components that take data as props**: `LayerStack`, `JourneyMap`, `CompositionMap`, `RouteMap`, `WorkerSplit`, plus the table set (`ApiTable`, `ActivityTable`, `ScheduleTable`, `CompareTable`) built on `DataTable`. Plain markdown tables already get the house shell, so no component is needed for those.
- **CSS box diagrams** for grouped boxes and short connectors, as in `LandscapeMap`.
- **Coordinate SVG** for dense wiring that needs pan, zoom and layer spotlight, as in `LegacyEstateMap` and `HADiagram`.

Reuse before building. Take colour from the `--amex-*` tokens so both themes work, sit the diagram on the `panel` recipe, and give it a `role="img"` with an `aria-label` that describes the picture in prose.

## Components and CSS

**Shared shapes live in `website/src/css/recipes.module.css`**: `panel`, `panelHover`, `chip`, `chipTinted`, `ordinal`, `legendRow`, `legendItem`, `legendSwatch`, `srOnly`. Compose them rather than copying them:

```css
.wrap {
  composes: panel from '../../css/recipes.module.css';
  margin: 1.4rem 0 2rem;
}
```

**The rule that keeps composition safe: a shared rule declares only what no caller overrides, and everything adjustable is a custom property.** Docusaurus bundles all CSS into one chunk with `ignoreOrder: true`, so a recipe and a caller that both declare the same property at one class of specificity are settled by emit order, with no warning, and not necessarily the same way in the next build. The same trap catches a caller trying to out-specify a base rule from inside its own module. When a caller needs to change something, give it a token; never a competing declaration. When this goes wrong it presents as a styling bug rather than a cascade problem, which is what makes it expensive to find.

**Tables use `DataTable`.** Columns are a spec array; size, alignment, padding, row separators and the narrow step are all `--dt-*` tokens set on the shell. `TableShell` is the chrome without the rendering, which is what markdown tables get through `src/theme/MDXComponents.js`, so a pipe table and a component table cannot drift apart. A spanning cell must omit exactly the rows it covers: an over-long `rowSpan` is not an error in HTML, it is clamped to the row group, and the cell silently swallows the next group's rows. DataTable re-checks that arithmetic in development.

**Shared behaviour lives in `website/src/lib/`** as flat files: `useOverlay` (Escape, scroll lock, focus return), `inlineMarkup` (`**bold**` and `` `code` `` in row data), `ordinal`, `sections`. It is deliberately not under `src/components/`, where every folder is a public MDX import surface.

**Colour comes from tokens, always.** Worker tone is `--amex-worker-online` / `--amex-worker-offline`, applied through `WorkerChip`. The eight `--amex-cat-*` section accents are one set, read as `var(--amex-cat-${slug})` from `src/lib/sections.js`, so grepping for a literal name will not find every use and two of them look dead when they are not.

**Prop names.** `term` and `desc` for a heading and the line under it, in every component that renders that pair. `rows` for a table's data. Keep a domain name where the concept really is different: a worker split has `workers`, a journey has `steps`.

## Page conventions
Every doc page under `website/docs/`:
- Front matter carries `title` and `description`. The description is the page's own lead sentence, which is what reaches search results and link previews.
- One `#` H1, then `<Lead>`. Lead takes its section colour from the URL, so do not pass `accent`.
- A `<SectionIndex>` sits under a `## In this section` heading.
- `desc` strings use backticks, unless the value needs JSX for inline markup.

## Writing style — applies to every page
- **Run the `tone-of-voice` skill before writing page prose.** It lives at `.claude/skills/tone-of-voice/SKILL.md` and defines the house voice: approachable, sophisticated, professional, aspirational, authentic, supportive, trustworthy. Never overly casual, trendy, formal, out of reach, humorous, or pretentious.
- **Run the `humanizer` skill alongside it.** Load both at the start of any content task, not as a cleanup pass at the end. The humanizer strips the machine tells; `tone-of-voice` sets what goes in their place.
- **No em dashes or en dashes.** Use a period, comma, colon, or parentheses. This is the most reliable AI tell and it is a hard rule.
- **Prefer short bulleted points to paragraphs.** Verbosity is the problem, not page length.
- **Avoid `**Bold header:** explanation` bullet lists.** Write the point directly.
- **Plain words over inflated ones.** Simple and easy to understand beats impressive.
- Applies to page copy and to user-visible strings inside React components.

## Working conventions
- No page gets written ad hoc — every page starts from an entry in `CONTENT_PLAN.md`.
- One phase per session/commit. Don't jump ahead to Design before Vision/Architecture are reviewed and approved.
- Commit after every phase, not just at the end.
- Sub-agents are appropriate for: Mermaid diagram generation from spec tables, and mechanical copy/re-theme of Testing/Deploy/Observability. Keep Vision/Architecture/Design/Build authoring on the main thread — these need consistent voice and judgment calls that sub-agents can't coordinate on independently.

## Repo layout
```
/docs/Wiki_Spec.md            # source spec, do not edit
/reference/                   # snapshot of the existing site, read-only reference
/CONTENT_PLAN.md
/DIAGRAMS.md                  # diagram authoring guide
/CLAUDE.md
/website/                     # Docusaurus project root
  docs/                       # the 85 pages
  src/
    components/               # one folder per component, each importable from MDX
    css/custom.css            # tokens and the site's own styling
    css/recipes.module.css    # the shapes components compose
    css/mermaid.css           # diagram theming, kept apart for its !important weight
    lib/                      # shared hooks and helpers, not MDX-facing
    theme/                    # swizzles
```
