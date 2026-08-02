import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * WorkerSplit: the two Temporal workers side by side, split by whether anyone
 * is waiting for the answer, with the workflows each one carries.
 *
 * Anything that belongs to neither side, such as the workflows that run on
 * either worker, goes in an admonition after the component rather than in here.
 * A third band inside the card grid read as a third worker.
 *
 * workers: [{term, tone: 'Online' | 'Offline', waiting, desc, items: string[]}]
 */
export default function WorkerSplit({workers = []}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.pair}>
        {workers.map((w) => (
          <section
            key={w.term}
            className={clsx(
              styles.card,
              String(w.tone).toLowerCase() === 'offline' ? styles.offline : styles.online,
            )}>
            <header className={styles.head}>
              <span className={styles.name}>{w.term}</span>
              <span className={styles.waiting}>{w.waiting}</span>
            </header>
            <p className={styles.desc}>{w.desc}</p>
            <div className={styles.items}>
              {(w.items || []).map((it) => (
                <span key={it} className={styles.item}>
                  {it}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
