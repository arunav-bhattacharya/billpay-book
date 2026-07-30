import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * WorkerSplit: the two Temporal workers side by side, split by whether anyone
 * is waiting for the answer, with the workflows each one carries.
 *
 * The strips below hold what does not belong to one side: workflows that run on
 * either worker, and the periodic work driven by Temporal Schedules.
 *
 * workers: [{name, tone: 'online' | 'offline', waiting, desc, items: string[]}]
 * strips:  [{label, text, items?: string[]}]
 */
export default function WorkerSplit({workers = [], strips = []}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.pair}>
        {workers.map((w) => (
          <section
            key={w.name}
            className={clsx(styles.card, w.tone === 'offline' ? styles.offline : styles.online)}>
            <header className={styles.head}>
              <span className={styles.name}>{w.name}</span>
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

      {strips.map((s) => (
        <div key={s.label} className={styles.strip}>
          <span className={styles.stripLabel}>{s.label}</span>
          <div className={styles.stripBody}>
            {s.text && <p className={styles.stripText}>{s.text}</p>}
            {s.items && (
              <div className={styles.items}>
                {s.items.map((it) => (
                  <span key={it} className={clsx(styles.item, styles.itemQuiet)}>
                    {it}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
