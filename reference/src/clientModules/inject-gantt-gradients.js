// Mermaid gantt bars are SVG <rect> elements with a single solid fill. To
// give the timeline a softer, more on-brand look we inject SVG <linearGradient>
// defs into each gantt SVG and rewire every bar's `fill` to point at the right
// gradient via inline style (which beats the solid-colour CSS fallback).
//
// IDs are made unique per SVG so multiple gantts on a page don't collide.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Each entry: [bar-class, light-mode-stops, dark-mode-stops].
// Stops go from softer-saturated (left) to deeper-saturated (right) — same
// hue, two shades — so white task text stays readable across the whole bar.
// With `numberSectionStyles: 5` set in docusaurus.config.js mermaid options,
// the 5 sections get classes 0..4 (no wrap-around), so the Data Purger row
// is `task4`.
const SECTIONS = [
  { cls: 'active0', light: ['#818CF8', '#4F46E5'], dark: ['#C7D2FE', '#818CF8'] }, // indigo
  { cls: 'task1',   light: ['#A78BFA', '#7C3AED'], dark: ['#DDD6FE', '#A78BFA'] }, // violet
  { cls: 'done2',   light: ['#22D3EE', '#0E7490'], dark: ['#A5F3FC', '#22D3EE'] }, // cyan
  { cls: 'crit3',   light: ['#F59E0B', '#B45309'], dark: ['#FCD34D', '#F59E0B'] }, // amber
  { cls: 'task4',   light: ['#34D399', '#059669'], dark: ['#A7F3D0', '#34D399'] }, // mint
];

