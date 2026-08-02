import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * SectionIndex: the way into a section.
 *
 * A section landing page has one job, which is to hand the reader off to the
 * right page inside it. A grid of cards asks the eye to travel left to right
 * and back again on every row, and it sets each page in its own box, which
 * says the pages are separate things. They are not: they are the contents of
 * one section, and they are in reading order.
 *
 * So this is a contents block, not a card grid. Titles run down one column so
 * the whole section can be scanned in a single pass, descriptions sit beside
 * them, and hairlines do the separating that the boxes used to do.
 *
 * The rail that appears down the left of a row on hover is the same 3px accent
 * bar the sidebar puts against the page you are on. There it means you are
 * here. Here it means you are going here.
 *
 * Props match Highlights (`items` of `{term, to, desc}`, plus `accent`), so a
 * page can move between the two without its content being rewritten.
 */
export default function SectionIndex({items = [], accent = 'var(--amex-cat-vision)'}) {
  return (
    <div className={styles.index} style={{'--sx-accent': accent}}>
      {items.map((it, i) => (
        <Link key={i} to={it.to} className={styles.row}>
          <span className={styles.rail} aria-hidden="true" />
          <span className={styles.term}>
            {it.term}
            <span className={styles.cue} aria-hidden="true">→</span>
          </span>
          {it.desc && <span className={styles.desc}>{it.desc}</span>}
        </Link>
      ))}
    </div>
  );
}
