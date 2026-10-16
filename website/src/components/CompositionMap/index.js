import React from 'react';
import styles from './styles.module.css';

/**
 * CompositionMap: the path from onboarding a market to a running workflow.
 * The first band is what onboarding asks for (the One-Data APIs, the behavior
 * questions and the operations settings). Each step after it is one band,
 * joined to the band above by the verb that turns one into the other.
 *
 * Deliberately quiet: filled bands, no outlines, Blue Box numbers, and
 * monospace only for the API names, which are literals.
 *
 * apis:      string[]
 * behaviors: [{name, ask, answers: string[]}]
 * settings:  string[]   (optional) the operations settings, as chips
 * onboard:   {title, note}   (optional) heading of the first band
 * steps:     [{via, title, note}]
 */
const ONBOARD = {
  title: 'Onboard the market in billpay-ui',
  note: 'Once per market and account type. A second person approves it.',
};

export default function CompositionMap({apis = [], behaviors = [], settings = [], onboard = ONBOARD, steps = []}) {
  return (
    <div className={styles.wrap}>
      {/* 1. what onboarding asks for */}
      <section className={styles.band}>
        <Head no={1} title={onboard.title} note={onboard.note} />

        <div className={styles.row}>
          <span className={styles.rowLabel}>One-Data APIs</span>
          <div className={styles.chips}>
            {apis.map((a) => (
              <code key={a} className={styles.api}>
                {a}
              </code>
            ))}
            {/* the list is a sample, not the full set */}
            <code className={styles.api} aria-label="and more">
              &hellip;
            </code>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>Behaviors</span>
          <ul className={styles.behaviors}>
            {behaviors.map((d) => (
              <li key={d.name} className={styles.behavior}>
                <span className={styles.ask}>{d.ask}</span>
                {/* One span per answer so the separator and the spacing are the
                    stylesheet's to set, and every answer column lines up. */}
                <span className={styles.answers}>
                  {(d.answers || []).map((a) => (
                    <span key={a} className={styles.answer}>
                      {a}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {settings.length > 0 && (
          <div className={styles.row}>
            <span className={styles.rowLabel}>Operations</span>
            <div className={styles.chips}>
              {settings.map((s) => (
                <span key={s} className={styles.setting}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {steps.map((s, i) => (
        <React.Fragment key={s.title}>
          <Arrow label={s.via} />
          <section className={styles.step}>
            <Head no={i + 2} title={s.title} note={s.note} />
          </section>
        </React.Fragment>
      ))}
    </div>
  );
}

function Head({no, title, note}) {
  return (
    <div className={styles.head}>
      <span className={styles.no} aria-hidden="true">
        {no}
      </span>
      <div>
        <div className={styles.title}>{title}</div>
        {note && <div className={styles.note}>{note}</div>}
      </div>
    </div>
  );
}

function Arrow({label}) {
  return (
    <div className={styles.link} aria-hidden="true">
      <span className={styles.linkStem} />
      <span className={styles.linkLabel}>{label}</span>
    </div>
  );
}
