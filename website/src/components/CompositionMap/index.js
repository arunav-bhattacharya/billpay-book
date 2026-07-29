import React from 'react';
import styles from './styles.module.css';

/**
 * CompositionMap — the high-level path from onboarding a market to a running
 * workflow: the One-Data APIs and dimensions someone picks, the profile those
 * selections create, and the workflows that profile composes.
 *
 * Deliberately quiet: one accent for the whole map, and monospace only for the
 * API names, which are literals.
 *
 * apis: string[]
 * dims: [{name, ask, answers: string[]}]
 * run:  {title, note}
 */
export default function CompositionMap({apis = [], dims = [], run = {}, footnote}) {
  return (
    <div className={styles.wrap}>
      {/* 1 — what onboarding asks for */}
      <section className={styles.band}>
        <div className={styles.head}>
          <span className={styles.no} aria-hidden="true">
            1
          </span>
          <div>
            <div className={styles.title}>Onboard the market</div>
            <div className={styles.note}>Configuration, filled in once. No code changes.</div>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>One-Data APIs</span>
          <div className={styles.chips}>
            {apis.map((a) => (
              <code key={a} className={styles.api}>
                {a}
              </code>
            ))}
            {/* the list is a sample, not the full set */}
            <span className={styles.more} aria-label="and more">
              &hellip;
            </span>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Dimensions</span>
          <ul className={styles.dims}>
            {dims.map((d) => (
              <li key={d.name} className={styles.dim}>
                <span className={styles.ask}>{d.ask}</span>
                <span className={styles.answers}>{(d.answers || []).join('  /  ')}</span>
              </li>
            ))}
            <li className={styles.dim}>
              <span className={styles.more} aria-label="and more">
                &hellip;
              </span>
            </li>
          </ul>
        </div>
      </section>

      <Arrow label="creates" />

      {/* 2 — the profile */}
      <section className={styles.profile}>
        <div className={styles.head}>
          <span className={styles.no} aria-hidden="true">
            2
          </span>
          <div>
            <div className={styles.title}>The market's profile</div>
            <div className={styles.note}>
              Built from the selections above, for that market and account type.
            </div>
          </div>
        </div>
      </section>

      <Arrow label="composes" />

      {/* 3 — the composed workflows */}
      <section className={styles.band}>
        <div className={styles.head}>
          <span className={styles.no} aria-hidden="true">
            3
          </span>
          <div>
            <div className={styles.title}>{run.title}</div>
            {run.note && <div className={styles.note}>{run.note}</div>}
          </div>
        </div>
      </section>

      {footnote && <div className={styles.foot}>{footnote}</div>}
    </div>
  );
}

function Arrow({label}) {
  return (
    <div className={styles.link} aria-hidden="true">
      <span className={styles.linkLine} />
      <span className={styles.linkLabel}>{label}</span>
      <span className={styles.linkLine} />
    </div>
  );
}
