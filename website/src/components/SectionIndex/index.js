import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';
import ordinal from '../../lib/ordinal';

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
 * the whole section can be scanned in a single pass, and descriptions sit
 * beside them. Each row sits on a soft tint with a little air between rows,
 * which separates them without a ruled line.
 *
 * The numbers are badges, the same as the sidebar's and the homepage board's:
 * the sidebar counts the sections 01 to 08, so a section counting its own
 * pages is the same habit one level down. A badge is a quiet tint until the
 * cursor is on the row, when it turns Bright Blue; that is the only way a
 * number should ever compete with a page title.
 *
 * There is no accent prop. Every section index carries the same Amex blue,
 * whichever section it is in: the colour here marks the row under the cursor,
 * and a marker that changes hue from one section to the next has to be learned
 * again on each page. The section hues still do their work elsewhere.
 *
 * `items` are `{term, to, desc}`, matching Highlights, so a page can move
 * between the two without its content being rewritten.
 */
export default function SectionIndex({items = []}) {
  return (
    <div className={styles.index}>
      {items.map((it, i) => (
        <Link key={i} to={it.to} className={styles.row}>
          <span className={styles.num} aria-hidden="true">
            {ordinal(i + 1)}
          </span>
          <span className={styles.term}>
            <span className={styles.termText}>{it.term}</span>
            <span className={styles.cue} aria-hidden="true">→</span>
          </span>
          {it.desc && <span className={styles.desc}>{it.desc}</span>}
        </Link>
      ))}
    </div>
  );
}
