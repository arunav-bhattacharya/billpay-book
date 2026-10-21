import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * VerifyFlow: how Verify, Reverify and Represent decide, in four numbered
 * cards read left to right, in the same build as ProfileToStages.
 *
 * The checks ask their systems in parallel, their answers become one set of
 * facts with the rule settings and the time, the rules that apply run over
 * the facts, and the highest-priority failure decides. Outcomes take the
 * lifecycle tones the state diagrams use: success for a payment that moves
 * on, failure for a decline, intermediate for a rule that is skipped.
 *
 * Coordinates are hand-placed on a 700 x 262 canvas. Takes no props.
 */

const W = 700;
const H = 292;
const TOP = 10;
const CARD_H = 272;
const ROW0 = TOP + 86;

const CARDS = [
  {n: 1, x: 10, w: 176, title: 'Checks', sub: 'in parallel, one per system'},
  {n: 2, x: 204, w: 146, title: 'Facts', sub: 'read once, read-only'},
  {n: 3, x: 364, w: 162, title: 'Rules', sub: 'the ones that apply'},
  {n: 4, x: 544, w: 146, title: 'Decision', sub: 'the top failure decides'},
];

const CHECKS = [
  {name: 'InstrumentCheck', when: 'Payment Instruments, always'},
  {name: 'OptionsCheck', when: 'Payment Options, always'},
  {name: 'TokenCheck', when: 'with bank confirmation'},
  {name: 'MandateCheck', when: 'Plans, for a mandate'},
  {name: 'GBFundsCheck', when: 'GB, Pay with Bank Transfer'},
  {name: 'CardAuthorizationCheck', when: 'debit card, last, once rules pass'},
];

const FACTS = ['each system’s answer', 'the rule settings', 'the time, read once'];

const RULES = [
  {tone: 'mid', chip: 'SKIP', text: ['runsWhen false']},
  {tone: 'ok', chip: 'PASS', text: ['passes holds']},
  {tone: 'stop', chip: 'FAIL', text: ['passes fails']},
];

const LABEL =
  'How Verify, Reverify and Represent decide, in four steps. One, the checks that apply to the payment ask their systems in parallel: InstrumentCheck asks Payment Instruments and OptionsCheck asks Payment Options, always; TokenCheck runs with bank confirmation; MandateCheck asks Plans where the profile requires mandate authorization; and GBFundsCheck runs in GB for Pay with Bank Transfer. For a debit card, CardAuthorizationCheck runs last, once the other rules pass, because an approved authorization takes the money from the customer\'s account. Two, their answers become one read-only set of facts, VerificationFacts, together with the rule settings from the resolved profile and the time, read once. Three, the rules that apply run over the facts: a rule whose runsWhen is false is skipped, and the rest pass or fail. Four, the decision: with no failure the payment moves on, ACCEPTED or SCHEDULED; with a failure it is DECLINED with the code of the highest-priority failed rule, or DISALLOWED for a push payment. The stage then makes one guarded commit, which keeps the failed rules’ IDs.';

function Chip({x, y, value, tone, w = 40}) {
  return (
    <g className={styles[`t_${tone}`]}>
      <rect x={x} y={y - 12.5} width={w} height={18} rx={4} className={styles.chipBox} />
      <text x={x + w / 2} y={y + 0.5} textAnchor="middle" className={styles.chipText}>
        {value}
      </text>
    </g>
  );
}

export default function VerifyFlow() {
  const [c1, c2, c3, c4] = CARDS;
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="vf-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.head} />
            </marker>
          </defs>

          {CARDS.map((c, i) => (
            <g key={c.n}>
              <rect x={c.x} y={TOP} width={c.w} height={CARD_H} rx={10} className={styles.card} />
              <rect x={c.x + 14} y={TOP + 15} width={18} height={18} rx={4} className={styles.num} />
              <text x={c.x + 23} y={TOP + 28.2} textAnchor="middle" className={styles.numText}>
                {c.n}
              </text>
              <text x={c.x + 40} y={TOP + 29} className={styles.title}>
                {c.title}
              </text>
              <text x={c.x + 14} y={TOP + 54} className={styles.sub}>
                {c.sub}
              </text>
              {i > 0 && (
                <path
                  d={`M${CARDS[i - 1].x + CARDS[i - 1].w + 3},${TOP + 24} H${c.x - 3}`}
                  className={styles.step}
                  markerEnd="url(#vf-head)"
                />
              )}
            </g>
          ))}

          {/* 1: the checks that apply, each with the system it asks */}
          {CHECKS.map((k, i) => (
            <g key={k.name}>
              <text x={c1.x + 14} y={ROW0 + i * 30} className={styles.cls}>
                {k.name}
              </text>
              <text x={c1.x + 14} y={ROW0 + i * 30 + 13} className={styles.note}>
                {k.when}
              </text>
            </g>
          ))}

          {/* 2: one read-only set of facts */}
          <text x={c2.x + 14} y={ROW0} className={styles.cls}>
            VerificationFacts
          </text>
          {FACTS.map((f, i) => (
            <g key={f}>
              <rect x={c2.x + 14} y={ROW0 + 18 + i * 26} width={4} height={14} rx={1} className={styles.tick} />
              <text x={c2.x + 26} y={ROW0 + 29 + i * 26} className={styles.item}>
                {f}
              </text>
            </g>
          ))}

          {/* 3: each rule that applies is skipped, passes or fails */}
          {RULES.map((r, i) => (
            <g key={r.chip}>
              <Chip x={c3.x + 14} y={ROW0 + i * 36} value={r.chip} tone={r.tone} />
              {r.text.map((t, j) => (
                <text key={t} x={c3.x + 62} y={ROW0 + i * 36 + j * 13} className={styles.mono}>
                  {t}
                </text>
              ))}
            </g>
          ))}
          <text x={c3.x + 14} y={ROW0 + 118} className={styles.note}>
            <tspan x={c3.x + 14}>no calls, no clock, so a</tspan>
            <tspan x={c3.x + 14} dy={13}>
              replay decides the same
            </tspan>
          </text>

          {/* 4: the decision */}
          <Chip x={c4.x + 14} y={ROW0} value="no failure" tone="ok" w={76} />
          <text x={c4.x + 14} y={ROW0 + 22} className={styles.item}>
            moves on: ACCEPTED
          </text>
          <text x={c4.x + 14} y={ROW0 + 36} className={styles.item}>
            or SCHEDULED
          </text>
          <Chip x={c4.x + 14} y={ROW0 + 66} value="a failure" tone="stop" w={70} />
          <text x={c4.x + 14} y={ROW0 + 88} className={styles.item}>
            DECLINED, with the
          </text>
          <text x={c4.x + 14} y={ROW0 + 102} className={styles.item}>
            top rule&apos;s code
          </text>
          <text x={c4.x + 14} y={ROW0 + 118} className={styles.note}>
            DISALLOWED for a push
          </text>
          <text x={c4.x + 14} y={ROW0 + 130} className={styles.note}>
            payment
          </text>
          <text x={c4.x + 14} y={ROW0 + 150} className={clsx(styles.note, styles.commit)}>
            then one guarded commit
          </text>
        </svg>
      </div>
    </figure>
  );
}
