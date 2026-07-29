import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LayerStack — a vertical, layered architecture map.
 *
 * Blocks are gathered into groups, and the group owns the colour: every block
 * inside it shares one accent, and the card tint deepens slightly down the
 * group, so the eye reads tiers first and individual blocks second. Each block
 * is marked by a filled glyph tile rather than a number, since the dotted
 * connectors already carry the order.
 *
 * `aside` is the async return path. It sits outside the groups, after a wider
 * gap, behind a dashed connector.
 *
 * groups: [{label, accent, layers: [{title, role, icon, items}]}]
 * layers[].items: (string | {label, code})[]
 * aside: {title, role, accent, icon, items, connectorLabel}
 */

/* Line glyphs, drawn on a 20x20 box in currentColor so one set serves every
   accent and both themes. Each says what its block does with the payment: many
   ways in, one contract, a decision, a durable run, composed parts, and the
   world outside. */
const GLYPHS = {
  /* four channels fanning into a single path in */
  channels: (
    <>
      <path d="M1.6,3.4 H6.4 M1.6,7.6 H6.4 M1.6,12.4 H6.4 M1.6,16.6 H6.4" />
      <path d="M6.4,3.4 Q10.4,3.4 10.4,10 M6.4,7.6 Q9,7.6 9,10 M6.4,16.6 Q10.4,16.6 10.4,10 M6.4,12.4 Q9,12.4 9,10" />
      <path d="M9,10 H17.4" />
      <path d="M14.4,7 L17.4,10 L14.4,13" />
    </>
  ),
  /* lambda: the function you call, whatever runs behind it */
  gateway: (
    <>
      <path d="M4.4,3 H7.4 L15.8,17.2" />
      <path d="M11,10.2 L4.2,17.2" />
    </>
  ),
  /* one request in, a decision, three ways out */
  router: (
    <>
      <path d="M1.4,10 H6.2" />
      <path d="M10,6.2 L13.8,10 L10,13.8 L6.2,10 Z" />
      <path d="M13.8,10 H15.6 V3.4 H18.6 M13.8,10 H18.6 M13.8,10 H15.6 V16.6 H18.6" />
    </>
  ),
  /* The Temporal symbol, from temporal.io/brand. It is a filled mark rather
     than line art, so it opts out of the shared stroke and takes currentColor
     as its fill. The transform maps the artwork's 1200-unit box onto ours. */
  workflow: (
    <g transform="translate(-17.814,-17.886) scale(0.0476684)" fill="currentColor" stroke="none">
      <path d="M651.14,517.35C642.02,449.03,618.94,392,583.49,392s-58.53,57.03-67.65,125.35c-68.32,9.12-125.35,32.2-125.35,67.65s57.04,58.53,125.35,67.65c9.12,68.31,32.2,125.35,67.65,125.35s58.53-57.04,67.65-125.35c68.32-9.12,125.35-32.2,125.35-67.65S719.45,526.47,651.14,517.35z M513.61,632.75c-65.43-9.45-103.59-31.08-103.59-47.75s38.16-38.3,103.59-47.75c-1.44,15.75-2.19,31.83-2.19,47.75C511.42,600.92,512.17,617.01,513.61,632.75z M583.49,411.53c16.67,0,38.3,38.16,47.75,103.59c-15.74-1.44-31.83-2.19-47.75-2.19s-32.01,0.75-47.75,2.19C545.19,449.69,566.82,411.53,583.49,411.53z M653.37,632.75c-3.22,0.47-16.43,2.02-19.77,2.35c-0.33,3.35-1.89,16.55-2.35,19.77c-9.45,65.43-31.08,103.59-47.75,103.59s-38.3-38.16-47.75-103.59c-0.46-3.22-2.02-16.43-2.35-19.77c-1.52-15.51-2.44-32.17-2.44-50.1s0.92-34.59,2.44-50.11c15.51-1.52,32.17-2.44,50.1-2.44s34.59,0.92,50.1,2.44c3.35,0.33,16.55,1.89,19.77,2.35c65.43,9.45,103.6,31.09,103.6,47.75S718.8,623.3,653.37,632.75z" />
    </g>
  ),
  /* building blocks: parts stacked into a whole */
  components: (
    <>
      <rect x="6.2" y="2.2" width="7.6" height="7.6" rx="1.5" />
      <rect x="1.9" y="10.4" width="7.6" height="7.6" rx="1.5" />
      <rect x="10.5" y="10.4" width="7.6" height="7.6" rx="1.5" />
    </>
  ),
  /* where the money lands, and what leaves the estate with it */
  external: (
    <>
      <path d="M1.4,7.2 L7.8,2.8 L14.2,7.2" />
      <path d="M2.6,7.6 V16.2 H13 V7.6" />
      <path d="M5.4,16.2 V11 M7.8,16.2 V11 M10.2,16.2 V11" />
      <path d="M1.2,16.2 H14.4" />
      <path d="M15.2,3.8 H18.8 V7.4 M18.8,3.8 L14.6,8" />
    </>
  ),
  /* an outcome arriving late, and turning back into the flow */
  async: (
    <>
      <path d="M17,10 A7,7 0 1 1 14.4,4.6" />
      <path d="M17.8,1.6 L17.8,5.2 L14.2,5.2" />
      <circle cx="10" cy="10" r="2.2" />
      <path d="M10,4.8 V6.4 M10,13.6 V15.2 M4.8,10 H6.4 M13.6,10 H15.2" />
    </>
  ),
};

