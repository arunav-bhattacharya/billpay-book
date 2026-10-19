import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * RowLifecycle: the life of one Work Tracker row.
 *
 * The happy path runs along the top, from the producer's commit to the
 * workflow's last commit. The two ways a row stops early drop below it:
 * cancelled while it still waits, or failed, either because the Router
 * refused it or because the workflow's retries ran out. States keep the
 * lifecycle tones the payment state diagrams use, so a finished row reads
 * green and a stopped one red.
 *
 * Coordinates are hand-placed on a 700 x 226 canvas. Takes no props.
 */

const W = 700;
const H = 226;
const BOX_W = 110;
const BOX_H = 40;
const ROW = 64; // the happy path
const OUT = 172; // where a row stops early

const STATES = [
  {id: 'SCHEDULED', x: 10, y: ROW, tone: 'mid'},
  {id: 'DISPATCHING', x: 200, y: ROW, tone: 'mid'},
  {id: 'DISPATCHED', x: 390, y: ROW, tone: 'mid'},
  {id: 'DONE', x: 580, y: ROW, tone: 'ok'},
  {id: 'CANCELLED', x: 10, y: OUT, tone: 'stop'},
  {id: 'FAILED', x: 390, y: OUT, tone: 'stop'},
];

const LABEL =
  'The life of one Work Tracker row. The producer writes it as SCHEDULED, in the same commit as the payment. A dispatcher\'s claim moves it to DISPATCHING, a successful start to DISPATCHED, and the workflow\'s last commit to DONE. A row stops early in two ways: CANCELLED from SCHEDULED when the payment is cancelled, and FAILED from DISPATCHING when the Router refuses it, or from DISPATCHED when the workflow\'s retries run out.';

function State({s}) {
  const block = `M${s.x + 8},${s.y} A8,8 0 0 0 ${s.x},${s.y + 8} V${s.y + BOX_H - 8} A8,8 0 0 0 ${s.x + 8},${s.y + BOX_H} Z`;
  return (
    <g className={styles[`t_${s.tone}`]}>
      <rect x={s.x} y={s.y} width={BOX_W} height={BOX_H} rx={8} className={styles.body} />
      <path d={block} className={styles.block} />
      <text x={s.x + 20} y={s.y + 24.5} className={styles.name}>
        {s.id}
      </text>
    </g>
  );
}

export default function RowLifecycle() {
  const mid = ROW + BOX_H / 2;
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="rl-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.head} />
            </marker>
          </defs>

          {/* the producer writes the row */}
          <rect x={60} y={12} width={10} height={10} rx={2} className={styles.start} />
          <path d={`M65,22 V${ROW}`} className={styles.line} markerEnd="url(#rl-head)" />
          <text x={77} y={46} className={styles.label}>
            written by the producer
          </text>

          {/* the happy path */}
          <path d={`M120,${mid} H200`} className={styles.line} markerEnd="url(#rl-head)" />
          <text x={160} y={mid - 8} textAnchor="middle" className={styles.label}>
            claimed
          </text>
          <path d={`M310,${mid} H390`} className={styles.line} markerEnd="url(#rl-head)" />
          <text x={350} y={mid - 21} textAnchor="middle" className={styles.label}>
            <tspan x={350}>workflow</tspan>
            <tspan x={350} dy={13}>
              started
            </tspan>
          </text>
          <path d={`M500,${mid} H580`} className={styles.line} markerEnd="url(#rl-head)" />
          <text x={540} y={mid - 8} textAnchor="middle" className={styles.label}>
            last commit
          </text>

          {/* the two ways out */}
          <path d={`M65,${ROW + BOX_H} V${OUT}`} className={clsx(styles.line, styles.lineStop)} markerEnd="url(#rl-head)" />
          <text x={77} y={143} className={styles.label}>
            the payment is cancelled
          </text>
          <path
            d={`M255,${ROW + BOX_H} V${OUT + 14} Q255,${OUT + 20} 261,${OUT + 20} H390`}
            className={clsx(styles.line, styles.lineStop)}
            markerEnd="url(#rl-head)"
          />
          <text x={322} y={OUT + 12} textAnchor="middle" className={styles.label}>
            Router refused it
          </text>
          <path d={`M445,${ROW + BOX_H} V${OUT}`} className={clsx(styles.line, styles.lineStop)} markerEnd="url(#rl-head)" />
          <text x={457} y={143} className={styles.label}>
            retries ran out
          </text>

          {STATES.map((s) => (
            <State key={s.id} s={s} />
          ))}
        </svg>
      </div>
    </figure>
  );
}
