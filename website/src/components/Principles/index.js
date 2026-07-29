import React from 'react';
import styles from './styles.module.css';

/**
 * Principles — numbered rules, one card each.
 *
 * The numeral is set large and low-contrast behind the text, so the cards read
 * as an ordered set without a list marker competing with the rule itself.
 *
 * items: [{title, body}]
 */
export default function Principles({items = [], accent = 'var(--amex-cat-vision)'}) {
  return (
    <ol className={styles.grid} style={{'--pr-accent': accent}}>
      {items.map((p, i) => (
        <li key={p.title} className={styles.card}>
          <span className={styles.numeral} aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className={styles.title}>{p.title}</div>
          <div className={styles.body}>{p.body}</div>
        </li>
      ))}
    </ol>
  );
}
