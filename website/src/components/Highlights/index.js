import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * Highlights: a responsive grid of key-message cards.
 * Each item leads with a prominent `term` (the message) and a quieter `desc`.
 * Give an item a `to` and the whole card becomes a link to that page.
 * Give it `links` instead, as `{to, label}`, and the card holds a list of
 * them: one card per group, one line per destination.
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
            {it.desc && <div className={styles.desc}>{it.desc}</div>}
            {it.links && (
              <ul className={styles.links}>
                {it.links.map((l, j) => (
                  <li key={j}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        );
        const cardClass = it.links ? `${itemClass} ${styles.itemLinks}` : itemClass;
        return it.to ? (
          <Link key={i} to={it.to} className={`${cardClass} ${styles.itemLink}`}>
            {body}
          </Link>
        ) : (
          <div key={i} className={cardClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
