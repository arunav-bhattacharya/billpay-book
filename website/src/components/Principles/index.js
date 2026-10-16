import React from 'react';
import styles from './styles.module.css';
import ordinal from '../../lib/ordinal';

/**
 * Principles: numbered rules, one row each.
 *
 * A single-column table: no header, no columns, one rule per row. A numbered
 * badge leads the heading line, so the set reads in order without a list
 * marker competing with the rule itself. Badges are the same blue on every
 * page, so there is no accent prop.
 *
 * items: [{term, desc}]
 */
export default function Principles({items = []}) {
  return (
    <div className={styles.wrap}>
      <ol className={styles.rows}>
        {items.map((p, i) => (
          <li key={p.term} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.numeral} aria-hidden="true">
                {ordinal(i + 1)}
              </span>
              <span className={styles.title}>{p.term}</span>
            </div>
            <div className={styles.body}>{p.desc}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
