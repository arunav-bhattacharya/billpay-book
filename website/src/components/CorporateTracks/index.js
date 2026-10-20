import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * CorporateTracks: how a corporate payment gets from intake to PROCESSED.
 *
 * Pay today and scheduled payments enter on lanes of their own and join one
 * shared path at the allocation request. The middle lane is that path: each
 * box is a step with the state it commits and the Work Tracker row (or the
 * callback) that starts it, because no workflow waits and no workflow starts
 * the next step itself. The two outer lanes hold only what differs between
 * the kinds: the state Verify commits, and when the request and the
 * execution rows fall due. Those timings sit right above and below the box
 * they apply to, joined to it by a short dashed tick.
 *
 * Coordinates are hand-placed on a 980 x 306 canvas: six columns 140 wide
 * from x = 130, three lanes with 16-unit gaps. Every label is short enough to
 * sit inside its box at the sizes in the stylesheet. Takes no props.
 */

const W = 980;
const H = 306;

const COL_X0 = 130;
const COL_W = 140;
const cx = (c) => COL_X0 + COL_W / 2 + c * COL_W;

const LANES = [
  {id: 'today', term: 'Pay today', desc: 'asks at once', top: 14, h: 70, tone: 'today'},
  {id: 'path', term: 'Both kinds', desc: 'one path', top: 100, h: 110, tone: 'path'},
  {id: 'sched', term: 'Scheduled', desc: 'asks at the fetch time', top: 226, h: 70, tone: 'sched'},
];
const lane = (id) => LANES.find((l) => l.id === id);
const mid = (id) => lane(id).top + lane(id).h / 2;

const BOX_W = 124;
const ENTRY_H = 50;
const STEP_H = 76;

/* tone of the state line: f = in flight */
const ENTRIES = [
  {lane: 'today', title: 'Verify', state: 'ACCEPTED'},
  {lane: 'sched', title: 'Verify', state: 'SCHEDULED'},
];

const STEPS = [
  {col: 1, title: 'Request', state: 'ALLOCATING', note: 'ALLOC_REQUEST row'},
  {col: 2, title: 'Receive', state: 'ALLOCATED', note: 'each callback batch'},
  {col: 3, title: 'Execute', state: 'PROCESSING', note: 'ALLOC_EXEC row'},
  {col: 4, title: 'Legs', state: 'each PROCESSED', note: 'ALLOC_LEG rows'},
  {col: 5, title: 'Complete', state: 'PROCESSED', note: 'leg dispatcher'},
];

/* what differs between the kinds, beside the step it applies to */
const CHIPS = [
  {lane: 'today', col: 1, lines: ['at once']},
  {lane: 'today', col: 3, lines: ['at once']},
  {lane: 'sched', col: 1, lines: ['at the fetch time']},
  {lane: 'sched', col: 3, lines: ['at the execution time,', 'Reverify first']},
];

const CHIP_W = 124;
const CHIP_LINE = 15;
const chipH = (c) => 12 + c.lines.length * CHIP_LINE;

const entryBox = (id) => ({x: cx(0) - BOX_W / 2, y: mid(id) - ENTRY_H / 2, r: cx(0) + BOX_W / 2, cy: mid(id)});
const stepBox = (col) => ({
  x: cx(col) - BOX_W / 2,
  y: mid('path') - STEP_H / 2,
  r: cx(col) + BOX_W / 2,
  b: mid('path') + STEP_H / 2,
});

const LABEL =
  'How a corporate payment moves, on three lanes. A payment paid today enters on the top lane: Verify commits ACCEPTED, and it asks for its allocations at once. A scheduled payment enters on the bottom lane: Verify commits SCHEDULED, and it asks at the market\'s fetch time. Both then join one path in the middle lane, where each step is started by a Work Tracker row or a callback, never by a waiting workflow. Request, from an ALLOC_REQUEST row, moves the payment to ALLOCATING. Receive, one per callback batch, moves it to ALLOCATED once the batches add up. Execute, from an ALLOC_EXEC row, clears the parent once and moves it to PROCESSING: at once for pay today, or at the execution time for a scheduled payment, after Reverify. Execute releases the legs, which run from ALLOC_LEG rows, each to PROCESSED. The leg dispatcher\'s completion check then moves the parent to PROCESSED.';

