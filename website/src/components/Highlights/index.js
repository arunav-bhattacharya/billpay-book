import React from 'react';
import styles from './styles.module.css';

/**
 * Highlights — a responsive grid of key-message cards.
 * Each item leads with a prominent `term` (the message) and a quieter `desc`.
 * `accent` is any CSS color/expression (defaults to the Vision section hue).
 * `variant="solid"` swaps the neutral card for a signature-blue gradient card.
 */
export default function Highlights({items = [], accent = 'var(--amex-cat-vision)', variant}) {
  const itemClass = variant === 'solid' ? `${styles.item} ${styles.itemSolid}` : styles.item;
  return (
    <div className={styles.grid} style={{'--hl-accent': accent}}>
      {items.map((it, i) => (
        <div key={i} className={itemClass}>
          <div className={styles.term}>{it.term}</div>
          <div className={styles.desc}>{it.desc}</div>
        </div>
      ))}
    </div>
  );
}
