// Mermaid flowchart nodes are plain SVG <rect>s with a single solid fill from
// the classDef. To give the Proposal-section diagrams a softer, on-brand look
// we inject SVG <linearGradient>s into each mermaid SVG that contains nodes
// with our `bpPropN` classDef names, then rewire each matching rect's `fill`
// (and `stroke`/text colour) at runtime — light or dark stops depending on
// the current Docusaurus theme.
//
// This mirrors the pattern in inject-gantt-gradients.js. IDs are unique per
// SVG so multiple flowcharts on a page don't collide.

const SVG_NS = 'http://www.w3.org/2000/svg';

// One palette entry per classDef. Stops go from softer-saturated (left) to
// deeper-saturated (right) — same hue, two shades — so labels stay readable.
// stroke/text colours are also theme-paired.
const PALETTE = [
  {
    cls: 'bpProp1', // neutral cream / sand
    light: ['#FAF8F2', '#EDE9DD'],
    dark:  ['#2A2823', '#1C1B17'],
    strokeLight: '#9C9886', strokeDark: '#7C7867',
    textLight:   '#2C2C2A', textDark:   '#E8E6DD',
  },
  {
    cls: 'bpProp2', // lavender / violet
    light: ['#F4F3FE', '#D7D2FB'],
    dark:  ['#231D54', '#15113A'],
    strokeLight: '#7B6FE6', strokeDark: '#9F95EC',
    textLight:   '#26215C', textDark:   '#D6D0FF',
  },
  {
    cls: 'bpProp3', // mint / teal
    light: ['#E6F8F1', '#C5EBDC'],
    dark:  ['#0F2A22', '#091F18'],
    strokeLight: '#138862', strokeDark: '#3FBF98',
    textLight:   '#04342C', textDark:   '#B5ECD4',
  },
  {
    cls: 'bpProp4', // sky / blue
    light: ['#EAF3FC', '#CFE3F7'],
    dark:  ['#10243C', '#0A1A2B'],
    strokeLight: '#2675C5', strokeDark: '#4D9EE0',
    textLight:   '#0C447C', textDark:   '#BCD9F5',
  },
  {
    cls: 'bpProp5', // peach / coral
    light: ['#FBEEE8', '#F6D6CA'],
    dark:  ['#2E1810', '#1F0F0A'],
    strokeLight: '#B65030', strokeDark: '#D67555',
    textLight:   '#4A1B0C', textDark:   '#F1BFA8',
  },
  {
    cls: 'bpProp6', // amber / gold
    light: ['#FBF1DC', '#F6D89B'],
    dark:  ['#2E2310', '#1F1808'],
    strokeLight: '#A06A1A', strokeDark: '#D9A451',
    textLight:   '#633806', textDark:   '#F5D38C',
  },
  {
    cls: 'bpProp7', // red / danger
    light: ['#FCEDED', '#F8C7C7'],
    dark:  ['#2E1010', '#1F0808'],
    strokeLight: '#B73838', strokeDark: '#E47373',
    textLight:   '#7A1818', textDark:   '#F1B3B3',
  },
];

function gradientId(suffix, cls, theme) {
  return `bp-prop-grad-${cls}-${theme}-${suffix}`;
}

