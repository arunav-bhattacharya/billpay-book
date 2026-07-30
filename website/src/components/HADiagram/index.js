import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * HADiagram: the high-availability topology in three layers: the API layer and
 * the billpay-core + Oracle layer side by side across the two on-prem regions
 * (IPC2 east, IPC1 west), then the Temporal + Postgres layer underneath.
 * Hand-authored SVG so the product marks carry their own colours; everything
 * else comes from the design tokens, so light and dark both render.
 */

/* ---------------------------------------------------------------- icons -- */

const ICON = {
  user: (
    <>
      <circle cx="12" cy="8" r="4.1" />
      <path d="M3.9 20.6a8.1 8.1 0 0 1 16.2 0" />
    </>
  ),
  rack: (
    <>
      <rect x="3" y="4" width="18" height="6.4" rx="1.6" />
      <rect x="3" y="13.6" width="18" height="6.4" rx="1.6" />
      <circle cx="6.6" cy="7.2" r="1" />
      <circle cx="6.6" cy="16.8" r="1" />
      <path d="M10 7.2h7.4M10 16.8h7.4" />
    </>
  ),
  gateway: (
    <>
      <path d="M12 2.6 20 6.3v6c0 4.9-3.4 7.9-8 9.1-4.6-1.2-8-4.2-8-9.1v-6z" />
      <path d="M8.4 12h6.3M12.5 9.7 14.9 12l-2.4 2.3" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.8 20.8 7.4v9.2L12 21.2 3.2 16.6V7.4z" />
      <path d="M3.2 7.4 12 12l8.8-4.6M12 12v9.2" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v3.2M12 17.2v3.2M3.6 12h3.2M17.2 12h3.2" />
    </>
  ),
};

function Icon({name, x, y, size = 22, cls}) {
  const s = size / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={clsx(styles.icon, cls)}>
      {ICON[name]}
    </g>
  );
}

/* ---- product marks ------------------------------------------------------ */

/* AWS: the wordmark sitting over its orange smile. */
function AwsMark({x, y, w = 36}) {
  const s = w / 36;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={styles.awsMark}>
      <text x="0" y="15" className={styles.awsWord}>
        aws
      </text>
      <path d="M0.5,21.5 C6,25.6 18.5,26.4 26,22.8" className={styles.awsSmile} />
      <path d="M24.2,19.8 L31,21.4 L26.2,25.9 Z" className={styles.awsArrow} />
    </g>
  );
}

/* Temporal: the brand mark, two crossed leaves tracing an orbit. */
function TemporalMark({cx, cy, size = 26}) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}
      className={styles.temporalMark}
    >
      <path
        d="M12,1 C18,5.6 18,18.4 12,23 C6,18.4 6,5.6 12,1 Z"
        className={styles.temporalLeaf}
      />
      <path
        d="M1,12 C5.6,6 18.4,6 23,12 C18.4,18 5.6,18 1,12 Z"
        className={styles.temporalLeaf}
      />
    </g>
  );
}

/* Redis: the stack of discs. */
function RedisMark({cx, cy, w = 58}) {
  const rx = w / 2;
  const ry = rx * 0.38;
  const gap = ry * 1.35;
  return (
    <g className={styles.redisMark}>
      {[1, 0, -1].map((k) => (
        <g key={k}>
          <ellipse cx={cx} cy={cy + k * gap} rx={rx} ry={ry} fill="url(#ha-g-redis)" />
          <ellipse cx={cx} cy={cy + k * gap} rx={rx} ry={ry} className={styles.discEdge} />
        </g>
      ))}
      <ellipse cx={cx} cy={cy - gap} rx={rx * 0.52} ry={ry * 0.42} className={styles.discGloss} />
    </g>
  );
}

/* Kubernetes: the seven-spoke wheel. */
function K8sMark({cx, cy, size = 34}) {
  const s = size / 24;
  const pts = '12,2.8 19.19,6.27 20.97,14.05 15.99,20.29 8.01,20.29 3.03,14.05 4.81,6.27';
  const spokes = [
    'M12 8.6V5.4',
    'M14.66 9.88 17.16 7.89',
    'M15.31 12.76 18.43 13.47',
    'M13.48 15.06 14.87 17.95',
    'M10.52 15.06 9.13 17.95',
    'M8.69 12.76 5.57 13.47',
    'M9.34 9.88 6.84 7.89',
  ];
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
      <polygon points={pts} className={styles.k8sBody} />
      <circle cx="12" cy="12" r="2.5" className={styles.k8sHub} />
      {spokes.map((d) => (
        <path key={d} d={d} className={styles.k8sSpoke} />
      ))}
    </g>
  );
}

