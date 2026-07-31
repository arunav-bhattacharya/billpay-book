import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * Highlights: a responsive grid of key-message cards.
 * Each item leads with a prominent `term` (the message) and a quieter `desc`.
 * Give an item a `to` and the whole card becomes a link to that page.
 * `accent` is any CSS color/expression (defaults to the Vision section hue).
 * `variant="solid"` swaps the neutral card for a signature-blue gradient card.
 */
export default function Highlights({items = [], accent = 'var(--amex-cat-vision)', variant}) {
  const itemClass = variant === 'solid' ? `${styles.item} ${styles.itemSolid}` : styles.item;
  return (
    <div className={styles.grid} style={{'--hl-accent': accent}}>
      {items.map((it, i) => {
        const body = (
          <>
            <div className={styles.term}>
              {it.term}
              {it.to && <span className={styles.cue} aria-hidden="true">→</span>}
            </div>
            <div className={styles.desc}>{it.desc}</div>
          </>
        );
        return it.to ? (
          <Link key={i} to={it.to} className={`${itemClass} ${styles.itemLink}`}>
            {body}
          </Link>
        ) : (
          <div key={i} className={itemClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
