import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import styles from './styles.module.css';

/**
 * Folding behavior for the doc sidebar: one toggle that opens or shuts every
 * section, and a rule that keeps only the section you are reading open when
 * you arrive from the navbar.
 *
 * Docusaurus keeps each category's open/shut state inside the category
 * component itself and exposes no way to reach it from outside, so both jobs
 * here go through the categories' own caret buttons. Clicking a caret is
 * exactly what a reader does by hand: the state stays where the theme wants
 * it, and nothing here has to track the theme's internals beyond two stable
 * class names.
 *
 * Opening everything runs in passes. A category nested under a shut one is not
 * in the DOM yet, so it only becomes reachable once its parent opens, and each
 * pass waits for React to render what the last pass revealed. Every caret is
 * clicked at most once per run: React may not have repainted by the time the
 * next pass starts, and a second click would shut what the first one opened.
 * For the same reason a run ends after two quiet passes rather than the first,
 * so a slow render is not mistaken for a finished tree. Passes are timers, not
 * animation frames, which do not fire while the tab is in the background.
 */

const MENU = '.theme-doc-sidebar-menu';
const CATEGORY = 'li.theme-doc-sidebar-item-category';
const SHUT = 'menu__list-item--collapsed';
const PASS_MS = 20;
const MAX_PASSES = 16;
const QUIET_PASSES = 2;

function categories() {
  const menu = document.querySelector(MENU);
  return menu ? Array.from(menu.querySelectorAll(CATEGORY)) : [];
}

function caretOf(li) {
  return li.querySelector(
    ':scope > .menu__list-item-collapsible > .menu__caret',
  );
}

/* The theme marks a category's own link active when the current page is the
   category or anything under it, which is how a section knows it holds the
   page being read. */
function holdsCurrentPage(li) {
  return Boolean(
    li.querySelector(
      ':scope > .menu__list-item-collapsible > a.menu__link--active',
    ),
  );
}

/* Depth by ancestry rather than the theme's level-N class, so this keeps
   working if the sidebar ever nests deeper than the named levels. */
function depthOf(li) {
  let depth = 0;
  for (let el = li.parentElement; el; el = el.parentElement) {
    if (el.matches(CATEGORY)) {
      depth += 1;
    }
  }
  return depth;
}

/* Which top-level section the reader is in, as its own page's href. Null on a
   page that sits outside every section, such as the introduction. */
function currentSectionKey() {
  const section = categories().find(
    (li) => depthOf(li) === 0 && holdsCurrentPage(li),
  );
  return (
    section
      ?.querySelector(':scope > .menu__list-item-collapsible > a.menu__link')
      ?.getAttribute('href') ?? null
  );
}

/* Deepest first, so a section that gets shut is already tidy inside. */
function shutAll(items) {
  items
    .filter((li) => !li.classList.contains(SHUT))
    .sort((a, b) => depthOf(b) - depthOf(a))
    .forEach((li) => caretOf(li)?.click());
}

export default function SidebarFolding() {
  const [anyShut, setAnyShut] = useState(true);
  const timers = useRef([]);
  const lastSection = useRef(undefined);
  const {pathname} = useLocation();

  const sync = useCallback(() => {
    setAnyShut(categories().some((li) => li.classList.contains(SHUT)));
  }, []);

  const defer = useCallback((fn) => {
    timers.current.push(setTimeout(fn, PASS_MS));
  }, []);

  /* Readers open and shut sections by hand as well, so the button reads the
     tree rather than remembering what it last did. */
  useEffect(() => {
    const menu = document.querySelector(MENU);
    if (!menu) {
      return undefined;
    }
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(menu, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [sync]);

  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  /* Moving to a different section shuts everything outside it, so following a
     navbar link leaves that one section open. The theme opens the section you
     arrive in; this clears away the one you left. Paging around inside a
     section changes nothing, so a reader who opened a second section to
     compare keeps it open until they actually leave. The wait lets the theme's
     own expansion settle first. */
  useEffect(() => {
    defer(() => {
      const key = currentSectionKey();
      if (key !== lastSection.current) {
        lastSection.current = key;
        shutAll(categories().filter((li) => !holdsCurrentPage(li)));
      }
      sync();
    });
  }, [pathname, defer, sync]);

  const foldAll = useCallback(() => {
    shutAll(categories());
    sync();
  }, [sync]);

  const unfoldAll = useCallback(() => {
    const clicked = new WeakSet();
    let pass = 0;
    let quiet = 0;

    const step = () => {
      const pending = categories().filter(
        (li) => li.classList.contains(SHUT) && !clicked.has(li),
      );
      pass += 1;
      quiet = pending.length === 0 ? quiet + 1 : 0;

      if (quiet >= QUIET_PASSES || pass >= MAX_PASSES) {
        sync();
        return;
      }

      pending.forEach((li) => {
        clicked.add(li);
        caretOf(li)?.click();
      });
      defer(step);
    };

    step();
  }, [defer, sync]);

  const label = anyShut ? 'Expand all sections' : 'Collapse all sections';

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx('rail-toggle', styles.foldAll)}
      onClick={anyShut ? unfoldAll : foldAll}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true">
        {anyShut ? (
          <>
            <polyline points="8 9 12 5 16 9" />
            <polyline points="8 15 12 19 16 15" />
          </>
        ) : (
          <>
            <polyline points="8 5 12 9 16 5" />
            <polyline points="8 19 12 15 16 19" />
          </>
        )}
      </svg>
    </button>
  );
}
