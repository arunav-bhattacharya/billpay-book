# CLAUDE.md — Billpay Wiki Project

## What this is
A Docusaurus site documenting Billpay's credit card payment processing platform at American Express, for company leaders, product owners, and technology leaders. Structure is modeled on the existing site at https://arunav-bhattacharya.github.io/billpay-wiki/, but content follows `docs/Wiki_Spec.md`, which holds the target design: two Temporal clusters, the Router, dispatchers paced by a governor, and market onboarding through versioned releases.

The site has nine sections: Vision, Architecture, Design, Market Onboarding, Build, Testing, Deployment, Observability and Operations, plus the intro and Contributing. `CONTENT_PLAN.md` holds the treatment for each page and is the place to check before writing or restructuring one.

## Source of truth hierarchy
1. **`docs/Wiki_Spec.md`** — authoritative for every technical fact (APIs, workflows, lifecycle states, dimensions, activities). If the reference site and the spec disagree, the spec wins.
2. **`reference/`** — a snapshot of the existing billpay-wiki site. Used only for structure, tone, and section boundaries — never for facts.
3. **`CONTENT_PLAN.md`** — authoritative for which treatment (rewrite / redesign / copy / remove) applies to each page. Check it before writing or editing any page.

## Hard rules — do not violate silently
- **Design** section must not include a "Payment Services" subsection, in any form.
- **Build** section must not include a "Services" subsection, in any form.
- **Testing, Deploy, Observability** follow the spec like every other section. Extend them or rewrite them in full where the spec calls for it; the reference site is no longer their source.
- Audience includes non-engineering leadership. Vision and Architecture prose should stay accessible. Design and Build can go technical (the audience includes tech leaders) but should still explain jargon on first use, not just dump it.

## Design system
- Docusaurus, latest stable
- Light mode default, dark mode supported, gradients via CSS custom properties (not hardcoded per-component)
- Palette: the Amex design language (DLS) colours only. Bright Blue `#006FCF` for actions, links and badges, Deep Blue `#00175A` for headings, the brand bar, banners and table heads, Light Blue `#66A9E2` as a small accent, and the DLS greys. No gold, violet or cyan. All are `--amex-*` tokens in `website/src/css/custom.css`. Theme-independent brand values sit in the palette block at the top; anything that changes between light and dark belongs in the two theme blocks, as a pair. Components never hardcode a colour.
- The "Blue Box" look: the square from the Amex logo is the one shape. Numbers are badges (white digits in a blue box, corner `--amex-badge-radius`), each h2 opens on a small blue box, and a section break is three of them. Structure comes from fills, tints and soft shadows, not from ruled lines: no rule under headings, no outline on cards, no edge on the sidebar or contents rail.
- The sidebar is a quiet index and the one exception to number badges. Section names are small tracked capitals, pages rest at Regular weight, and section numbers are plain grey numerals. Only the section you are in fills its number with the Bright Blue box, and only the current page is blue, on the pill. Resting link colour flows through `--ifm-menu-color`, set on the sidebar and reset on each section row, instead of through `color` rules that would compete.
- Every doc page opens on the page banner: a solid Deep Blue block with the section number and name, beside the H1 and Lead on a pale field (the dark card surface in dark mode). It is CSS in `custom.css` (section 12) over MDX's own `<header><h1>` and the Lead's global `doc-lead` class, fed two custom properties from `src/theme/DocItem/Layout`. The homepage hero holds the nine sections as a board.

## Diagrams
Four kinds, in the order to reach for them. Authoring guide: `DIAGRAMS.md`.
- **Mermaid** fenced blocks for sequence, state and flowchart diagrams. Theming in `website/src/css/mermaid.css`, expand control in `website/src/theme/Mermaid/`. A UML class diagram uses `ClassMap` instead.
- **Components that take data as props**: `LayerStack`, `JourneyMap`, `CompositionMap`, `RouteMap`, `WorkerSplit`, `ClassMap`, plus the table set (`ApiTable`, `ActivityTable`, `ScheduleTable`, `CompareTable`) built on `DataTable`. Plain markdown tables already get the house shell, so no component is needed for those.
- **CSS box diagrams** for grouped boxes and short connectors, as in `LandscapeMap`.
- **Coordinate SVG** for dense wiring that needs pan, zoom and layer spotlight, as in `LegacyEstateMap` and `HADiagram`, or for one fixed picture that scales with the column, as in `PacingFlow`, `RowLifecycle` and `ProfileToStages`.

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