function Box({x, y, w, h, tone, title, state, note}) {
  return (
    <g className={styles[`lane_${tone}`]}>
      <rect x={x} y={y} width={w} height={h} rx={8} className={styles.box} />
      <path d={`M${x + 8},${y} A8,8 0 0 0 ${x},${y + 8} V${y + h - 8} A8,8 0 0 0 ${x + 8},${y + h} Z`} className={styles.block} />
      <text x={x + 16} y={y + (note ? 23 : 21)} className={styles.title}>
        {title}
      </text>
      <text x={x + 16} y={y + (note ? 41 : 39)} className={clsx(styles.sub, styles.s_f)}>
        {state}
      </text>
      {note && (
        <text x={x + 16} y={y + 60} className={styles.note}>
          {note}
        </text>
      )}
    </g>
  );
}

export default function CorporateTracks() {
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="ct-arrow" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.head} />
            </marker>
          </defs>

          {/* the lanes */}
          {LANES.map((l) => (
            <g key={l.id} className={styles[`lane_${l.tone}`]}>
              <rect x={8} y={l.top} width={W - 16} height={l.h} rx={12} className={styles.band} />
              <text x={22} y={l.top + l.h / 2 - 4} className={styles.laneTerm}>
                {l.term}
              </text>
              <text x={22} y={l.top + l.h / 2 + 13} className={styles.laneDesc}>
                {l.desc}
              </text>
            </g>
          ))}

          {/* each entry joins the path at the request */}
          {ENTRIES.map((e) => {
            const b = entryBox(e.lane);
            const into = stepBox(1);
            const y = e.lane === 'today' ? mid('path') - 14 : mid('path') + 14;
            const xTurn = b.r + 12;
            return (
              <path
                key={`in-${e.lane}`}
                d={`M${b.r},${b.cy} H${xTurn - 5} Q${xTurn},${b.cy} ${xTurn},${b.cy + (y > b.cy ? 5 : -5)} V${y + (y > b.cy ? -5 : 5)} Q${xTurn},${y} ${xTurn + 5},${y} H${into.x}`}
                className={styles.along}
                markerEnd="url(#ct-arrow)"
              />
            );
          })}

          {/* along the shared path */}
          {STEPS.slice(0, -1).map((s, i) => {
            const from = stepBox(s.col);
            const to = stepBox(STEPS[i + 1].col);
            return <path key={`step-${s.col}`} d={`M${from.r},${mid('path')} H${to.x}`} className={styles.along} markerEnd="url(#ct-arrow)" />;
          })}

          {/* the timings, tied to the step they set */}
          {CHIPS.map((c) => {
            const h = chipH(c);
            const x = cx(c.col) - CHIP_W / 2;
            const y = mid(c.lane) - h / 2;
            const step = stepBox(c.col);
            const tick = c.lane === 'today' ? `M${cx(c.col)},${y + h} V${step.y}` : `M${cx(c.col)},${step.b} V${y}`;
            return (
              <g key={`${c.lane}-${c.col}`} className={styles[`lane_${lane(c.lane).tone}`]}>
                <path d={tick} className={styles.tick} />
                <rect x={x} y={y} width={CHIP_W} height={h} rx={6} className={styles.chip} />
                {c.lines.map((line, i) => (
                  <text key={line} x={cx(c.col)} y={y + 6 + CHIP_LINE * (i + 1) - 3} textAnchor="middle" className={styles.chipText}>
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {/* the boxes */}
          {ENTRIES.map((e) => {
            const b = entryBox(e.lane);
            return <Box key={`entry-${e.lane}`} x={b.x} y={b.y} w={BOX_W} h={ENTRY_H} tone={lane(e.lane).tone} title={e.title} state={e.state} />;
          })}
          {STEPS.map((s) => {
            const b = stepBox(s.col);
            return <Box key={`box-${s.col}`} x={b.x} y={b.y} w={BOX_W} h={STEP_H} tone="path" title={s.title} state={s.state} note={s.note} />;
          })}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        Until it reaches <code>ALLOCATING</code>, a scheduled payment can still be cancelled or updated inside the
        window. Execute clears the parent once and releases the legs, which run apart from it. Settle later marks each
        leg <code>PAID</code>; the parent stays <code>PROCESSED</code>.
      </figcaption>
    </figure>
  );
}
