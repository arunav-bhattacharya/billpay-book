import React from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/**
 * HADiagram: where Billpay physically runs, and what stands behind what.
 *
 * Two estates side by side, on-prem on the left and AWS on the right, each cut
 * into an east band (live) and a west band (standby). The west band mirrors
 * the east one across the gap between them, so every replication link, Redis
 * CRDB, Oracle Data Guard and each cluster's Aurora, crosses that gap
 * vertically and the gap itself reads as the line between live and standby.
 *
 * Colour follows the Blue Box rules: tinted fields, filled boxes, no
 * outlines, and the two cluster tones from the worker tokens, so anything
 * Online is Bright Blue and anything Offline is the deeper navy, as in
 * ClusterMap and WorkerChip. Every colour is a token; the only artwork is the
 * Amex logo.
 *
 * The callers stand outside both estates, on the far left, because they are
 * neither Amex infrastructure nor AWS. Each Temporal cluster has its own
 * Aurora PostgreSQL drum, and the standby drum it replicates to.
 *
 * billpay-core is one app, drawn as one box in each site: active in IPC2, and
 * a standby of the same app in IPC1. It talks to both Temporal clusters over
 * one gRPC run that forks at the gutter, one client per cluster.
 *
 * Coordinates are hand-placed on a 1560 x 860 canvas. Lines run in lanes
 * chosen so that none of them cross.
 */

const W = 1560;
const H = 860;

/* the west band is the east band mirrored about this line */
const AXIS = 416;
const m = (y) => 2 * AXIS - y;

/* ---------------------------------------------------------------- icons -- */

function User({cx, cy}) {
  const s = 26 / 24;
  return (
    <g transform={`translate(${cx - 13} ${cy - 13}) scale(${s})`} className={styles.icon}>
      <circle cx="12" cy="8" r="4.1" />
      <path d="M3.9 20.6a8.1 8.1 0 0 1 16.2 0" />
    </g>
  );
}

const TEMPORAL_PATH =
  'M16.206 7.794C15.64 3.546 14.204 0 12 0 9.796 0 8.361 3.546 7.794 7.794 3.546 8.36 0 9.796 0 12c0 2.204 3.546 3.639 7.794 4.206C8.36 20.453 9.796 24 12 24c2.204 0 3.639-3.546 4.206-7.794C20.454 15.64 24 14.204 24 12c0-2.204-3.547-3.64-7.794-4.206Zm-8.55 7.174c-4.069-.587-6.44-1.932-6.44-2.969 0-1.036 2.372-2.381 6.44-2.969-.09.98-.137 1.98-.137 2.97 0 .99.047 1.99.137 2.968zM12 1.215c1.036 0 2.381 2.372 2.969 6.44a32.718 32.718 0 0 0-5.938 0c.587-4.068 1.932-6.44 2.969-6.44Zm4.344 13.753c-.2.03-1.022.126-1.23.146-.02.209-.117 1.03-.145 1.23-.588 4.068-1.933 6.44-2.97 6.44-1.036 0-2.38-2.372-2.968-6.44-.03-.2-.126-1.022-.147-1.23a31.833 31.833 0 0 1 0-6.23 31.813 31.813 0 0 1 7.46.146c4.068.587 6.442 1.933 6.442 2.969-.001 1.036-2.374 2.382-6.442 2.97z';

function TemporalMark({x, y, size = 18}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} className={styles.temporalMark}>
      <path d={TEMPORAL_PATH} />
    </g>
  );
}

function AmexMark({x, y, size}) {
  const src = useBaseUrl('/img/amex-logo.png');
  return <image href={src} x={x} y={y} width={size} height={size} />;
}

/* ---------------------------------------------------------------- parts -- */

