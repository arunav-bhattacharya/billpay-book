/**
 * Keep an anchor link on target while Mermaid is still rendering.
 *
 * A full page load is fine: the browser re-resolves the fragment once layout
 * settles. Client-side navigation is not. Docusaurus scrolls to the anchor as
 * soon as the route mounts, and every Mermaid block above the target is still
 * an empty placeholder at that moment. Each one then renders into a tall SVG
 * and pushes the target further down, so a link from Journeys to sequence
 * diagram 7 lands somewhere around diagram 2.
 *
 * So: after a route update carrying a hash, re-align whenever the target
 * actually moves in the document, until the page stops growing.
 *
 * Two details worth keeping:
 *
 * Movement is measured in document space, not viewport space, so our own
 * scrolling never reads as movement. That also means a reader who scrolls away
 * is left alone, because their scrolling does not move the target either.
 * Real scroll input ends the whole thing anyway, since chasing an anchor
 * someone has abandoned is worse than missing it.
 *
 * Nothing here is driven by requestAnimationFrame. Browsers pause frames in a
 * hidden tab, which is exactly the case of a link opened in the background,
 * and that is the one case where the reader most needs to arrive in the right
 * place when they finally look at it.
 */

/* Re-align on these, in ms after the route update. The early ones catch the
   first diagrams, the late ones catch a slow page. */
const RETRIES = [0, 80, 200, 400, 800, 1400, 2200, 3200, 4200];

/* Scroll input from a person. Not 'scroll', which our own scrollIntoView
   fires. */
const USER_EVENTS = ['wheel', 'touchmove', 'keydown', 'mousedown'];

let cancel = null;

function chase(hash) {
  if (cancel) cancel();

  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    id = hash.slice(1);
  }
  if (!id) return;

  const timers = [];
  let observer = null;
  let lastTop = null;

  const stop = () => {
    timers.forEach(clearTimeout);
    if (observer) observer.disconnect();
    USER_EVENTS.forEach((e) => window.removeEventListener(e, stop));
    cancel = null;
  };

  const align = () => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (top === lastTop) return;
    lastTop = top;
    /* scrollIntoView honours the scroll-margin-top the theme puts on headings,
       which is what clears the sticky navbar. */
    el.scrollIntoView();
  };

  cancel = stop;
  USER_EVENTS.forEach((e) => window.addEventListener(e, stop, {passive: true}));
  RETRIES.forEach((ms) => timers.push(setTimeout(align, ms)));
  timers.push(setTimeout(stop, RETRIES[RETRIES.length - 1] + 100));

  /* The precise signal: the article changing height is a diagram finishing. */
  if (typeof ResizeObserver !== 'undefined') {
    const content = document.querySelector('article') || document.body;
    observer = new ResizeObserver(align);
    observer.observe(content);
  }
}

export function onRouteDidUpdate({location}) {
  if (location.hash) {
    chase(location.hash);
  } else if (cancel) {
    cancel();
  }
}
