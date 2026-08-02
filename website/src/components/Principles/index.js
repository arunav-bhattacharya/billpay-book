import React from 'react';
import styles from './styles.module.css';

/**
 * Principles: numbered rules, one row each.
 *
 * A single-column table: no header, no columns, one rule per row. The numeral
 * leads the heading line, so the set reads in order without a list marker
 * competing with the rule itself.
 *
 * items: [{title, body}]
 */
export default function Principles({items = [], accent = 'var(--amex-cat-vision)'}) {
  return (
    <div className={styles.wrap} style={{'--pr-accent': accent}}>
      <ol className={styles.rows}>
        {items.map((p, i) => (
          <li key={p.title} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.numeral} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={styles.title}>{p.title}</span>
            </div>
            <div className={styles.body}>{p.body}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