function ensureDefs(svg) {
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

function appendGradient(defs, id, stops) {
  if (defs.querySelector(`#${CSS.escape(id)}`)) return;
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', id);
  grad.setAttribute('x1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('y2', '100%');
  stops.forEach((color, i) => {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', i === 0 ? '0%' : '100%');
    stop.setAttribute('stop-color', color);
    grad.appendChild(stop);
  });
  defs.appendChild(grad);
}

function hasProposalNodes(svg) {
  return PALETTE.some(({ cls }) => svg.querySelector(`.${cls}`));
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function paintSvg(svg) {
  const suffix = svg.dataset.bpPropSuffix;
  if (!suffix) return;
  const theme = currentTheme();
  PALETTE.forEach((entry) => {
    const { cls, strokeLight, strokeDark, textLight, textDark } = entry;
    const stroke = theme === 'dark' ? strokeDark : strokeLight;
    const text   = theme === 'dark' ? textDark   : textLight;
    const id     = gradientId(suffix, cls, theme);

    svg.querySelectorAll(`g.${cls}`).forEach((node) => {
      // The rect inside the node — flowchart node shape.
      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.style.setProperty('fill', `url(#${id})`, 'important');
        rect.style.setProperty('stroke', stroke, 'important');
        rect.style.setProperty('stroke-width', '1.2', 'important');
      }
      // Subgraph clusters render as <g class="cluster"> with their own rect.
      const clusterRect = node.querySelector(':scope > .cluster > rect, :scope > .cluster-rect rect');
      if (clusterRect) {
        clusterRect.style.setProperty('fill', `url(#${id})`, 'important');
        clusterRect.style.setProperty('stroke', stroke, 'important');
      }
      // Node label colour — covers both foreignObject HTML labels (htmlLabels: true)
      // and <text> nodes when html labels are off.
      node.querySelectorAll('.nodeLabel, .nodeLabel *, foreignObject *, text, tspan').forEach((el) => {
        el.style.setProperty('color', text, 'important');
        el.style.setProperty('fill', text, 'important');
      });
    });
  });
}

// Classify each proposal-page flowchart so width-equalisation knows which ones
// to resize.
//
//   runtime-flow      — Figure 1; multi-shape, do NOT resize.
//   bit-weights       — 5 lavender (bpProp2) tiles in a row; do NOT resize.
//   worked-resolution — 3 rulebook boxes (bpProp1 + bpProp3 + bpProp6); the
//                       widest of these sets the target for the worked-example
//                       AND the single-node siblings below.
//   fallback / fail   — single-node diagrams (bpProp3 alone, bpProp7 alone)
//                       that should match the worked-resolution width.
function classifyProposalSvg(svg) {
  if (svg.querySelector('g.bpProp4')) return 'runtime-flow';
  const nodes = [...svg.querySelectorAll('g.node')];
  if (nodes.length === 0) return 'unknown';
  if (nodes.every((n) => n.matches('.bpProp2'))) return 'bit-weights';
  if (svg.querySelector('g.bpProp6')) return 'worked-resolution';
  if (nodes.length === 1 && nodes[0].matches('.bpProp3')) return 'fallback';
  if (nodes.length === 1 && nodes[0].matches('.bpProp7')) return 'fail';
  return 'other';
}

function resizeNodeRects(svg, targetW, selector) {
  // Mermaid (v11) lays each flowchart node out as:
  //   g.node[transform=translate(cx, cy)]
  //       > rect.label-container[x=-w/2, width=w]        (the visible coloured box)
  //       > g.label[transform=translate(-fw/2, fy)]
  //            > foreignObject[width=fw] > div           (the label payload)
  // To widen the box AND give the label more room to wrap, we update every
  // layer plus the parent SVG's viewBox / max-width so the wider content
  // doesn't overflow into clipped territory.
  const inset = 16;             // padding inside the box for text
  const innerW = Math.max(40, targetW - inset * 2);

  const matchingNodes = [...svg.querySelectorAll('g.node')].filter((n) => n.matches(selector));
  if (matchingNodes.length === 0) return;

  matchingNodes.forEach((n) => {
    const outerRect = n.querySelector(':scope > rect');
    if (outerRect) {
      outerRect.setAttribute('width', String(targetW));
      outerRect.setAttribute('x', String(-(targetW / 2)));
    }
    const fo = n.querySelector(':scope > g.label > foreignObject');
    if (fo) {
      fo.setAttribute('width', String(innerW));
      const parentLabel = fo.parentElement;
      if (parentLabel) {
        const t = parentLabel.getAttribute('transform') || '';
        const m = /translate\(\s*-?\d+(?:\.\d+)?\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(t);
        if (m) {
          parentLabel.setAttribute('transform', `translate(${-(innerW / 2)}, ${m[1]})`);
        }
      }
      const inner = fo.querySelector(':scope > div');
      if (inner) {
        inner.style.setProperty('width', `${innerW}px`, 'important');
        inner.style.setProperty('max-width', `${innerW}px`, 'important');
      }
    }
  });

  // Expand the SVG viewBox and max-width to fit the widened boxes. Mermaid's
  // initial viewBox is sized to the natural layout; without this the boxes
  // overflow horizontally and get clipped.
  const padding = 24;
  const svgWidth = targetW + padding * 2;
  const oldViewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  if (oldViewBox.length === 4) {
    const [, , , oldH] = oldViewBox;
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${oldH}`);
  }
  const curStyle = svg.getAttribute('style') || '';
  const nextStyle = curStyle.replace(/max-width:\s*[^;]+;?\s*/i, '') + ` max-width: ${svgWidth}px;`;
  svg.setAttribute('style', nextStyle.trim());

  // Re-centre each affected node horizontally within the expanded viewBox.
  // Preserve the original Y. For multi-node diagrams (worked-resolution stack),
  // every matched node sits on the same X axis — centred — so they line up.
  matchingNodes.forEach((n) => {
    const t = n.getAttribute('transform') || '';
    const m = /translate\(\s*-?\d+(?:\.\d+)?\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(t);
    if (m) {
      n.setAttribute('transform', `translate(${svgWidth / 2}, ${m[1]})`);
    }
  });

  // After widening, the inner label re-wraps to fewer lines than what Mermaid
  // originally measured for. Resize each rect (and foreignObject) to the actual
  // content height so the boxes don't carry dead whitespace at the bottom.
  // Has to run after layout — schedule via rAF then re-flow.
  requestAnimationFrame(() => {
    let yCursor = null;
    matchingNodes.forEach((n) => {
      const r  = n.querySelector(':scope > rect');
      const fo = n.querySelector(':scope > g.label > foreignObject');
      const div = fo?.querySelector(':scope > div');
      if (!r || !fo || !div) return;

      const contentH = Math.ceil(div.getBoundingClientRect().height);
      if (contentH <= 0) return;

      const padY = 12;                              // vertical breathing room
      const newRectH = contentH + padY * 2;
      const newFoH   = contentH;

      r.setAttribute('height', String(newRectH));
      r.setAttribute('y',      String(-(newRectH / 2)));
      fo.setAttribute('height', String(newFoH));

      // Re-centre the foreignObject vertically inside the new rect.
      const parentLabel = fo.parentElement;
      if (parentLabel) {
        parentLabel.setAttribute('transform', `translate(${-(innerW / 2)}, ${-(newFoH / 2)})`);
      }
    });

    // For multi-node stacks (worked-resolution), the original Mermaid layout
    // spaced nodes for the original (taller) rects. After shrinking, restack
    // the matched nodes vertically with a small gap so the dead inter-row
    // space disappears too.
    if (matchingNodes.length > 1) {
      const sorted = [...matchingNodes].sort((a, b) => {
        const yA = parseFloat((a.getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
        const yB = parseFloat((b.getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
        return yA - yB;
      });
      const gap = 18;
      let cursorY = parseFloat((sorted[0].getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
      sorted.forEach((n, idx) => {
        const r = n.querySelector(':scope > rect');
        const h = parseFloat(r?.getAttribute('height') || '0');
        if (idx === 0) {
          // anchor first node where Mermaid placed it
        } else {
          const prevR = sorted[idx - 1].querySelector(':scope > rect');
          const prevH = parseFloat(prevR?.getAttribute('height') || '0');
          cursorY += prevH / 2 + gap + h / 2;
          n.setAttribute('transform', `translate(${svgWidth / 2}, ${cursorY})`);
        }
      });
      // Tighten the SVG viewBox height to the stack height.
      const last = sorted[sorted.length - 1];
      const lastY = parseFloat((last.getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
      const lastH = parseFloat(last.querySelector(':scope > rect')?.getAttribute('height') || '0');
      const firstY = parseFloat((sorted[0].getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
      const firstH = parseFloat(sorted[0].querySelector(':scope > rect')?.getAttribute('height') || '0');
      const totalH = (lastY + lastH / 2) - (firstY - firstH / 2) + 32;
      const startY = (firstY - firstH / 2) - 16;
      svg.setAttribute('viewBox', `0 ${startY} ${svgWidth} ${totalH}`);
    } else {
      // Single-node diagrams: shrink viewBox height to fit the new rect.
      const only = matchingNodes[0];
      const r = only.querySelector(':scope > rect');
      const h = parseFloat(r?.getAttribute('height') || '0');
      const y = parseFloat((only.getAttribute('transform') || '').match(/translate\([^,]+,\s*(-?\d+(?:\.\d+)?)\)/)?.[1] || '0');
      const totalH = h + 32;
      const startY = (y - h / 2) - 16;
      svg.setAttribute('viewBox', `0 ${startY} ${svgWidth} ${totalH}`);
    }
  });
}

// Computes the unified target width from the worked-resolution diagram (max
// natural rect width + 24px breathing room) and applies it to:
//   - the 3 rulebook boxes themselves (so they line up), and
//   - the single-node Hierarchical-fallback and Fail-loud diagrams (so they
//     match the rulebook box width).
function equaliseProposalWidths(root) {
  const containers = [...root.querySelectorAll('.docusaurus-mermaid-container')];
  let targetW = 0;

  // Pass 1: find the worked-resolution natural max width.
  containers.forEach((c) => {
    const svg = c.querySelector('svg');
    if (!svg) return;
    if (classifyProposalSvg(svg) !== 'worked-resolution') return;
    [...svg.querySelectorAll('g.node')]
      .filter((n) => n.matches('.bpProp1, .bpProp3, .bpProp6'))
      .forEach((n) => {
        const r = n.querySelector(':scope > rect');
        if (r) targetW = Math.max(targetW, parseFloat(r.getAttribute('width') || '0'));
      });
  });
  if (targetW === 0) return;
  // Generous padding so the longest <br/>-separated line in each label fits on
  // a single display line (no mid-line wrap). 60px = ~8 monospace chars at 13px.
  targetW = Math.max(Math.round(targetW + 60), 460);

  // Pass 2: apply target width to worked-resolution + fallback + fail.
  containers.forEach((c) => {
    const svg = c.querySelector('svg');
    if (!svg) return;
    const kind = classifyProposalSvg(svg);
    if (kind === 'worked-resolution') {
      resizeNodeRects(svg, targetW, '.bpProp1, .bpProp3, .bpProp6');
    } else if (kind === 'fallback') {
      resizeNodeRects(svg, targetW, '.bpProp3');
    } else if (kind === 'fail') {
      resizeNodeRects(svg, targetW, '.bpProp7');
    }
  });
}

function applyToSvg(svg) {
  if (svg.dataset.bpPropGradients === 'done') return;
  if (!hasProposalNodes(svg)) return;
  const suffix = svg.id || Math.random().toString(36).slice(2, 8);
  svg.dataset.bpPropSuffix = suffix;
  const defs = ensureDefs(svg);
  PALETTE.forEach(({ cls, light, dark }) => {
    appendGradient(defs, gradientId(suffix, cls, 'light'), light);
    appendGradient(defs, gradientId(suffix, cls, 'dark'),  dark);
  });
  paintSvg(svg);
  svg.dataset.bpPropGradients = 'done';

  if (!document.documentElement.__bpPropSvgs) {
    document.documentElement.__bpPropSvgs = new Set();
  }
  document.documentElement.__bpPropSvgs.add(svg);

  if (!document.documentElement.__bpPropApply) {
    document.documentElement.__bpPropApply = function () {
      document.documentElement.__bpPropSvgs.forEach((s) => paintSvg(s));
    };
  }
}

function processAll(root) {
  root.querySelectorAll('.docusaurus-mermaid-container svg').forEach(applyToSvg);
  // Once gradients are wired on every SVG, run a single equalisation pass so
  // worked-resolution + fallback + fail-loud all line up at the same width.
  equaliseProposalWidths(root);
}

if (typeof window !== 'undefined') {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try { processAll(document); } catch (e) {}
    });
  };

  const observer = new MutationObserver(schedule);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    });
  }
  schedule();

  // Refresh fills + text colours when Docusaurus toggles the theme attribute.
  const themeObserver = new MutationObserver(() => {
    const fn = document.documentElement.__bpPropApply;
    if (typeof fn === 'function') fn();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export function onRouteDidUpdate() {
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      try { processAll(document); } catch (e) {}
    });
  }
}
