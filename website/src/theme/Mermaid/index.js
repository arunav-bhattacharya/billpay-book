/**
 * Mermaid, wrapped with an expand control.
 *
 * The sequence diagrams are wide. The widest is around 3,900px, and fitting
 * that into an 800px column scales the type down to roughly a fifth of its
 * size, which is unreadable. Fitting is still the right default: a diagram
 * that spills out of the column, or scrolls sideways on the page, is worse to
 * read past than one that is small.
 *
 * So the diagram fits the column as before, and anything that had to shrink to
 * get there gets an Expand button. Expanding lifts it to a full-window layer
 * with two sizes: fitted to the window width, which is roughly twice the
 * column, and actual size, which is the only way to read the busiest ones.
 *
 * The wrapper never moves or re-renders the SVG. Expanding only adds a class,
 * so Mermaid renders each diagram exactly once.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import OriginalMermaid from '@theme-original/Mermaid';
import styles from './styles.module.css';

/**
 * Line icons, drawn on a 24 unit grid at a 2 unit stroke and inheriting the
 * button's colour. Every button carries a label and a tooltip, since the icon
 * is the only thing on it.
 */
function Icon({children, label}) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}>
      {children}
    </svg>
  );
}

const ICONS = {
  // Four corners pushing outwards.
  expand: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
      <path d="M11 8.5v5M8.5 11h5" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16 16" />
      <path d="M8.5 11h5" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

/** Watch the rendered SVG and report whether the column is shrinking it. */
function useIsScaledDown(ref) {
  const [scaledDown, setScaledDown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const svg = node.querySelector('svg');
      const natural = svg?.viewBox?.baseVal?.width;
      if (!natural) {
        return false;
      }
      // A pixel of slack, so a diagram that happens to land exactly on the
      // column width does not flicker a button in and out on resize.
      setScaledDown(svg.getBoundingClientRect().width < natural - 1);
      return true;
    };

    // Mermaid renders asynchronously, so the SVG is usually not in the DOM on
    // the first pass. Watch for it, then keep the answer current on resize.
    const observers = [];
    if (!measure()) {
      const mutations = new MutationObserver(measure);
      mutations.observe(node, {childList: true, subtree: true});
      observers.push(mutations);
    }
    const resizes = new ResizeObserver(measure);
    resizes.observe(node);
    observers.push(resizes);

    return () => observers.forEach((o) => o.disconnect());
  }, [ref]);

  return scaledDown;
}

export default function Mermaid(props) {
  const wrapRef = useRef(null);
  const closeRef = useRef(null);
  const scaledDown = useIsScaledDown(wrapRef);
  const [expanded, setExpanded] = useState(false);
  const [actualSize, setActualSize] = useState(false);

  const collapse = useCallback(() => {
    setExpanded(false);
    setActualSize(false);
  }, []);

  // While the layer is up it owns the window: Escape closes it, and the page
  // behind it stops scrolling so the wheel drives the diagram instead.
  useEffect(() => {
    if (!expanded) {
      return undefined;
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        collapse();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const {overflow} = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [expanded, collapse]);

  const className = clsx(
    styles.wrap,
    expanded && styles.expanded,
    expanded && actualSize && styles.actualSize,
  );

  return (
    <div
      ref={wrapRef}
      className={className}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Expanded diagram' : undefined}>
      {expanded && (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={actualSize}
            title={actualSize ? 'Fit to window' : 'Actual size'}
            onClick={() => setActualSize((v) => !v)}>
            <Icon label={actualSize ? 'Fit to window' : 'Actual size'}>
              {actualSize ? ICONS.zoomOut : ICONS.zoomIn}
            </Icon>
          </button>
          <button
            ref={closeRef}
            type="button"
            className={styles.toolButton}
            title="Close (Esc)"
            onClick={collapse}>
            <Icon label="Close">{ICONS.close}</Icon>
          </button>
        </div>
      )}

      <OriginalMermaid {...props} />

      {!expanded && scaledDown && (
        <button
          type="button"
          className={styles.expandButton}
          title="Expand diagram"
          onClick={() => setExpanded(true)}>
          <Icon label="Expand diagram">{ICONS.expand}</Icon>
        </button>
      )}
    </div>
  );
}