/* A label in a small box: the Blue Box badge, stretched to fit a word. */
function Pill({x, y, label, tone, anchor = 'middle'}) {
  const w = label.length * 7.6 + 16;
  const left = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
  return (
    <g className={clsx(styles.pill, styles[tone])}>
      <rect x={left} y={y - 10} width={w} height={20} rx={4} />
      <text x={left + w / 2} y={y + 4.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* An opaque label laid on a connector, so the line never runs through text. */
function Chip({x, y, label, tone}) {
  const w = label.length * 7.4 + 22;
  return (
    <g className={clsx(styles.chip, styles[tone])}>
      <rect x={x - w / 2} y={y - 12} width={w} height={24} rx={12} />
      <text x={x} y={y + 4.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* A filled box with a solid block down its left edge in the box's tone. The
   block is a half-rounded shape exactly as wide as the corner radius, so it
   follows the box's corners without a clip path. */
const R = 9;
function Box({x, y, w, h, tone, title, sub, dim, mark}) {
  const block = `M${x + R},${y} A${R},${R} 0 0 0 ${x},${y + R} V${y + h - R} A${R},${R} 0 0 0 ${x + R},${y + h} Z`;
  const tx = mark ? x + 44 : x + 22;
  return (
    <g className={clsx(styles.box, styles[tone], dim && styles.dim)}>
      <rect x={x} y={y} width={w} height={h} rx={R} className={styles.boxBody} />
      <path d={block} className={styles.boxBlock} />
      {mark && <TemporalMark x={x + 18} y={y + h / 2 - 20} />}
      <text x={tx} y={y + (sub ? h / 2 - 3 : h / 2 + 6)} className={styles.boxTitle}>
        {title}
      </text>
      {sub && (
        <text x={tx} y={y + h / 2 + 17} className={styles.boxSub}>
          {sub}
        </text>
      )}
    </g>
  );
}

/* billpay-core: one app, so one box, with what it runs listed inside. */
const APP_LINES = ['Core APIs · Router', 'Dispatchers · governor', 'Workers for both clusters', 'A Temporal client per cluster'];
function AppBox({x, y, w, h, dim}) {
  const block = `M${x + R},${y} A${R},${R} 0 0 0 ${x},${y + R} V${y + h - R} A${R},${R} 0 0 0 ${x + R},${y + h} Z`;
  return (
    <g className={clsx(styles.box, styles.tApp, dim && styles.dim)}>
      <rect x={x} y={y} width={w} height={h} rx={R} className={styles.boxBody} />
      <path d={block} className={styles.boxBlock} />
      <text x={x + 22} y={y + 34} className={styles.boxTitle}>
        billpay-core
      </text>
      {APP_LINES.map((line, i) => (
        <text key={line} x={x + 22} y={y + 62 + i * 22} className={styles.boxSub}>
          {line}
        </text>
      ))}
    </g>
  );
}

/* A database drum, flat-filled: body, a lighter lid, two cut lines. */
function Drum({cx, cy, rx, h, tone, dim}) {
  const ry = rx * 0.34;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  return (
    <g className={clsx(styles.drum, styles[tone], dim && styles.dim)}>
      <path
        d={`M${cx - rx},${top} V${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot} V${top} Z`}
        className={styles.drumBody}
      />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} className={styles.drumLid} />
      <path d={`M${cx - rx},${top + h * 0.36} A${rx},${ry} 0 0 0 ${cx + rx},${top + h * 0.36}`} className={styles.drumCut} />
      <path d={`M${cx - rx},${top + h * 0.7} A${rx},${ry} 0 0 0 ${cx + rx},${top + h * 0.7}`} className={styles.drumCut} />
    </g>
  );
}

/* Redis: three stacked discs in Light Blue. */
function Redis({cx, cy}) {
  const rx = 20;
  const ry = 7;
  return (
    <g className={styles.redis}>
      {[1, 0, -1].map((k) => (
        <ellipse key={k} cx={cx} cy={cy + k * 9.5} rx={rx} ry={ry} />
      ))}
    </g>
  );
}

function Label({x, y, children, cls = 'markLabel', anchor = 'middle'}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={styles[cls]}>
      {children}
    </text>
  );
}

/* ------------------------------------------------------------- layout --- */

/* every on-prem x is laid out from the estate's left edge */
const DX = 84;

/* estates and bands */
const PREM = {x: 100, y: 16, w: 920, h: 756};
const AWS = {x: 1040, y: 16, w: 504, h: 756};
const BAND_H = 320;
const EAST_Y = 76;
const WEST_Y = m(EAST_Y + BAND_H); /* 436 */
const PREM_BAND = {x: 114, w: 892};
const AWS_BAND = {x: 1054, w: 476};

/* callers, outside both estates */
const CALLER_X = 46;

/* the on-prem columns */
const OD = {x: 96 + DX, w: 166, h: 64}; /* One-Data */
const REDIS_X = 179 + DX;
const CROSS_X = 318 + DX; /* the cross-site riser */
const APP = {x: 342 + DX, w: 266, h: 152, y: 148}; /* billpay-core, east; the west one mirrors it */
const GUARD_X = 660 + DX; /* Data Guard */
const ORA = {cx: 714 + DX, rx: 30, h: 40};
const REP = [808 + DX, 864 + DX];

/* the AWS column */
const CL = {x: 1068, w: 250, h: 70};
const LANE = 1030; /* the app's gRPC, forking to both clusters in the gutter */
const PG = {cx: 1380, rx: 22, h: 32}; /* each cluster's Aurora PostgreSQL */
const REPL_IN = 1432; /* Offline database replication, inner lane */
const REPL_OUT = 1450; /* Online database replication, outer lane */

/* east rows */
const ROW = 181; /* caller, One-Data, the app's request line, Online cluster */
const ORA_Y = 227;
const OFF_CL_Y = 270;

const LABEL =
  'High-availability topology. On the far left, outside both estates, a caller near each on-prem site. Next, the American Express on-prem Hydra estate, in two bands. US East, IPC2, is live: the caller reaches the One-Data gateway, active, which calls the core APIs in the app. billpay-core is one app, active there: it runs the core APIs, the Router, the dispatchers, the governor and the workers for both Temporal clusters, with a client for each, and it reads and writes the Oracle primary, which feeds two read-only replicas. Under One-Data is a Redis fallback store: One-Data parks a request there when the core APIs cannot be reached, and RTF replays it later. US West, IPC1, mirrors it below: its One-Data is also active but routes across to the app in IPC2, it holds a standby of the same billpay-core app, and it holds the Oracle Data Guard standby and one read-only replica. The two Redis stores are one active-active CRDB database. On the right, the AWS estate. us-east-1, active, runs two self-hosted Temporal clusters on EKS: the Online cluster with 2,000 shards and the Offline cluster with 4,000, each with OpenSearch 2 visibility and its own Aurora PostgreSQL database. Over gRPC, billpay-core talks to both clusters. us-west-1 holds a passive standby of each cluster, each with its own PostgreSQL database replicated from the east, and each promoted on its own.';

export default function HADiagram() {
  const eastOD = {x: OD.x, y: ROW - OD.h / 2};
  const westOD = {x: OD.x, y: m(ROW) - OD.h / 2};
  const westAppY = m(APP.y + APP.h); /* 532 */
  const onCl = {y: ROW - CL.h / 2};
  const offCl = {y: OFF_CL_Y};
  const westOffCl = {y: m(OFF_CL_Y + CL.h)};
  const westOnCl = {y: m(ROW + CL.h / 2)};
  const appMidX = APP.x + APP.w / 2;
  const westOra = m(ORA_Y); /* 605 */

  /* the middle of each cluster row, where its database sits */
  const onY = ROW;
  const offY = offCl.y + CL.h / 2;
  const westOffY = westOffCl.y + CL.h / 2;
  const westOnY = westOnCl.y + CL.h / 2;

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
        <defs>
          {['req', 'buf', 'rep', 'idle'].map((k) => (
            <marker
              key={k}
              id={`had-${k}`}
              viewBox="0 0 10 10"
              refX="8.6"
              refY="5"
              markerWidth="6.4"
              markerHeight="6.4"
              orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles[`head_${k}`]} />
            </marker>
          ))}
        </defs>

        {/* ======================= estates and bands ======================= */}
        <rect x={PREM.x} y={PREM.y} width={PREM.w} height={PREM.h} rx={18} className={styles.estatePrem} />
        <AmexMark x={PREM.x + 18} y={30} size={30} />
        <Label x={PREM.x + 60} y={44} cls="estateLabel" anchor="start">AMERICAN EXPRESS</Label>
        <Label x={PREM.x + 60} y={61} cls="estateNote" anchor="start">on-prem Hydra</Label>

        <rect x={AWS.x} y={AWS.y} width={AWS.w} height={AWS.h} rx={18} className={styles.estateAws} />
        <Label x={AWS.x + 18} y={44} cls="estateLabel" anchor="start">AWS</Label>
        <Label x={AWS.x + 18} y={61} cls="estateNote" anchor="start">self-hosted Temporal</Label>

        <rect x={PREM_BAND.x} y={EAST_Y} width={PREM_BAND.w} height={BAND_H} rx={13} className={styles.band} />
        <rect x={PREM_BAND.x} y={WEST_Y} width={PREM_BAND.w} height={BAND_H} rx={13} className={styles.band} />
        <rect x={AWS_BAND.x} y={EAST_Y} width={AWS_BAND.w} height={BAND_H} rx={13} className={styles.band} />
        <rect x={AWS_BAND.x} y={WEST_Y} width={AWS_BAND.w} height={BAND_H} rx={13} className={styles.band} />
        <Label x={PREM_BAND.x + 18} y={101} cls="bandLabel" anchor="start">US EAST · IPC2</Label>
        <Label x={PREM_BAND.x + 18} y={WEST_Y + 25} cls="bandLabel" anchor="start">US WEST · IPC1</Label>
        <Label x={AWS_BAND.x + 18} y={101} cls="bandLabel" anchor="start">US-EAST-1 · EKS</Label>
        <Label x={AWS_BAND.x + 18} y={WEST_Y + 25} cls="bandLabel" anchor="start">US-WEST-1</Label>
        {/* each region's state rides beside its name, clear of the
            replication lanes that run down the right-hand side */}
        <Pill x={AWS_BAND.x + 170} y={96} label="ACTIVE" tone="pActive" anchor="start" />
        <Pill x={AWS_BAND.x + 116} y={WEST_Y + 20} label="STANDBY" tone="pStandby" anchor="start" />

        {/* ============================ lines ============================ */}
        {/* drawn before the boxes, so every box and label sits on top */}

        {/* east: caller to One-Data to billpay-core */}
        <path d={`M${CALLER_X + 18},${ROW} H${OD.x - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        <path d={`M${OD.x + OD.w},${ROW} H${APP.x - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        {/* west: caller to One-Data, then across to IPC2's app */}
        <path d={`M${CALLER_X + 18},${m(ROW)} H${OD.x - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        <path
          d={`M${OD.x + OD.w},${m(ROW)} H${CROSS_X} V${ROW + 15} H${APP.x - 4}`}
          className={styles.req}
          markerEnd="url(#had-req)"
        />

        {/* One-Data parks in Redis; RTF replays */}
        <path d={`M${REDIS_X},${eastOD.y + OD.h + 2} V${ROW + 64}`} className={styles.buf} markerStart="url(#had-buf)" markerEnd="url(#had-buf)" />
        <path d={`M${REDIS_X},${westOD.y - 2} V${m(ROW + 64)}`} className={styles.buf} markerStart="url(#had-buf)" markerEnd="url(#had-buf)" />
        {/* the two Redis stores are one active-active database */}
        <path d={`M${REDIS_X},${ROW + 114} V${m(ROW + 114)}`} className={styles.buf} markerStart="url(#had-buf)" markerEnd="url(#had-buf)" />

        {/* the app to Oracle; the IPC1 standby is wired the same way, idle until promoted */}
        <path d={`M${APP.x + APP.w},${ORA_Y} H${ORA.cx - ORA.rx - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        <path d={`M${APP.x + APP.w},${westOra} H${ORA.cx - ORA.rx - 4}`} className={styles.idle} markerEnd="url(#had-idle)" />

        {/* Oracle replication */}
        <path d={`M${ORA.cx + ORA.rx},${ORA_Y - 2} H${REP[0] - 23}`} className={styles.rep} markerEnd="url(#had-rep)" />
        <path d={`M${ORA.cx + ORA.rx},${westOra - 2} H${REP[0] - 23}`} className={styles.rep} markerEnd="url(#had-rep)" />
        <path
          d={`M${ORA.cx - ORA.rx},${ORA_Y + 11} H${GUARD_X} V${westOra - 11} H${ORA.cx - ORA.rx - 4}`}
          className={styles.rep}
          markerEnd="url(#had-rep)"
        />

        {/* gRPC: billpay-core to both clusters, one client each. The run leaves
            over the top of the band and forks in the gutter. */}
        <path
          d={`M${appMidX},${APP.y} V96 H${LANE} V${ROW} H${CL.x - 4}`}
          className={styles.req}
          markerEnd="url(#had-req)"
        />
        <path d={`M${LANE},${ROW} V${OFF_CL_Y + 35} H${CL.x - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        <circle cx={LANE} cy={ROW} r={3.6} className={styles.junction} />

        {/* each cluster writes its own database */}
        {[onY, offY].map((y) => (
          <path key={y} d={`M${CL.x + CL.w},${y} H${PG.cx - PG.rx - 4}`} className={styles.req} markerEnd="url(#had-req)" />
        ))}
        {[westOffY, westOnY].map((y) => (
          <path key={y} d={`M${CL.x + CL.w},${y} H${PG.cx - PG.rx - 4}`} className={styles.idle} markerEnd="url(#had-idle)" />
        ))}

        {/* each database replicates to its own standby, in nested lanes so
            the two never cross: Offline's pair sits inside Online's */}
        <path
          d={`M${PG.cx + PG.rx},${offY} H${REPL_IN} V${westOffY} H${PG.cx + PG.rx + 4}`}
          className={styles.rep}
          markerEnd="url(#had-rep)"
        />
        <path
          d={`M${PG.cx + PG.rx},${onY} H${REPL_OUT} V${westOnY} H${PG.cx + PG.rx + 4}`}
          className={styles.rep}
          markerEnd="url(#had-rep)"
        />

        {/* ============================ boxes ============================ */}

        {/* ---- callers, outside both estates ---- */}
        <g className={styles.caller}>
          <User cx={CALLER_X} cy={ROW} />
          <User cx={CALLER_X} cy={m(ROW)} />
        </g>
        <Label x={CALLER_X} y={ROW + 34} cls="small">caller</Label>
        <Label x={CALLER_X} y={ROW + 49} cls="small">near IPC2</Label>
        <Label x={CALLER_X} y={m(ROW) + 34} cls="small">caller</Label>
        <Label x={CALLER_X} y={m(ROW) + 49} cls="small">near IPC1</Label>

        {/* ---- One-Data, both sites live ---- */}
        <Box x={OD.x} y={eastOD.y} w={OD.w} h={OD.h} tone="tGate" title="One-Data" sub="API gateway" />
        <Pill x={OD.x + OD.w - 6} y={eastOD.y - 14} label="ACTIVE" tone="pActive" anchor="end" />
        <Box x={OD.x} y={westOD.y} w={OD.w} h={OD.h} tone="tGate" title="One-Data" sub="API gateway" />
        <Pill x={OD.x + OD.w - 6} y={westOD.y + OD.h + 14} label="ACTIVE" tone="pActive" anchor="end" />

        {/* ---- Redis ---- */}
        <Redis cx={REDIS_X} cy={ROW + 93} />
        <Label x={REDIS_X + 27} y={ROW + 91} cls="markLabel" anchor="start">Redis</Label>
        <Label x={REDIS_X + 27} y={ROW + 107} cls="markSub" anchor="start">fallback store</Label>
        <Redis cx={REDIS_X} cy={m(ROW + 93)} />
        <Label x={REDIS_X + 27} y={m(ROW + 93) - 2} cls="markLabel" anchor="start">Redis</Label>
        <Label x={REDIS_X + 27} y={m(ROW + 93) + 14} cls="markSub" anchor="start">fallback store</Label>
        <Label x={REDIS_X + 11} y={ROW + 55} cls="bufLabel" anchor="start">park · RTF replay</Label>
        <Label x={REDIS_X + 11} y={m(ROW + 55) + 9} cls="bufLabel" anchor="start">park · RTF replay</Label>

        {/* ---- billpay-core: one app, active in IPC2, its standby in IPC1 ---- */}
        <AppBox x={APP.x} y={APP.y} w={APP.w} h={APP.h} />
        <Pill x={APP.x + APP.w - 6} y={APP.y - 14} label="ACTIVE" tone="pActive" anchor="end" />
        <AppBox x={APP.x} y={westAppY} w={APP.w} h={APP.h} dim />
        <Pill x={APP.x + APP.w - 6} y={westAppY + APP.h + 14} label="STANDBY" tone="pStandby" anchor="end" />

        {/* ---- Oracle ---- */}
        <Drum cx={ORA.cx} cy={ORA_Y} rx={ORA.rx} h={ORA.h} tone="tOracle" />
        <Label x={ORA.cx} y={ORA_Y + 48}>Oracle</Label>
        <Label x={ORA.cx} y={ORA_Y + 64} cls="markSub">read + write</Label>
        <Pill x={ORA.cx} y={ORA_Y + 85} label="PRIMARY" tone="pPrimary" />
        {REP.map((cx) => (
          <Drum key={cx} cx={cx} cy={ORA_Y + 2} rx={19} h={26} tone="tOracle" />
        ))}
        <Label x={(REP[0] + REP[1]) / 2} y={ORA_Y + 48} cls="markSub">read-only × 2</Label>

        <Drum cx={ORA.cx} cy={westOra} rx={ORA.rx} h={ORA.h} tone="tOracle" dim />
        <Label x={ORA.cx} y={westOra + 48}>Oracle</Label>
        <Label x={ORA.cx} y={westOra + 64} cls="markSub">read only</Label>
        <Pill x={ORA.cx} y={westOra + 85} label="STANDBY" tone="pStandby" />
        <Drum cx={REP[0]} cy={westOra + 2} rx={19} h={26} tone="tOracle" dim />
        <Label x={REP[0]} y={westOra + 48} cls="markSub">read-only</Label>

        {/* ---- Temporal, and each cluster's own database ---- */}
        <Box x={CL.x} y={onCl.y} w={CL.w} h={CL.h} tone="tOnline" mark title="Online cluster" sub="2K shards · OpenSearch 2" />
        <Box x={CL.x} y={offCl.y} w={CL.w} h={CL.h} tone="tOffline" mark title="Offline cluster" sub="4K shards · OpenSearch 2" />
        <Box x={CL.x} y={westOffCl.y} w={CL.w} h={CL.h} tone="tOffline" mark dim title="Offline standby" sub="Promoted on its own" />
        <Box x={CL.x} y={westOnCl.y} w={CL.w} h={CL.h} tone="tOnline" mark dim title="Online standby" sub="Promoted on its own" />

        {[
          {y: onY, tone: 'tOnline', name: 'online'},
          {y: offY, tone: 'tOffline', name: 'offline'},
          {y: westOffY, tone: 'tOffline', name: 'offline', dim: true},
          {y: westOnY, tone: 'tOnline', name: 'online', dim: true},
        ].map((d) => (
          <g key={d.y}>
            <Drum cx={PG.cx} cy={d.y} rx={PG.rx} h={PG.h} tone={d.tone} dim={d.dim} />
            <Label x={PG.cx} y={d.y + PG.h / 2 + 24}>Postgres</Label>
            <Label x={PG.cx} y={d.y + PG.h / 2 + 42} cls="markSub">{d.name}</Label>
          </g>
        ))}

        {/* ---- labels laid on lines ---- */}
        <Chip x={REDIS_X} y={AXIS} label="CRDB · active-active" tone="cBuf" />
        <Chip x={CROSS_X} y={WEST_Y + 34} label="cross-site" tone="cReq" />
        <Chip x={GUARD_X} y={AXIS} label="Data Guard" tone="cRep" />
        <Chip x={800 + DX} y={96} label="gRPC" tone="cReq" />
        <Label x={1214} y={AXIS + 5} cls="gapLabel">each database replicated east to west</Label>

        {/* ---- legend ---- */}
        <g className={styles.legend}>
          <path d={`M${PREM.x + 14},800 H${PREM.x + 50}`} className={styles.req} markerEnd="url(#had-req)" />
          <text x={PREM.x + 60} y={805}>request path, and gRPC to Temporal</text>
          <path d={`M${PREM.x + 356},800 H${PREM.x + 392}`} className={styles.buf} markerEnd="url(#had-buf)" />
          <text x={PREM.x + 402} y={805}>
            fallback: One-Data parks the request in Redis when the core APIs can&apos;t be reached, and RTF replays it
          </text>
          <path d={`M${PREM.x + 14},830 H${PREM.x + 50}`} className={styles.rep} markerEnd="url(#had-rep)" />
          <text x={PREM.x + 60} y={835}>replication</text>
          <text x={PREM.x + 356} y={835} className={styles.legendMut}>
            dimmed parts are standbys, idle until promoted: IPC1&apos;s app and Oracle, and each cluster&apos;s standby in us-west-1
          </text>
        </g>
      </svg>
    </div>
  );
}
