import React from 'react';
import styles from './styles.module.css';

/**
 * PacingFlow: how offline work waits outside Temporal and flows in at the
 * governor's rate.
 *
 * Two bands. Across the top is the control loop: GovernorWorkflow checks
 * every 15 seconds, writes each class's rate to rate_allocation, which the
 * dispatchers read, and sets the downstream queue limits. Across the bottom
 * is the work itself, left to right: it waits in Oracle as Work Tracker rows
 * or in One-Data's inbox, the dispatchers release it, the Router is the one
 * door into the Offline cluster, and the workflows' calls queue per
 * downstream. Work moves on solid Bright Blue lines; control is a dashed
 * grey line, because it sets a pace rather than carrying a payment. The
 * Offline cluster keeps the navy block it has on the High Availability
 * diagram.
 *
 * Coordinates are hand-placed on a 700 x 340 canvas. Takes no props.
 */

const W = 700;
const H = 340;
const MID = 239; // the work line

const LABEL =
  'How offline work is paced. Across the top, the control loop: GovernorWorkflow runs a check every 15 seconds, writes the rates to rate_allocation, which the dispatchers read every few seconds, and sets the queue limits on the downstream ds-* queues. Across the bottom, the work, left to right: it waits in Oracle as Work Tracker rows, which is dated work, or in One-Data\'s inbox, which holds AR intake, returns and inbound payments. The dispatchers, one per kind of work, release it through the Router, the one door into the Offline cluster, where the payment workflows run, and their calls go to one ds-* queue per downstream.';

/* A card. `tone` picks its fill: `field` for a card on a tinted field, `line`
   for one on the work line, `offline` for the cluster. */
function Card({x, y, w, h, title, sub, mono, tone}) {
  const inset = tone === 'offline' ? 20 : 14;
  return (
    <g className={styles[`c_${tone}`]}>
      <rect x={x} y={y} width={w} height={h} rx={9} className={styles.card} />
      {tone === 'offline' && (
        <path
          d={`M${x + 8},${y} A8,8 0 0 0 ${x},${y + 8} V${y + h - 8} A8,8 0 0 0 ${x + 8},${y + h} Z`}
          className={styles.block}
        />
      )}
      <text x={x + inset} y={y + 26} className={mono ? styles.titleMono : styles.title}>
        {title}
      </text>
      {[].concat(sub).map((line, i) => (
        <text key={line} x={x + inset} y={y + 44 + i * 15} className={styles.sub}>
          {line}
        </text>
      ))}
    </g>
  );
}

export default function PacingFlow() {
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="pf-work" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.headWork} />
            </marker>
            <marker id="pf-ctl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.6" markerHeight="6.6" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.headCtl} />
            </marker>
          </defs>

          {/* ---- the control loop ---- */}
          <rect x={10} y={10} width={680} height={108} rx={14} className={styles.fieldCtl} />
          <text x={26} y={37} className={styles.kicker}>
            CONTROL
          </text>
          <text x={26} y={56} className={styles.fieldNote}>
            the rate for every class
          </text>
          <rect x={189} y={50} width={150} height={34} rx={8} className={styles.table} />
          <text x={264} y={71.5} textAnchor="middle" className={styles.tableText}>
            rate_allocation
          </text>
          <Card x={380} y={36} w={174} h={62} title="GovernorWorkflow" sub="a check every 15 s" mono tone="field" />

          <path d="M380,67 H339" className={styles.ctl} markerEnd="url(#pf-ctl)" />
          <text x={359.5} y={59} textAnchor="middle" className={styles.ctlLabel}>
            rates
          </text>
          <path d="M554,67 H621 Q627,67 627,73 V208" className={styles.ctl} markerEnd="url(#pf-ctl)" />
          <text x={590} y={59} textAnchor="middle" className={styles.ctlLabel}>
            queue limits
          </text>
          <path d="M264,84 V208" className={styles.ctl} markerEnd="url(#pf-ctl)" />
          <text x={275} y={157} className={styles.ctlLabel}>
            read every few seconds
          </text>

          {/* ---- where work waits ---- */}
          <rect x={10} y={150} width={166} height={180} rx={14} className={styles.fieldWait} />
          <text x={24} y={174} className={styles.kicker}>
            WHERE WORK WAITS
          </text>
          <Card x={20} y={184} w={146} h={56} title="Work Tracker rows" sub="in Oracle: dated work" tone="field" />
          <Card x={20} y={248} w={146} h={72} title="One-Data's inbox" sub={['AR intake, returns', 'and inbound']} tone="field" />

          {/* ---- the work line ---- */}
          <path d={`M166,212 H176 Q182,212 182,218 V${MID - 6} Q182,${MID} 188,${MID} H196`} className={styles.work} markerEnd="url(#pf-work)" />
          <path d={`M166,284 H176 Q182,284 182,278 V${MID + 6} Q182,${MID} 188,${MID}`} className={styles.work} />

          <Card x={196} y={208} w={136} h={62} title="Dispatchers" sub="one per kind of work" tone="line" />
          <path d={`M332,${MID} H362`} className={styles.work} markerEnd="url(#pf-work)" />

          <rect x={362} y={194} width={12} height={90} rx={3} className={styles.door} />
          <text x={368} y={185} textAnchor="middle" className={styles.doorLabel}>
            Router
          </text>
          <text x={368} y={302} textAnchor="middle" className={styles.doorNote}>
            the one door
          </text>

          <path d={`M374,${MID} H402`} className={styles.work} markerEnd="url(#pf-work)" />
          <Card x={402} y={208} w={136} h={62} title="Offline cluster" sub="payment workflows" tone="offline" />
          <path d={`M538,${MID} H564`} className={styles.work} markerEnd="url(#pf-work)" />
          <Card x={564} y={208} w={126} h={62} title="ds-* queues" sub="per downstream" mono tone="line" />
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.li}>
          <span className={styles.swWork} aria-hidden="true" />
          work, released at the governor's rate
        </span>
        <span className={styles.li}>
          <span className={styles.swCtl} aria-hidden="true" />
          control
        </span>
      </div>
    </figure>
  );
}