/* A database drum. No boxes for data, since the shape does the labelling. */
function Drum({cx, cy, rx = 34, h = 44, grad, dim, glossCls}) {
  const ry = rx * 0.35;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  return (
    <g className={clsx(styles.drum, dim && styles.dim)}>
      <path
        d={`M${cx - rx},${top} L${cx - rx},${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot} L${cx + rx},${top} Z`}
        fill={`url(#${grad})`}
      />
      <ellipse cx={cx} cy={bot} rx={rx} ry={ry} fill={`url(#${grad})`} />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} className={clsx(styles.drumTop, glossCls)} />
      <ellipse cx={cx} cy={top + h * 0.34} rx={rx} ry={ry} className={styles.drumBand} />
      <ellipse cx={cx} cy={top + h * 0.67} rx={rx} ry={ry} className={styles.drumBand} />
      <path
        d={`M${cx - rx},${top} L${cx - rx},${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot} L${cx + rx},${top}`}
        className={styles.drumEdge}
      />
    </g>
  );
}

/* ---------------------------------------------------------------- parts -- */

function Pill({x, y, label, tone, anchor = 'middle', wf = 6.6}) {
  const w = label.length * wf + 16;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return (
    <g className={clsx(styles.pill, styles[tone])}>
      <rect x={left} y={y - 10} width={w} height={20} rx={10} />
      <text x={left + w / 2} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* An opaque chip that sits on top of a connector so the label never collides. */
function Chip({x, y, label, tone = 'chipTray'}) {
  const w = label.length * 6.8 + 22;
  return (
    <g className={clsx(styles.chip, styles[tone])}>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} />
      <text x={x} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* A service box, drawn as a small stack so "more than one instance" reads.
   The status badge rides above the top-right corner so the title row stays
   free for the name at full size. */
function Service({x, y, w = 180, h = 64, tint, icon, title, sub, badge, badgeTone, dim}) {
  return (
    <g className={clsx(styles.svc, styles[tint], dim && styles.dim)}>
      <rect x={x + 8} y={y - 8} width={w} height={h} rx={13} className={styles.svcGhost} />
      <rect x={x + 4} y={y - 4} width={w} height={h} rx={13} className={styles.svcGhost2} />
      <rect x={x} y={y} width={w} height={h} rx={13} className={styles.svcBody} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h / 2} rx={12} className={styles.svcGloss} />
      <Icon name={icon} x={x + 12} y={y + h / 2 - 11} size={22} cls={styles.svcIcon} />
      <text x={x + 42} y={y + (sub ? 27 : h / 2 + 5)} className={styles.svcTitle}>
        {title}
      </text>
      {sub && (
        <text x={x + 42} y={y + 46} className={styles.svcSub}>
          {sub}
        </text>
      )}
      {badge && <Pill x={x + w - 6} y={y - 12} label={badge} tone={badgeTone} anchor="end" />}
    </g>
  );
}

function Site({x, y, w, h, label, note}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={18} className={styles.regionPrem} />
      <Icon name="rack" x={x + 18} y={y + 16} size={21} cls={styles.siteIcon} />
      <text x={x + 47} y={y + 32} className={styles.regionLabel}>
        {label}
      </text>
      <text x={x + 47} y={y + 48} className={styles.regionNote}>
        {note}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------- diagram --- */

export default function HADiagram() {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 1120 850"
        className={styles.svg}
        role="img"
        aria-label="High-availability topology in three layers, left to right. Layer one, the API layer: One-Data Functions run active in both IPC2 (US East) and IPC1 (US West), each backed by a Redis fallback store, the two replicated active-active with CRDB. Layer two, billpay-core: a core instance in each site, with the read-write Oracle primary and two read-only replicas in IPC2 and a Data Guard standby plus one read-only replica in IPC1. Layer three, on the right: Temporal frontend, history, matching and worker services on an EKS cluster in AWS us-east-1, with a PostgreSQL writer and two read replicas. Both core instances call that cluster over gRPC."
      >
        <defs>
          <linearGradient id="ha-g-oracle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.oraA} />
            <stop offset="1" className={styles.oraB} />
          </linearGradient>
          <linearGradient id="ha-g-oracle-dim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.oraDimA} />
            <stop offset="1" className={styles.oraDimB} />
          </linearGradient>
          <linearGradient id="ha-g-pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.pgA} />
            <stop offset="1" className={styles.pgB} />
          </linearGradient>
          <linearGradient id="ha-g-redis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.redA} />
            <stop offset="1" className={styles.redB} />
          </linearGradient>
          <marker id="ha-m-req" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="6.6" markerHeight="6.6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={styles.mReq} />
          </marker>
          <marker id="ha-m-buf" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="6.6" markerHeight="6.6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={styles.mBuf} />
          </marker>
          <marker id="ha-m-rep" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={styles.mRep} />
          </marker>
        </defs>

        {/* ---- layer headers + dividers ---- */}
        <g className={styles.layerHead}>
          <text x={230} y={32} textAnchor="middle">
            <tspan className={styles.layerNum}>1</tspan>
            <tspan dx="10">API</tspan>
          </text>
          <text x={580} y={32} textAnchor="middle">
            <tspan className={styles.layerNum}>2</tspan>
            <tspan dx="10">BILLPAY CORE</tspan>
          </text>
          <text x={952} y={32} textAnchor="middle">
            <tspan className={styles.layerNum}>3</tspan>
            <tspan dx="10">TEMPORAL</tspan>
          </text>
        </g>
        <path d="M391,46 V782" className={styles.layerDiv} />
        <path d="M780,46 V782" className={styles.layerDiv} />

        {/* ---- the two on-prem sites ---- */}
        <Site x={68} y={56} w={700} h={336} label="US EAST · IPC2" note="on-prem Hydra · write site" />
        <Site x={68} y={430} w={700} h={336} label="US WEST · IPC1" note="on-prem Hydra · read site" />

        {/* ================= layer 1: API ================= */}

        <Icon name="user" x={12} y={159} size={26} cls={styles.userIcon} />
        <text x={25} y={205} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={25} y={218} textAnchor="middle" className={styles.userLabel}>near IPC2</text>
        <path d="M44,172 H162" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Pill x={102} y={150} label="/CreatePayment.v3" tone="pApi" wf={6.1} />
        <Pill x={102} y={194} label="/ReadPayments.v1" tone="pApi" wf={6.1} />
        <Service x={168} y={140} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M258,204 V272" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={272} y={242} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={258} cy={300} w={48} />
        <text x={290} y={296} className={styles.markLabel}>Redis</text>
        <text x={290} y={311} className={styles.markSub}>fallback store</text>

        <Icon name="user" x={12} y={637} size={26} cls={styles.userIcon} />
        <text x={25} y={683} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={25} y={696} textAnchor="middle" className={styles.userLabel}>near IPC1</text>
        <path d="M44,650 H162" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Pill x={102} y={628} label="/CreatePayment.v3" tone="pApi" wf={6.1} />
        <Pill x={102} y={672} label="/ReadPayments.v1" tone="pApi" wf={6.1} />
        <Service x={168} y={618} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M258,618 V550" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={272} y={588} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={258} cy={522} w={48} />
        <text x={290} y={518} className={styles.markLabel}>Redis</text>
        <text x={290} y={533} className={styles.markSub}>fallback store</text>

        <path d="M258,326 V496" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <Chip x={258} y={411} label="CRDB · active-active" tone="chipBuf" />

        {/* ================= layer 2: billpay-core + Oracle ================= */}

        <path d="M348,172 H430" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Chip x={391} y={172} label="/payments" tone="chipReq" />
        <Service x={434} y={140} tint="tCore" icon="cube" title="billpay-core" sub="APIs · Router · Workers" badge="ACTIVE" badgeTone="pOk" />

        <path d="M614,158 H660" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Drum cx={696} cy={172} rx={30} h={38} grad="ha-g-oracle" />
        <text x={696} y={218} textAnchor="middle" className={styles.markLabel}>Oracle</text>
        <text x={696} y={234} textAnchor="middle" className={styles.markSub}>read + write</text>
        <Pill x={696} y={252} label="PRIMARY" tone="pPrimary" />
        <path d="M726,182 H752 V272 H672" className={styles.rep} />
        <path d="M672,272 V285" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <path d="M720,272 V285" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={672} cy={308} rx={21} h={26} grad="ha-g-oracle" />
        <Drum cx={720} cy={308} rx={21} h={26} grad="ha-g-oracle" />
        <text x={696} y={352} textAnchor="middle" className={styles.markSub}>read-only × 2</text>

        <path d="M348,650 H430" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Chip x={391} y={650} label="/payments" tone="chipReq" />
        <Service x={434} y={618} tint="tCore" icon="cube" title="billpay-core" sub="APIs · Router · Workers" badge="ACTIVE" badgeTone="pOk" />

        <path d="M614,664 H660" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Drum cx={696} cy={650} rx={30} h={38} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={696} y={696} textAnchor="middle" className={styles.markLabel}>Oracle</text>
        <text x={696} y={712} textAnchor="middle" className={styles.markSub}>read only</text>
        <Pill x={696} y={730} label="STANDBY" tone="pStandby" />
        <path d="M726,640 H752 V516 H719" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={696} cy={516} rx={21} h={26} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={696} y={554} textAnchor="middle" className={styles.markSub}>read-only</text>

        <path d="M666,180 H626 V642 H662" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Chip x={626} y={470} label="Data Guard" tone="chipRep" />

        {/* ================= layer 3: Temporal on AWS ================= */}

        {/* both cores call the same cluster; the bus hops the Data Guard line */}
        <path
          d="M520,204 V411 H612 Q626,390 640,411 H812 V258 H826"
          className={styles.req}
          markerEnd="url(#ha-m-req)"
        />
        <path d="M520,618 V411" className={styles.req} />
        <circle cx={520} cy={411} r={4} className={styles.junction} />
        <Chip x={566} y={411} label="gRPC" tone="chipReq" />

        <rect x={792} y={56} width={320} height={710} rx={18} className={styles.regionAws} />
        <AwsMark x={812} y={74} w={36} />
        <text x={856} y={90} className={styles.regionLabel}>us-east-1</text>
        <TemporalMark cx={950} cy={88} size={28} />
        <text x={970} y={93} className={styles.regionLabel}>Temporal</text>
        <K8sMark cx={825} cy={136} size={26} />
        <text x={847} y={132} className={styles.regionLabel}>EKS cluster</text>
        <text x={847} y={148} className={styles.regionNote}>self-hosted · pods</text>

        <Service x={830} y={230} w={200} h={56} tint="tTemporal" icon="hub" title="Frontend" />
        <Service x={830} y={306} w={200} h={56} tint="tTemporal" icon="hub" title="History" />
        <Service x={830} y={382} w={200} h={56} tint="tTemporal" icon="hub" title="Matching + Worker" />

        <path d="M1030,258 H1060 V470 H900 V486" className={styles.req} markerEnd="url(#ha-m-req)" />
        <path d="M1030,334 H1060" className={styles.req} />
        <path d="M1030,410 H1060" className={styles.req} />
        <Drum cx={900} cy={510} rx={30} h={40} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={938} y={506} className={styles.markLabel}>Postgres</text>
        <Pill x={938} y={524} label="WRITER" tone="pPrimary" anchor="start" />

        <path d="M900,542 V566 H858 V584" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <path d="M900,566 H942 V584" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={858} cy={612} rx={24} h={30} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <Drum cx={942} cy={612} rx={24} h={30} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={900} y={656} textAnchor="middle" className={styles.markSub}>read replicas × 2</text>

        <text x={812} y={702} className={styles.markSub}>Histories, task queues and schedules live here.</text>
        <text x={812} y={720} className={styles.markSub}>Nothing sits in worker memory.</text>

        {/* ---- legend ---- */}
        <g className={styles.legend}>
          <path d="M20,796 H60" className={styles.req} markerEnd="url(#ha-m-req)" />
          <text x={70} y={800}>request path</text>
          <path d="M190,796 H230" className={styles.buf} markerEnd="url(#ha-m-buf)" />
          <text x={240} y={800}>
            fallback: One-Data parks the request in Redis when billpay-core can&apos;t be reached, then replays it
          </text>
          <path d="M20,826 H60" className={styles.rep} markerEnd="url(#ha-m-rep)" />
          <text x={70} y={830}>replication</text>
          <text x={240} y={830} className={styles.legendMut}>
            dimmed drums are standbys; IPC1&apos;s Oracle is promoted if the east site is lost
          </text>
        </g>
      </svg>
    </div>
  );
}
