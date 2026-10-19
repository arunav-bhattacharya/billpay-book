import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * ProfileToStages: how a market profile becomes the classes a payment runs,
 * in four steps, for one payment made today from a channel.
 *
 * The first two cards share their rows, so the eye reads straight across:
 * the profile's five behaviors on the left, the Router's resolved values
 * beside them. The one value that changes, realtime clearing from BOTH to Y,
 * is the one Bright Blue chip, joined to its source by a thin line. The plan
 * key pins what the Router worked out, and the stage index turns it into
 * each step's stage and the checks and methods it gets.
 *
 * Coordinates are hand-placed on a 700 x 246 canvas. Takes no props.
 */

const W = 700;
const H = 246;
const TOP = 10;
const CARD_H = 226;
const ROW0 = TOP + 88; // first shared row's baseline
const PITCH = 30;

const CARDS = [
  {n: 1, x: 10, w: 184, title: 'Profile', sub: 'market and account type'},
  {n: 2, x: 216, w: 100, title: 'Router', sub: 'for pay today'},
  {n: 3, x: 338, w: 124, title: 'Plan key', sub: 'pinned at start'},
  {n: 4, x: 484, w: 206, title: 'Stage index', sub: 'most specific class per job'},
];

const ROWS = [
  {label: 'Account type', profile: 'CONSUMER', resolved: 'CONSUMER'},
  {label: 'AR posting', profile: 'Y', resolved: 'Y'},
  {label: 'Realtime clearing', profile: 'BOTH', resolved: 'Y', changed: true},
  {label: 'Mandate authorization', profile: 'Y', resolved: 'Y'},
  {label: 'Bank confirmation', profile: 'N', resolved: 'N'},
];

const KEY = ['market', 'journey', 'behaviors', 'config version', 'rule settings'];

const STEPS = [
  {step: 'Verify', cls: 'DefaultPaymentVerifyStage', with: ['+ Instrument, Options and', 'Mandate checks']},
  {step: 'Execute', cls: 'DefaultPaymentExecuteStage', with: ['+ RealtimeClearing']},
  {step: 'Fulfil', cls: 'DefaultPaymentFulfilStage', with: []},
];

const LABEL =
  'From a market profile to the classes a payment runs, in four steps, for a payment made today from a channel. One, the profile, for a market and an account type, sets five behaviors: account type CONSUMER, AR posting Y, realtime clearing BOTH, mandate authorization Y and bank confirmation N. Two, the Router resolves those for the journey: BOTH becomes Y for pay today, and the rest stay as they are. Three, it pins the plan key: the market, the journey, the resolved behaviors, the config version and the rule settings from that version. Four, the stage index picks the most specific class for each job: DefaultPaymentVerifyStage with the Instrument, Options and Mandate checks, DefaultPaymentExecuteStage with RealtimeClearing, and DefaultPaymentFulfilStage.';

const chipWidth = (value) => (value.length > 1 ? value.length * 7 + 12 : 22);

/* A value chip. `x` is its right edge when `align` is end, else its centre. */
function Chip({x, y, value, tone, align}) {
  const w = chipWidth(value);
  const left = align === 'end' ? x - w : x - w / 2;
  return (
    <g className={clsx(styles.chip, styles[`c_${tone}`])}>
      <rect x={left} y={y - 12.5} width={w} height={18} rx={4} className={styles.chipBox} />
      <text x={left + w / 2} y={y + 0.5} textAnchor="middle" className={styles.chipText}>
        {value}
      </text>
    </g>
  );
}

export default function ProfileToStages() {
  const [c1, c2, c3, c4] = CARDS;
  const chipEnd = c1.x + c1.w - 14;
  const chip2 = c2.x + c2.w / 2;
  let y = ROW0 - 8; // card 4 runs on its own rhythm
  const steps = STEPS.map((s) => {
    const at = y;
    y += 30 + s.with.length * 14 + 6;
    return {...s, at};
  });
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="ps-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
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
                  markerEnd="url(#ps-head)"
                />
              )}
            </g>
          ))}

          {/* 1 and 2 share their rows: the profile's answer, then the resolved value */}
          {ROWS.map((r, i) => {
            const ry = ROW0 + i * PITCH;
            const w2 = chipWidth(r.resolved);
            return (
              <g key={r.label}>
                <text x={c1.x + 14} y={ry} className={styles.rowLabel}>
                  {r.label}
                </text>
                <Chip x={chipEnd} y={ry} value={r.profile} tone={r.profile === 'BOTH' ? 'open' : 'plain'} align="end" />
                {r.changed && <path d={`M${chipEnd + 3},${ry - 3.5} H${chip2 - w2 / 2 - 3}`} className={styles.lineage} />}
                <Chip x={chip2} y={ry} value={r.resolved} tone={r.changed ? 'set' : 'plain'} />
              </g>
            );
          })}

          {/* 3: the plan key's fields */}
          {KEY.map((k, i) => (
            <text key={k} x={c3.x + 14} y={ROW0 + i * PITCH} className={styles.keyText}>
              {k}
            </text>
          ))}

          {/* 4: each step's stage, and what it gets */}
          {steps.map((s) => (
            <g key={s.step}>
              <text x={c4.x + 14} y={s.at} className={styles.stepName}>
                {s.step}
              </text>
              <text x={c4.x + 14} y={s.at + 15} className={styles.cls}>
                {s.cls}
              </text>
              {s.with.map((line, i) => (
                <text key={line} x={c4.x + (i ? 23 : 14)} y={s.at + 30 + i * 14} className={styles.with}>
                  {line}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
