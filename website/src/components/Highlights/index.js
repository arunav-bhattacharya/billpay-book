import React from 'react';
import styles from './styles.module.css';

/**
 * Highlights — a responsive grid of key-message cards.
 * Each item leads with a prominent `term` (the message) and a quieter `desc`.
 * `accent` is any CSS color/expression (defaults to the Vision section hue).
 */
export default function Highlights({items = [], accent = 'var(--amex-cat-vision)'}) {
  return (
    <div className={styles.grid} style={{'--hl-accent': accent}}>
      {items.map((it, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.term}>{it.term}</div>
          <div className={styles.desc}>{it.desc}</div>
        </div>
      ))}
    </div>
  );
}