function Glyph({name}) {
  const g = GLYPHS[name];
  if (!g) return null;
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 20 20" className={styles.glyph}>
        {g}
      </svg>
    </span>
  );
}

function Chips({items = []}) {
  if (!items.length) return null;
  return (
    <div className={styles.items}>
      {items.map((it, j) => {
        const label = typeof it === 'string' ? it : it.label;
        const code = typeof it === 'object' && it !== null && it.code;
        return (
          <span key={j} className={clsx(styles.chip, code && styles.code)}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function Block({block, depth, aside}) {
  /* unitless 0–1, so the stylesheet can interpolate the tint with calc() */
  const style = {};
  if (depth != null) style['--ly-d'] = depth;
  return (
    <div className={clsx(styles.layer, aside && styles.layerAside)} style={style}>
      <Glyph name={block.icon} />
      <div className={styles.body}>
        <div className={styles.title}>{block.title}</div>
        {block.role && <div className={styles.role}>{block.role}</div>}
        <Chips items={block.items} />
      </div>
    </div>
  );
}

export default function LayerStack({groups = [], aside}) {
  return (
    <div className={styles.map}>
      {groups.map((g, gi) => {
        const layers = g.layers || [];
        return (
          <React.Fragment key={g.label || gi}>
            {gi > 0 && <div className={styles.divider} aria-hidden="true" />}
            <div
              className={styles.group}
              style={{'--ly-accent': g.accent}}
              role="group"
              aria-label={g.label}>
              <div className={styles.groupLabel} aria-hidden="true">
                <span>{g.label}</span>
              </div>
              <div className={styles.groupBody}>
                {layers.map((L, li) => (
                  <React.Fragment key={L.title || li}>
                    {li > 0 && <div className={styles.connector} aria-hidden="true" />}
                    <Block block={L} depth={layers.length > 1 ? li / (layers.length - 1) : 0} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {aside && (
        <>
          {/* the same rule that separates the groups, minus the ▾: the aside
              feeds work back up rather than continuing the flow down */}
          <div className={clsx(styles.divider, styles.dividerPlain)} aria-hidden="true" />
          <div className={styles.asideWrap} style={{'--ly-accent': aside.accent}}>
            {aside.connectorLabel && (
              <div className={styles.loopConnector}>
                <span>{aside.connectorLabel}</span>
              </div>
            )}
            <Block block={aside} aside />
          </div>
        </>
      )}
    </div>
  );
}
