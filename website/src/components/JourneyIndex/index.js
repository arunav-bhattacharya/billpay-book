import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * JourneyIndex: the way into the Journeys page.
 *
 * One card per group, because journeys are found by what the reader wants to
 * do: make a payment, change one, look one up. Cutting across that is who set
 * the journey off, a customer or something inside the estate. Corporate
 * payments holds both, which is why the marker sits on the journey rather than
 * on the card.
 *
 * The two colours are not new. The diagrams further down the page already draw
 * a waiting customer in Amex blue, and draw schedules and event handlers in
 * orange. The index teaches the code once and the diagrams keep it. A filled
 * dot is someone waiting for an answer. A ring is nobody.
 */

export const KINDS = {
  customer: {label: 'Customer initiated'},
  system: {label: 'System initiated'},
};

function Dot({kind}) {
  return <span className={styles.dot} data-kind={kind} aria-hidden="true" />;
}

export function Legend() {
  return (
    <p className={styles.legend}>
      {['customer', 'system'].map((k) => (
        <span className={styles.legendItem} key={k}>
          <Dot kind={k} />
          {KINDS[k].label}
        </span>
      ))}
    </p>
  );
}

export default function JourneyIndex({groups = [], accent = 'var(--amex-cat-design)'}) {
  return (
    <div className={styles.wrap} style={{'--ji-sec': accent}}>
      <div className={styles.cards}>
        {groups.map((g) => (
          <div className={styles.card} key={g.label}>
            <p className={styles.cardTerm}>{g.label}</p>
            <ul className={styles.cardList}>
              {g.journeys.map((j) => (
                <li key={j.label}>
                  <Link to={j.to}>
                    <Dot kind={j.kind} />
                    {j.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}