**Colour comes from tokens, always.** No component holds a hex or rgba value. A component that needs a specific step names it from the palette block: `--amex-white`, `--amex-black` (shadow only), the DLS steps such as `--amex-blue-300`, `--amex-deep-400` and `--amex-grey-700`, and the `--amex-depth-*` navies that gradients mix toward. Worker tone is `--amex-worker-online` / `--amex-worker-offline`, applied through `WorkerChip`. The nine `--amex-cat-*` section accents are one set, read by literal name in components; deployment, operations and onboarding have no reader today but stay so the set is complete. Section numbering itself is the Bright Blue badge, not a per-section hue.

**Prop names.** `term` and `desc` for a heading and the line under it, in every component that renders that pair. `rows` for a table's data. Keep a domain name where the concept really is different: a worker split has `workers`, a journey has `steps`.

## Page conventions
Every doc page under `website/docs/`:
- Front matter carries `title` and `description`. The description is the page's own lead sentence, which is what reaches search results and link previews.
- One `#` H1, then `<Lead>`. Together they form the page banner, so nothing goes between them. Lead takes no props besides its text.
- A `<SectionIndex>` sits under a `## In this section` heading.
- `desc` strings use backticks, unless the value needs JSX for inline markup.

## Writing style — applies to every page
- **Write like a blog post from a senior engineer or product owner** who is explaining the system to a colleague. Open on the problem or the thing the reader will learn, say why before how, use a concrete number or example where one exists, and keep the reader moving from one idea to the next. The reader should finish a page knowing something they didn't.
- **Run the `human-writing` skill for every page.** Load it at the start of any content task, together with `tone-of-voice` and `humanizer`, not as a cleanup pass at the end.
- **`tone-of-voice`** lives at `.claude/skills/tone-of-voice/SKILL.md` and defines the house voice: approachable, sophisticated, professional, aspirational, authentic, supportive, trustworthy. Never overly casual, trendy, formal, out of reach, humorous, or pretentious. The humanizer strips the machine tells; `tone-of-voice` sets what goes in their place.
- **No em dashes or en dashes.** Use a period, comma, colon, or parentheses. This is the most reliable AI tell and it is a hard rule.
- **Short paragraphs that explain, with bullets and tables where the reader scans or compares.** Verbosity is the problem, not page length.
- **Avoid `**Bold header:** explanation` bullet lists.** Write the point directly.
- **Plain words over inflated ones.** Simple and easy to understand beats impressive.
- Applies to page copy and to user-visible strings inside React components.

## Working conventions
- No page gets written ad hoc — every page starts from an entry in `CONTENT_PLAN.md`.
- One phase per session/commit. Don't jump ahead to Design before Vision/Architecture are reviewed and approved.
- From Build on, a phase doesn't wait for the review of earlier pages. The user reviews drafted pages in their own time and asks for changes (2026-10-18).
- Commit after every phase, not just at the end.
- Sub-agents are appropriate for Mermaid diagram generation from spec tables and for checking finished pages against the spec. Keep page authoring on the main thread: every section now follows the spec, and the voice and judgment calls need one author.

## Repo layout
```
/docs/Wiki_Spec.md            # source spec, the source of truth for every fact
/reference/                   # snapshot of the existing site, read-only reference
/CONTENT_PLAN.md
/DIAGRAMS.md                  # diagram authoring guide
/CLAUDE.md
/website/                     # Docusaurus project root
  docs/                       # the pages, one folder per section
  src/
    components/               # one folder per component, each importable from MDX
    css/custom.css            # tokens and the site's own styling
    css/recipes.module.css    # the shapes components compose
    css/mermaid.css           # diagram theming, kept apart for its !important weight
    lib/                      # shared hooks and helpers, not MDX-facing
    theme/                    # swizzles
```