function gradientId(suffix, cls, theme) {
  return `bp-gantt-grad-${cls}-${theme}-${suffix}`;
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
  if (defs.querySelector(`#${id}`)) return;
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', id);
  grad.setAttribute('x1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('y2', '0%');
  stops.forEach((color, i) => {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', i === 0 ? '0%' : '100%');
    stop.setAttribute('stop-color', color);
    grad.appendChild(stop);
  });
  defs.appendChild(grad);
}

function isGanttSvg(svg) {
  // Mermaid v11 renders gantt charts inside <svg> elements with the class
  // `gantt` or with a child `<g class="gantt"...>`. The svg ancestor that
  // Docusaurus uses is `.docusaurus-mermaid-container`.
  if (svg.classList && svg.classList.contains('gantt')) return true;
  return !!svg.querySelector('g.section0, g.section1, .section0, .gantt');
}

function ensureWrapperClass(svg) {
  // Promote the mermaid container to wear `.bp-gantt-wrapper` so the
  // page's gantt-specific CSS rules keep matching. We do this here because
  // a JSX wrapper in MDX swallowed the code block at build time.
  const container = svg.closest('.docusaurus-mermaid-container');
  if (container && !container.classList.contains('bp-gantt-wrapper')) {
    container.classList.add('bp-gantt-wrapper');
  }
}

// Text-fill palette per theme. Inline !important via setProperty is the only
// reliable way to beat mermaid's per-SVG injected `<style>` block, which uses
// `#mermaid-svg-XXX .activeText0 { fill:#333 !important }` selectors with
// higher specificity than any external CSS we can write.
const TEXT_PALETTE = {
  light: {
    inside: '#FFFFFF',      // labels rendered over the saturated gradient bars
    outside: '#0F0F1A',     // labels rendered in the chart-area whitespace
    section: '#0F0F1A',     // left-column section names
    title: '#0F0F1A',       // chart title
    tick: '#6B6E78',        // x-axis time labels
  },
  dark: {
    inside: '#0F0F1A',      // gradient bars are pastel-light in dark mode
    outside: '#E5EEF9',     // labels in dark chart whitespace
    section: '#E5EEF9',
    title: '#F1F5F9',
    tick: '#8D909C',
  },
};

function paintText(svg, theme) {
  const p = TEXT_PALETTE[theme];
  // Outside-bar labels (left or right of the bar) — readable on chart whitespace.
  svg.querySelectorAll('text.taskTextOutsideRight, text.taskTextOutsideLeft, text[class*="taskTextOutside"]').forEach((t) => {
    t.style.setProperty('fill', p.outside, 'important');
  });
  // Inside-bar labels — readable on the gradient. `taskText*`, `activeText*`,
  // `doneText*`, `critText*` all classify an inside-bar label.
  svg.querySelectorAll('text.taskText, text[class*="activeText"], text[class*="doneText"], text[class*="critText"]').forEach((t) => {
    // Skip if it's actually classified as outside (these classes co-exist on outside labels too).
    if (/taskTextOutside/.test(t.getAttribute('class') || '')) return;
    t.style.setProperty('fill', p.inside, 'important');
  });
  // Left-column section labels
  svg.querySelectorAll('text.sectionTitle, text[class*="sectionTitle"]').forEach((t) => {
    t.style.setProperty('fill', p.section, 'important');
  });
  // Chart title
  svg.querySelectorAll('text.titleText').forEach((t) => {
    t.style.setProperty('fill', p.title, 'important');
  });
  // X-axis tick labels
  svg.querySelectorAll('g.grid g.tick text, g.tick text').forEach((t) => {
    t.style.setProperty('fill', p.tick, 'important');
  });
}

function applyToSvg(svg) {
  if (svg.dataset.bpGanttGradients === 'done') return;
  if (!isGanttSvg(svg)) return;
  ensureWrapperClass(svg);
  const suffix = svg.id || Math.random().toString(36).slice(2, 8);
  const defs = ensureDefs(svg);
  SECTIONS.forEach(({ cls, light, dark }) => {
    appendGradient(defs, gradientId(suffix, cls, 'light'), light);
    appendGradient(defs, gradientId(suffix, cls, 'dark'), dark);
  });
  // Wire each matching rect to the correct gradient AND paint all text fills
  // for the current theme. Use setProperty(..., 'important') so inline styles
  // beat both our custom.css and mermaid's per-SVG injected <style> block.
  const apply = () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    SECTIONS.forEach(({ cls }) => {
      svg.querySelectorAll(`rect.${cls}`).forEach((rect) => {
        rect.style.setProperty('fill', `url(#${gradientId(suffix, cls, theme)})`, 'important');
        rect.style.setProperty('stroke', 'none', 'important');
      });
    });
    paintText(svg, theme);
  };
  apply();
  svg.dataset.bpGanttGradients = 'done';
  svg.dataset.bpGanttSuffix = suffix;
  // Track this svg so theme-change handler can refresh fills
  if (!document.documentElement.__bpGanttSvgs) {
    document.documentElement.__bpGanttSvgs = new Set();
  }
  document.documentElement.__bpGanttSvgs.add(svg);
  if (!document.documentElement.__bpGanttApply) {
    document.documentElement.__bpGanttApply = function () {
      var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      document.documentElement.__bpGanttSvgs.forEach(function (s) {
        var suf = s.id || s.dataset.bpGanttSuffix || '';
        SECTIONS.forEach(function (sec) {
          s.querySelectorAll('rect.' + sec.cls).forEach(function (rect) {
            rect.style.setProperty('fill', 'url(#' + gradientId(suf, sec.cls, theme) + ')', 'important');
            rect.style.setProperty('stroke', 'none', 'important');
          });
        });
        paintText(s, theme);
      });
    };
  }
}

function processAll(root) {
  // The wrapper class is added by us, so we can't bootstrap from it.
  // Start from every mermaid container's <svg> and let isGanttSvg gate.
  root.querySelectorAll('.docusaurus-mermaid-container svg').forEach(applyToSvg);
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

  // Refresh gradient bindings when Docusaurus toggles the theme attribute
  const themeObserver = new MutationObserver(() => {
    const fn = document.documentElement.__bpGanttApply;
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
