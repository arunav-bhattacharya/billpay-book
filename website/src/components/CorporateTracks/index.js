import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * CorporateTracks: a scheduled corporate payment as three lanes on one
 * timeline.
 *
 * The point of the picture is that allocations never hold up the parent's
 * clearing, so the parent and its allocations get lanes of their own and time runs left to right
 * across all three. The legs get a third lane because they are where the two
 * tracks meet: no leg exists until the parent is accepted, so the stored
 * batches and the parent's acceptance together write them, and their
 * completion closes the parent. The fetch also reaches up to the parent: from
 * then on it can't be cancelled or updated. Those four meetings are the only
 * lines between lanes, and each is labelled with what crosses.
 *
 * Coordinates are hand-placed on a 980 x 400 canvas: six time columns 140
 * wide from x = 130, three lanes 92 tall with 30-unit gaps that hold the
 * connector labels. Every label is short enough to sit inside its box at the
 * sizes in the stylesheet. Takes no props.
 */

const W = 980;
const H = 400;

const COL_X0 = 130;
const COL_W = 140;
const cx = (c) => COL_X0 + COL_W / 2 + c * COL_W;

const LANES = [
  {id: 'parent', term: 'Parent', desc: 'one payment', top: 48, tone: 'parent'},
  {id: 'alloc', term: 'Allocations', desc: 'the breakdown', top: 170, tone: 'alloc'},
  {id: 'legs', term: 'Legs', desc: 'one per allocation', top: 292, tone: 'legs'},
];
const LANE_H = 92;
const laneMid = (id) => {
  const l = LANES.find((x) => x.id === id);
  return l.top + LANE_H / 2;
};

const BOX_W = 120;
const BOX_H = 60;

const TIMES = ['At intake', 'Fetch time', 'Callbacks', 'Due date', 'Execution', 'Afterwards'];

/* state tone: f = in flight, ok = paid, q = quiet (not a payment state) */
const BOXES = [
  {lane: 'parent', col: 0, title: 'Verify', sub: 'SCHEDULED', tone: 'f'},
  {lane: 'parent', col: 3, title: 'Reverify', sub: 'ACCEPTED', tone: 'f'},
  {lane: 'parent', col: 4, title: 'Execute', sub: 'clears once', tone: 'q'},
  {lane: 'parent', col: 5, title: 'Completion', sub: 'PROCESSED', tone: 'f'},

  {lane: 'alloc', col: 0, title: 'Request row', sub: 'ALLOC_REQUEST', tone: 'q'},
  {lane: 'alloc', col: 1, title: 'Request', sub: 'ALLOCATING', tone: 'q'},
  {lane: 'alloc', col: 2, title: 'Receive', sub: 'batches stored', tone: 'q'},

  {lane: 'legs', col: 3, title: 'Legs written', sub: 'rows SCHEDULED', tone: 'q'},
  {lane: 'legs', col: 4, title: 'Leg workflows', sub: 'PROCESSED', tone: 'f'},
  {lane: 'legs', col: 5, title: 'Settle', sub: 'each leg PAID', tone: 'ok'},
];

const box = (lane, col) => ({
  x: cx(col) - BOX_W / 2,
  y: laneMid(lane) - BOX_H / 2,
  r: cx(col) + BOX_W / 2,
  b: laneMid(lane) + BOX_H / 2,
  cx: cx(col),
  cy: laneMid(lane),
});

/* arrows along a lane, from one box's right edge to the next box's left edge */
const ALONG = [
  ['parent', 0, 3, 'waits in Oracle'],
  ['parent', 3, 4],
  ['parent', 4, 5],
  ['alloc', 0, 1],
  ['alloc', 1, 2],
  ['legs', 3, 4],
  ['legs', 4, 5],
];

/* the four places the tracks meet */
const ACROSS = [
  {
    id: 'fetch',
    d: `M${cx(1)},${box('alloc', 1).y} V${laneMid('parent') + 4}`,
    label: 'ends cancel and update',
    lx: cx(1) + 8,
    ly: LANES[0].top + LANE_H + 19,
  },
  {
    id: 'write',
    d: `M${cx(2)},${box('alloc', 2).b} V${laneMid('legs')} H${box('legs', 3).x}`,
    label: 'the stored batches',
    lx: cx(2) + 8,
    ly: laneMid('alloc') + BOX_H / 2 + 19,
  },
  {
    id: 'release',
    d: `M${cx(3)},${box('parent', 3).b} V${box('legs', 3).y}`,
    label: 'sets legs_released_at',
    lx: cx(3) + 8,
    ly: laneMid('parent') + BOX_H / 2 + 31,
  },
  {
    id: 'complete',
    d: `M${cx(4) + 22},${box('legs', 4).y} V${LANES[0].top + LANE_H + 15} H${cx(5)} V${box('parent', 5).b}`,
    label: ['ALLOCATED, and every', 'leg PROCESSED or PAID'],
    lx: cx(4) + 30,
    ly: LANES[1].top + 34,
  },
];

