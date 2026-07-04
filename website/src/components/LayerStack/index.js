import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LayerStack — a vertical, layered architecture map.
 * The numbered layers share one hue whose depth ramps from lightest (top) to
 * deepest (bottom), set per layer via `--ly-depth` (0%–100%). A layer with
 * `loop: true` renders as a dashed "loops back" band in its own colour. The
 * per-layer `accent` still drives the number badge, chips, and left rail.
 *
 * layers: [{ n, title, role, items: (string | {label, code})[], accent, loop? }]
 */
export default function LayerStack({layers = []}) {
  const numberedTotal = layers.filter((L) => !L.loop).length;
  let ni = -1;
  return (
    <div className={styles.map}>
      {layers.map((L, i) => {
        let depth;
        if (!L.loop) {
          ni += 1;
          depth = numberedTotal > 1 ? (ni / (numberedTotal - 1)) * 100 : 0;
        }
        const style = {'--ly-accent': L.accent};
        if (depth != null) style['--ly-depth'] = `${depth}%`;
        return (
          <React.Fragment key={i}>
            {i > 0 &&
              (L.loop ? (
                <div className={styles.loopConnector}>
                  <span>async events &amp; schedules loop back to Workflows</span>
                </div>
              ) : (
                <div className={styles.connector} aria-hidden="true" />
              ))}
            <div
              className={clsx(styles.layer, L.loop && styles.layerLoop)}
              style={style}>
              <div className={styles.badge}>{L.loop ? '↺' : L.n}</div>
              <div className={styles.body}>
                <div className={styles.title}>{L.title}</div>
                {L.role && <div className={styles.role}>{L.role}</div>}
                <div className={styles.items}>
                  {L.items.map((it, j) => {
                    const label = typeof it === 'string' ? it : it.label;
                    const code = typeof it === 'object' && it.code;
                    return (
                      <span key={j} className={clsx(styles.chip, code && styles.code)}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
