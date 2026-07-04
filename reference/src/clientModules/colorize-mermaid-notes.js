// Tag Mermaid sequence-diagram notes that describe a worker (Realtime Worker
// or Batch Worker) so CSS can paint them in a distinct color from regular
// notes (client responses, async section markers, etc.).
//
// Mermaid renders notes as <g><rect class="note"/><text class="noteText"/></g>.
// We can't filter by content from CSS, so this runs after Mermaid mounts and
// adds a `bp-worker-note` class to the matching rect + text.

const WORKER_PREFIXES = ['Realtime Worker', 'Batch Worker'];

function classifyNotes(root) {
  const texts = root.querySelectorAll('.docusaurus-mermaid-container svg text.noteText');
  texts.forEach((t) => {
    const content = (t.textContent || '').trim();
    const isWorker = WORKER_PREFIXES.some((p) => content.startsWith(p));
    const tspans = t.querySelectorAll('tspan');
    // Multi-line notes: the first tspan's text might be the prefix
    if (!isWorker && tspans.length) {
      const firstLine = (tspans[0].textContent || '').trim();
      const matched = WORKER_PREFIXES.some((p) => firstLine.startsWith(p));
      if (!matched) return;
    } else if (!isWorker) {
      return;
    }
    const g = t.closest('g');
    if (!g) return;
    const rect = g.querySelector('rect.note');
    if (rect) rect.classList.add('bp-worker-note');
    t.classList.add('bp-worker-note');
    tspans.forEach((s) => s.classList.add('bp-worker-note'));
  });
}

if (typeof window !== 'undefined') {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try { classifyNotes(document); } catch (e) {}
    });
  };

  const observer = new MutationObserver(schedule);
  if (document.body) {
    observer.observe(document.body, {childList: true, subtree: true});
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {childList: true, subtree: true});
      schedule();
    });
  }
  schedule();
}

export function onRouteDidUpdate() {
  // Re-classify after each route change (Docusaurus SPA navigation)
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      try { classifyNotes(document); } catch (e) {}
    });
  }
}