const LABEL =
  "A scheduled corporate payment on three lanes, with time running left to right from intake, through the fetch time, the callbacks and the due date, to execution and afterwards. The parent lane: Verify commits SCHEDULED at intake, the payment waits as a row in Oracle, Reverify commits ACCEPTED on the due date, Execute clears the whole amount once, and the completion check commits PROCESSED. The allocations lane: the intake commit writes an ALLOC_REQUEST row; the request at the fetch time sets the allocation status to ALLOCATING, and from then on the parent can no longer be cancelled or updated; each callback batch is received and stored, the status turning ALLOCATED once the batches add up. The legs lane: no leg exists before the due date. Reverify sets legs_released_at, and the legs of the stored batches are written with SCHEDULED Work Tracker rows; each leg runs its own workflow to PROCESSED; and once the parent is ALLOCATED and every leg is PROCESSED or PAID, the completion check moves the parent to PROCESSED. Afterwards Settle marks each leg PAID while the parent stays PROCESSED.";

export default function CorporateTracks() {
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="ct-arrow" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.head} />
            </marker>
            <marker id="ct-arrow-x" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6.8" markerHeight="6.8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.headAcross} />
            </marker>
          </defs>

          {/* time runs left to right */}
          {TIMES.map((t, i) => (
            <text key={t} x={cx(i)} y={30} textAnchor="middle" className={styles.time}>
              {t}
            </text>
          ))}

          {/* the lanes */}
          {LANES.map((l) => (
            <g key={l.id} className={styles[`lane_${l.tone}`]}>
              <rect x={8} y={l.top} width={W - 16} height={LANE_H} rx={12} className={styles.band} />
              <text x={22} y={l.top + LANE_H / 2 - 4} className={styles.laneTerm}>
                {l.term}
              </text>
              <text x={22} y={l.top + LANE_H / 2 + 13} className={styles.laneDesc}>
                {l.desc}
              </text>
            </g>
          ))}

          {/* along each lane */}
          {ALONG.map(([lane, a, b, label]) => {
            const from = box(lane, a);
            const to = box(lane, b);
            return (
              <g key={`${lane}-${a}-${b}`}>
                <path d={`M${from.r},${from.cy} H${to.x}`} className={styles.along} markerEnd="url(#ct-arrow)" />
                {label && (
                  <text x={(from.r + to.x) / 2} y={from.cy - 8} textAnchor="middle" className={styles.alongLabel}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {/* where the tracks meet */}
          {ACROSS.map((c) => (
            <g key={c.id}>
              <path d={c.d} className={styles.across} markerEnd="url(#ct-arrow-x)" />
              {[].concat(c.label).map((line, i) => (
                <text key={line} x={c.lx} y={c.ly + i * 16} className={styles.acrossLabel}>
                  {line}
                </text>
              ))}
            </g>
          ))}

          {/* the steps */}
          {BOXES.map((bx) => {
            const g = box(bx.lane, bx.col);
            const lane = LANES.find((l) => l.id === bx.lane);
            return (
              <g key={`${bx.lane}-${bx.col}`} className={styles[`lane_${lane.tone}`]}>
                <rect x={g.x} y={g.y} width={BOX_W} height={BOX_H} rx={8} className={styles.box} />
                <path
                  d={`M${g.x + 8},${g.y} A8,8 0 0 0 ${g.x},${g.y + 8} V${g.b - 8} A8,8 0 0 0 ${g.x + 8},${g.b} Z`}
                  className={styles.block}
                />
                <text x={g.x + 16} y={g.cy - 4} className={styles.title}>
                  {bx.title}
                </text>
                <text x={g.x + 16} y={g.cy + 14} className={clsx(styles.sub, styles[`s_${bx.tone}`])}>
                  {bx.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        A pay-today corporate payment runs the same tracks, compressed: Verify accepts the parent, the request goes
        out at once, and each batch's legs are written as soon as it arrives.
      </figcaption>
    </figure>
  );
}
