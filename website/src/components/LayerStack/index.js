import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LayerStack — a vertical, layered architecture map.
 * Each layer is a distinct band with its own accent (gradient badge + tinted
 * chips), separated by dotted flow connectors. A layer with `loop: true`
 * renders as a dashed "loops back" band for async edges.
 *
 * layers: [{ n, title, role, items: (string | {label, code})[], accent, loop? }]
 */
export default function LayerStack({layers = []}) {
  return (
    <div className={styles.map}>
      {layers.map((L, i) => (
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
            style={{'--ly-accent': L.accent}}>
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
      ))}
    </div>
  );
}
