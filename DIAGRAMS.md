# Building diagrams for the Billpay wiki

This guide takes someone with no React experience to a working, on-brand diagram on a
wiki page. Read Part 1 once, then work from Part 3 onward whenever you need a diagram.

Every code block here has been run against the site in both light and dark mode. Copy
them as they are and they render.

---

## What this site already has

Four kinds of diagram, in the order you should reach for them.

| Kind | Built with | Examples |
| --- | --- | --- |
| **Mermaid** | A fenced ` ```mermaid ` block in the page | Sequence diagrams, the payment state model, the domain model |
| **Data-driven components** | React, props | `LayerStack`, `JourneyMap`, `CompositionMap`, `RouteMap`, `WorkerSplit`, and the table set |
| **CSS box diagrams** | React, CSS grid or flex | `LandscapeMap` |
| **Coordinate SVG** | React, hand-placed coordinates | `LegacyEstateMap`, `HADiagram` |

Nothing on the site uses a charting or graph-layout library. Everything is either
Mermaid or plain React with CSS and SVG.

---

## Start here: pick the right tool

Most diagram requests do not need new code. Work down this list and stop at the first
row that fits.

| If the diagram is… | Do this | Effort |
| --- | --- | --- |
| A sequence, state or flowchart diagram | A fenced ` ```mermaid ` block. Theming and the full-screen control are already wired up. | Minutes |
| A plain table | Write markdown. The house table chrome is applied automatically, see [3.1](#31-you-may-not-need-a-component-at-all). | Minutes |
| A card grid, a section index, an API list, a route list, a journey | Call a component that already exists and pass it your data. See [3.2](#32-components-that-already-take-your-data). | Minutes |
| Boxes, groups and short connectors, laid out in rows and columns | Recipe A, a CSS component. See [Part 4](#part-4-recipe-a-boxes-and-connectors-in-css). | An hour or two |
| A wiring diagram with many crossing lines, or one needing pan, zoom and layers | Recipe B, a coordinate SVG component. See [Part 5](#part-5-recipe-b-a-coordinate-svg-diagram). | A day |

Rule of thumb: if you can describe the picture as "these things, in these groups", use
Recipe A. If you have to say "this line goes from here to there, around that", use
Recipe B.

---

## Part 1. The React you need

Five ideas. That is genuinely all the React in this repo's diagrams.

The clearest example is a real file, [`src/components/StateLegend/index.js`](website/src/components/StateLegend/index.js),
35 lines long and containing every one of them:

```jsx
import React from 'react';
import styles from './styles.module.css';          // 5. CSS from the file next door

const ITEMS = [                                    // 4. the data, plain JavaScript
  {tone: 'intermediate', label: 'Intermediate state'},
  {tone: 'success', label: 'Terminal state, payment executed'},
  {tone: 'failure', label: 'Terminal state, payment not executed'},
];

export default function StateLegend() {            // 1. a component is a function
  return (
    <p className={styles.legend}>                  // 2. that returns markup
      {ITEMS.map((it) => (                         // 4. one entry in, one <span> out
        <span className={styles.item} key={it.tone}>
          <span className={styles.swatch} data-tone={it.tone} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </p>
  );
}
```

**1. A component is a function that returns markup.**
Give it a capital-letter name, put `export default` in front, and a page can write
`<StateLegend />`. That is the entire contract.

**2. JSX is HTML written inside JavaScript.**
Three things differ from plain HTML:

- `className` instead of `class`
- attributes are camelCase, so `stroke-width` becomes `strokeWidth`
- tags with no children close themselves, so `<br />`, not `<br>`

**3. Curly braces escape back into JavaScript.**
`{it.label}` prints a variable. `{a + b}` prints a sum. Anywhere you see `{ }` in JSX,
JavaScript is running.

**4. `.map()` is how a list becomes markup.**
`ITEMS.map(...)` takes an array of 3 and returns 3 `<span>`s. This is the single most
important idea in the whole guide: **a diagram is a data structure plus a rule for
drawing one item.** Change the array, the picture changes.

`key` is bookkeeping React insists on when you map. Use any value unique in the list.

**5. CSS Modules keep styles local.**
`styles.legend` resolves to a real class defined in `styles.module.css` in the same
folder. Names cannot collide with other components, so you can call a class `.box`
without worrying about the rest of the site.

Two more things you will see in existing files:

- **Props** are the arguments a component takes: `function Lead({children, accent})`,
  called as `<Lead accent="red">text</Lead>`. `children` is whatever sits between the
  opening and closing tags.
- **`clsx`** joins class names conditionally: `clsx(styles.box, isBig && styles.big)`
  gives `"box big"` when `isBig` is true and `"box"` when it is not.

That is the whole vocabulary. Nothing in this repo's diagrams uses anything else.

---

## Part 2. Where the files go

A component is a folder with two files:

```
website/src/components/YourDiagram/
├── index.js            the markup
└── styles.module.css   the styling
```

Use it from any page in `website/docs/`:

```mdx
---
title: Your Page
---

import YourDiagram from '@site/src/components/YourDiagram';

# Your page

<YourDiagram />
```

The import goes near the top of the markdown file, after the front matter. `@site` means
the `website/` folder, so the path is the same no matter which page imports it.

To see it:

```bash
cd website && npm start
```

The dev server runs on <http://localhost:3100/billpay-book/> with hot reload, so saving
a file updates the browser. Full instructions, including the Node version, are in
[Run Locally](website/docs/contributing/run-locally.md).

Before committing, run the production build. It is stricter than the dev server:

```bash
cd website && npm run build
```

---

## Part 3. Reuse before you build

A lot of shared machinery already exists. Using it is how a new diagram comes out
looking like it belongs on the site rather than like a visitor.

### 3.1 You may not need a component at all

[`src/theme/MDXComponents.js`](website/src/theme/MDXComponents.js) swaps every markdown
table for the house table shell. Write a plain markdown table and you get the rounded
panel, the solid Amex-blue header band and sideways scrolling for free. No import, no
component.

Reach for a table component only when you need something markdown cannot express:
row spans, per-cell rendering, links built from data.

### 3.2 Components that already take your data

These accept props, so you can use them on a new page today without writing any React.
Pass the array, get the component.

| Component | Props | Use it for |
| --- | --- | --- |
| `DataTable` | `columns`, `rows`, `rowKey`, `rowProps`, `separator`, `caption`, `toolbar`, `footer` | The house table. Every other table component is built on it. Also exports `TableShell`, the panel on its own, if you need the chrome around something that is not a `DataTable`. |
| `ApiTable` | `rows: [{fn, method, path, purpose, tag?}]`, `base` | Listing API endpoints. |
| `ActivityTable` | `rows: [{name, behaviors, transition, does}]` | Workflow activities. |
| `ScheduleTable` | `rows: [{schedule, workflow}]` | Cron-style schedules. |
| `CompareTable` | `rows: [{what, legacy, modern}]` | Before-and-after comparisons. `**bold**` works inside cells. |
| `Highlights` | `items: [{term, desc, to?, links?}]`, `accent` | A grid of key-message cards. |
| `Principles` | `items: [{title, body}]`, `accent` | A numbered list of principles. |
| `SectionIndex` | `items: [{term, to, desc}]` | The contents block on a section landing page. |
| `JourneyIndex` | `groups`, `accent` | Index of journeys, grouped by intent. |
| `LayerStack` | `groups: [{label, accent, layers}]`, `aside` | A vertical layered architecture map. |
| `JourneyMap` | `title`, `kind`, `origin`, `entry`, `core`, `workflow`, `steps`, `detail`, and more | One payment journey as a banded process flow. |
| `CompositionMap` | `apis`, `behaviors`, `run` | A three-band "inputs, profile, output" flow. |
| `RouteMap` | `rows` | Trigger-to-workflow routing tables. |
| `WorkerSplit` | `workers: [{name, tone, waiting, desc, items}]` | Online and offline worker split. |
| `WorkflowMeta` | `worker`, `behaviors` | The metadata strip above a workflow section. |
| `WorkerChip` | `worker`, `children` | The Online or Offline tag, inline. |
| `Lead` | `children`, `accent?` | The thesis paragraph at the top of a page. |

Two of these are worth a second look before you build anything new.

**`LayerStack`** covers any "groups of blocks, stacked, with connectors down the middle"
picture. It is already written and it takes your data.

**`JourneyMap`** is the most reused diagram on the site: one page,
[design/journeys](website/docs/design/journeys/index.md), draws 18 of them from data. If
your diagram is a process with steps, states and side calls, start here rather than
from scratch.

### 3.3 Shared CSS recipes

[`src/css/recipes.module.css`](website/src/css/recipes.module.css) holds the shapes the
site repeats. Pull one in with `composes`, which merges another class into yours:

```css
.wrap {
  composes: panel from '../../css/recipes.module.css';

  margin: 1.6rem 0 2rem;   /* only what the recipe deliberately leaves to you */
  padding: 1.4rem;
}
```

| Recipe | What you get |
| --- | --- |
| `panel` | The house card: surface, border ring, corner radius, shadow. Every diagram sits on one. |
| `panelHover` | The lift on hover, for cards that are links. |
| `chip` | A small pill button, as used by the legacy map's layer filters and by the site's badges. |
| `chipTinted` | The same pill, tinted by a `--chip-accent` you set. |
| `ordinal` | The grey step number used in numbered diagrams. |
| `legendRow`, `legendItem`, `legendSwatch` | A legend under a diagram. |
| `srOnly` | Visually hidden text that screen readers still read. |

A recipe deliberately declares only what no caller overrides. Everything adjustable
arrives through a CSS custom property, so set the property rather than restating the
rule.

### 3.4 Shared behaviour

| File | What it does |
| --- | --- |
| [`src/lib/useOverlay.js`](website/src/lib/useOverlay.js) | Everything a full-screen layer owes the page: Escape closes it, the page behind stops scrolling, focus moves in and returns on close. Never hand-roll this. |
| [`src/lib/sections.js`](website/src/lib/sections.js) | `sectionFromPath` and `accentFromPath` work out which of the eight sections a page belongs to, and its hue, from the URL. Use it instead of asking every page to pass a colour. |
| [`src/lib/inlineMarkup.js`](website/src/lib/inlineMarkup.js) | Renders `**bold**` and `` `code` `` inside a plain string, so data arrays can carry light formatting. |
| [`src/lib/ordinal.js`](website/src/lib/ordinal.js) | `1` becomes `"01"`, for the site's numbering. |

`Lead` is the pattern to copy for anything section-coloured:

```jsx
import {useLocation} from '@docusaurus/router';
import {accentFromPath} from '../../lib/sections';

const {pathname} = useLocation();
const accent = accentFromPath(pathname);   // the hue of whatever section the page is in
```

### 3.5 Design tokens

Never write a hex colour in a component. Everything comes from custom properties in
[`src/css/custom.css`](website/src/css/custom.css), which are redefined for dark mode in
the same file. Use tokens and both themes work for free.

| Token | Use |
| --- | --- |
| `--amex-blue`, `--amex-navy`, `--amex-midnight` | Brand blues. |
| `--amex-bg`, `--amex-panel`, `--amex-card` | Surfaces. |
| `--amex-txt`, `--amex-txt-strong`, `--amex-mut` | Text, in three weights of emphasis. |
| `--amex-line`, `--amex-line-strong` | Borders and rules. |
| `--amex-cat-vision`, `--amex-cat-architecture`, `--amex-cat-design`, `--amex-cat-build`, `--amex-cat-testing`, `--amex-cat-deployment`, `--amex-cat-observability`, `--amex-cat-operations` | One hue per section of the site. |
| `--amex-sh-sm`, `--amex-sh`, `--amex-glow` | Shadows. |
| `--amex-font-sans`, `--amex-font-mono` | Type. |

The lifecycle colours, `--amex-state-intermediate`, `--amex-state-success`,
`--amex-state-failure` and `--amex-state-choice`, live in
[`src/css/mermaid.css`](website/src/css/mermaid.css) with the Mermaid rules that use
them. Read them from there if your diagram shows payment states, so a box in your
diagram is the same colour as the same state in a Mermaid one.

Mix tokens rather than adding new ones:

```css
background: color-mix(in srgb, var(--amex-blue) 10%, var(--amex-panel));
border-color: color-mix(in srgb, var(--amex-blue) 45%, var(--amex-line));
```

The trick worth stealing from `LandscapeMap`: give each family of boxes one custom
property, then derive border, fill, chips and badge from it. Four hues, not forty
colours.

```css
.domain   { --tier: var(--amex-blue); }
.shared   { --tier: var(--amex-cat-observability); }
.external { --tier: var(--amex-cat-testing); }

.card {
  border-color: color-mix(in srgb, var(--tier) 45%, var(--amex-line));
  background: color-mix(in srgb, var(--tier) 12%, var(--amex-panel));
}
```

### 3.6 Bespoke maps: copy the pattern, do not call the component

`LandscapeMap`, `LegacyEstateMap`, `HADiagram` and `StateLegend` hold their own content
in arrays at the top of the file. They take no props, because they draw one specific
picture. For a new diagram, copy the file into a new folder, replace the arrays, and
delete what you do not need. The structure is worth keeping; the data is not.

---

## Part 4. Recipe A: boxes and connectors in CSS

Use this when the layout is rows, columns or a grid. No SVG, no coordinates. This is how
`LandscapeMap` and `LayerStack` are built.

The example below is a complete, working component: three payment stages with arrows
between them.

### Step 1. Write the data first

Decide what one box needs, then write the list. This is the design step, and the rest is
mechanical.

```js
const STAGES = [
  {title: 'Submitted', note: 'a channel calls Execute Payment'},
  {title: 'Validated', note: 'limits, mandate and risk all pass'},
  {title: 'Settled', note: 'money leaves on a rail'},
];
```

### Step 2. Draw one item, then map over the list

`website/src/components/StageFlow/index.js`:

```jsx
import React from 'react';
import styles from './styles.module.css';

const STAGES = [
  {title: 'Submitted', note: 'a channel calls Execute Payment'},
  {title: 'Validated', note: 'limits, mandate and risk all pass'},
  {title: 'Settled', note: 'money leaves on a rail'},
];

export default function StageFlow() {
  return (
    <div
      className={styles.wrap}
      role="img"
      aria-label="Three stages of a payment, left to right: submitted, when a channel calls Execute Payment; validated, when limits, mandate and risk all pass; and settled, when money leaves on a rail.">
      {STAGES.map((s) => (
        <article className={styles.box} key={s.title}>
          <h4 className={styles.title}>{s.title}</h4>
          <p className={styles.note}>{s.note}</p>
        </article>
      ))}
    </div>
  );
}
```

### Step 3. Style it, and let CSS draw the connectors

`website/src/components/StageFlow/styles.module.css`:

```css
.wrap {
  composes: panel from '../../css/recipes.module.css';

  display: flex;
  align-items: stretch;
  gap: 2.2rem;
  margin: 1.6rem 0 2rem;
  padding: 1.4rem;
}

.box {
  position: relative;
  flex: 1;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--amex-blue) 40%, var(--amex-line));
  border-radius: 10px;
  background: color-mix(in srgb, var(--amex-blue) 8%, var(--amex-panel));
}

/* the arrow lives in the gap after every box but the last */
.box:not(:last-child)::after {
  content: '→';
  position: absolute;
  top: 50%;
  right: -2.2rem;
  width: 2.2rem;
  transform: translateY(-50%);
  text-align: center;
  color: var(--amex-mut);
}

.title {
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
  color: var(--amex-txt-strong);
}

.note {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--amex-mut);
}

/* one column on a narrow screen, arrows turned to point down */
@media (max-width: 600px) {
  .wrap {
    flex-direction: column;
    gap: 1.8rem;
  }
  .box:not(:last-child)::after {
    content: '↓';
    top: auto;
    right: auto;
    bottom: -1.8rem;
    left: 50%;
    width: auto;
    transform: translateX(-50%);
  }
}
```

Three things in there are the actual technique:

- `display: flex` with `gap` puts the boxes in a row with even spacing.
- `::after` on every box but the last draws the arrow into the gap. The markup stays
  clean because the connector is styling, not content.
- The media query turns the whole thing vertical on a phone, arrow included.

### Step 4. Scale it up

To go from this to something like `LandscapeMap`:

- Swap `flex` for `display: grid` when you need real columns and rows.
- Use `container-type: inline-size` on the wrapper and `@container` queries instead of
  `@media`. The doc column changes width when the sidebar or the contents panel is
  collapsed, and container queries respond to that; media queries do not.
- Give each family a `--tier` property, as in section 3.5.
- Add a legend built from the same array that draws the boxes, so the two can never
  disagree.

---

## Part 5. Recipe B: a coordinate SVG diagram

Use this when lines matter: many connections, crossings, or a picture that needs pan and
zoom. This is how `LegacyEstateMap` and `HADiagram` are built.

### The one concept: the viewBox

```jsx
<svg viewBox="0 0 420 200">
```

That says "this drawing is 420 units wide and 200 tall". The units are arbitrary and
have nothing to do with pixels. The browser scales the whole thing to whatever space the
element occupies, so you place things in convenient round numbers and let CSS decide the
final size.

Coordinates start at the **top left**. `x` grows right, `y` grows **down**.

### Step 1. Write the boxes as coordinates

```js
const BOXES = [
  {id: 'api', x: 20, y: 30, w: 150, h: 56, t: 'Payment API'},
  {id: 'wf', x: 250, y: 110, w: 150, h: 56, t: 'Workflow'},
];
```

Hand-placing coordinates feels crude, and it is the right call. Automatic layout engines
put boxes where the algorithm likes; a diagram a reader has to follow needs boxes where
*you* want them, on shared centre lines so the important lines come out straight.

### Step 2. Draw the connector

An SVG path is a string of drawing commands:

| Command | Means |
| --- | --- |
| `M x,y` | Move to a point without drawing |
| `L x,y` | Line to a point |
| `H x` | Horizontal line to that x |
| `V y` | Vertical line to that y |
| `Q cx,cy x,y` | Curve, used for rounded corners |

Right-angled connectors only need `M`, `H` and `V`. Compute the path from the box
coordinates rather than typing numbers twice, so moving a box moves its lines:

```js
const a = BOXES[0];
const b = BOXES[1];
const EDGE = `M${a.x + a.w},${a.y + a.h / 2} H${b.x + b.w / 2} V${b.y}`;
```

That reads: start at the right edge of box A at its vertical middle, run across to box
B's horizontal middle, then drop to B's top edge. One bend.

### Step 3. The complete component

`website/src/components/TinyWiring/index.js`:

```jsx
import React from 'react';
import styles from './styles.module.css';

const BOXES = [
  {id: 'api', x: 20, y: 30, w: 150, h: 56, t: 'Payment API'},
  {id: 'wf', x: 250, y: 110, w: 150, h: 56, t: 'Workflow'},
];

const AT = {};
BOXES.forEach((b) => {
  AT[b.id] = b;
});

/* right edge of one box, top edge of the other, joined by one bend */
const a = AT.api;
const b = AT.wf;
const EDGE = `M${a.x + a.w},${a.y + a.h / 2} H${b.x + b.w / 2} V${b.y}`;

export default function TinyWiring() {
  return (
    <svg
      viewBox="0 0 420 200"
      className={styles.svg}
      role="img"
      aria-label="The Payment API calls the Workflow.">
      <defs>
        <marker
          id="tw-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className={styles.head} />
        </marker>
      </defs>

      <path d={EDGE} className={styles.edge} markerEnd="url(#tw-arrow)" />

      {BOXES.map((n) => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" className={styles.box} />
          <text
            x={n.x + n.w / 2}
            y={n.y + n.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.label}>
            {n.t}
          </text>
        </g>
      ))}
    </svg>
  );
}
```

Notes on the parts that are not obvious:

- `AT` is a lookup so you can say `AT.api` instead of counting array positions. Once you
  have more than a handful of boxes this becomes essential.
- `<defs>` holds definitions that are not drawn where they sit. The `<marker>` inside it
  is the arrowhead; `markerEnd="url(#tw-arrow)"` stamps it on the end of any path.
  Define it once, use it on every edge.
- Give the marker `id` a prefix, here `tw-`, because ids are global to the page and two
  diagrams on one page will otherwise collide.
- Edges are drawn **before** the boxes, so boxes sit on top and a line never crosses a
  label.
- `<g>` is a group, the SVG equivalent of a `<div>`.
- SVG text does not wrap. Keep labels short, or use several `<text>` elements.

### Step 4. Style it with tokens

`website/src/components/TinyWiring/styles.module.css`:

```css
.svg {
  display: block;
  width: 100%;
  /* without this the 420-unit canvas stretches to fill the column */
  max-width: 460px;
  height: auto;
  margin: 1.4rem auto 2rem;
}

.box {
  fill: color-mix(in srgb, var(--amex-blue) 10%, var(--amex-panel));
  stroke: color-mix(in srgb, var(--amex-blue) 45%, var(--amex-line));
  stroke-width: 1.5;
}

.label {
  fill: var(--amex-txt-strong);
  font-size: 15px;
  font-family: var(--amex-font-sans);
}

.edge {
  fill: none;
  stroke: var(--amex-mut);
  stroke-width: 1.6;
}

.head {
  fill: var(--amex-mut);
}
```

SVG uses `fill` and `stroke` where HTML uses `background` and `border`. `fill: none` on
a path is the one people forget; without it the browser fills the area under your line.

### Step 5. Scale it up

`LegacyEstateMap` is this same recipe with about seventy boxes, plus roughly a hundred
lines of helper code you can copy wholesale from
[`LegacyEstateMap/index.js`](website/src/components/LegacyEstateMap/index.js):

| Helper | What it does |
| --- | --- |
| `pt(id, side)` | Returns the anchor point on a named side of a box: `'l'`, `'rt'`, `'b'` and so on. You write `pt('am', 'l')` instead of arithmetic. |
| `waypoints(a, sa, b, sb, o)` | Turns two anchors into a list of right-angled points, with a short stub off each box and an optional `trunk` you place by hand to keep parallel runs in their own lane. |
| `orthPath(pts)` | Turns those points into a path string with rounded corners. |
| `link(a, sa, b, sb, o)` | Ties the three together, so one edge is one readable line: `link('apigee', 'r', 'sf', 't', {s: 'svc'})`. |

Take those four functions as-is. They are the difference between a diagram you can
adjust and one you dread touching.

---

## Part 6. Adding interaction

You need one more React idea: `useState`, which is how a component remembers something
that can change.

```jsx
import React, {useState} from 'react';

const [expanded, setExpanded] = useState(false);   // current value, setter, initial value
```

Reading `expanded` gives the current value. Calling `setExpanded(true)` changes it and
redraws the component. That is the whole model.

Full-screen, in three lines plus a button:

```jsx
import useOverlay from '@site/src/lib/useOverlay';

const collapse = useCallback(() => setExpanded(false), []);
useOverlay({open: expanded, onClose: collapse, focusRef: closeRef});

<div className={clsx(styles.wrap, expanded && styles.expanded)}>
```

```css
.expanded {
  position: fixed;
  inset: 0;
  z-index: 500;
  overflow-y: auto;
  background: var(--amex-bg);
}
```

Pair it with `role="dialog"` and `aria-modal` on the layer itself.

The other two interactions in the legacy map follow the same shape:

- **Spotlight a layer.** Hold the selected layer id in state, and add a `dim` class to
  everything that does not match. Dim, never remove; a box that vanishes makes the
  reader lose their place.
- **Pan and zoom.** Hold `{k, x, y}` in state and apply it as one transform on a
  wrapping group: `<g transform={`translate(${x},${y}) scale(${k})`}>`. One state
  object moves the entire drawing.

---

## Part 7. The checklist before you commit

- [ ] No hex colours in the component. Tokens only.
- [ ] Checked in **both** light and dark mode, using the toggle in the site header.
- [ ] The wrapper uses `composes: panel` unless you have a reason not to.
- [ ] Full-screen behaviour comes from `useOverlay`, not hand-rolled.
- [ ] `role="img"` on the diagram, with an `aria-label` describing the picture in prose.
      The label carries the content for anyone who cannot see the diagram, so write it
      as sentences, not as a list of box names.
- [ ] The legend is generated from the same array that draws the boxes.
- [ ] Checked at a narrow window width, and with the sidebar collapsed.
- [ ] No em dashes or en dashes in any user-visible string. Repo-wide rule, see
      [CLAUDE.md](CLAUDE.md).
- [ ] `npm run build` passes.

---

## Part 8. Going deeper

Everything below is a primary source. Prefer them to blog posts and to anything
predating 2023, since React's own documentation was rewritten and most older tutorials
teach patterns this repo does not use.

**React**

- [react.dev/learn](https://react.dev/learn) is the official tutorial. The first three
  pages, Quick Start, Describing the UI, and Rendering Lists, cover everything used here.
- [Rendering lists](https://react.dev/learn/rendering-lists) explains `.map()` and `key`.
- [useState](https://react.dev/reference/react/useState) for interaction.
- Ignore anything mentioning class components, `componentDidMount`, or Redux. None of it
  applies.

**Docusaurus and MDX**

- [Docusaurus: MDX and React](https://docusaurus.io/docs/markdown-features/react) covers
  importing components into a markdown page.
- [Docusaurus: styling and layout](https://docusaurus.io/docs/styling-layout) covers the
  CSS Modules setup.
- [Docusaurus: swizzling](https://docusaurus.io/docs/swizzling) explains the `src/theme/`
  overrides, which is how the Mermaid wrapper and the markdown table shell work.
- [MDX](https://mdxjs.com/docs/what-is-mdx/) if you want the format itself.

**CSS**

- [MDN: CSS grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
  and [flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout).
- [MDN: custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
  for the token system.
- [MDN: container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries),
  which is what makes a diagram respond to the doc column rather than the window.
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix).
- [CSS Modules: composition](https://github.com/css-modules/css-modules#composition) for
  the `composes` keyword.

**SVG**

- [MDN: SVG tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial) is the
  place to start. Read Positions, Basic shapes, and Paths.
- [MDN: path `d` syntax](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d)
  is the reference for `M`, `L`, `H`, `V`, `Q`.
- [MDN: `<marker>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/marker) for
  arrowheads.
- [MDN: viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox).

**Accessibility**

- [W3C WAI: complex images](https://www.w3.org/WAI/tutorials/images/complex/) is the
  standard for describing a diagram in text. Worth ten minutes before you write your
  first `aria-label`.

**Mermaid, for when a component is overkill**

- [mermaid.js.org](https://mermaid.js.org/) documents the diagram types.
- [Docusaurus: diagrams](https://docusaurus.io/docs/markdown-features/diagrams) covers
  the integration, which is already configured here. The site's own theming lives in
  [`src/css/mermaid.css`](website/src/css/mermaid.css) and the expand control in
  [`src/theme/Mermaid/`](website/src/theme/Mermaid/index.js).

**If you want to explore further**

- [d3-shape](https://d3js.org/d3-shape) generates curves and arcs if hand-written paths
  stop being enough. You can use it for path strings alone, without adopting the rest of
  D3.
- [elkjs](https://github.com/kieler/elkjs) and [dagre](https://github.com/dagrejs/dagre)
  do automatic graph layout. Useful when the graph is generated from data rather than
  drawn deliberately. Both trade control for convenience, which is the wrong trade for
  the maps on this site but the right one for, say, a dependency graph.
- [React Flow](https://reactflow.dev/) is a full node-and-edge library with dragging and
  minimaps. Heavier than anything here needs, and worth knowing about before you build a
  fifth pan-and-zoom map by hand.
