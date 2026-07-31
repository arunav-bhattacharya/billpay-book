import React from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/**
 * HADiagram: the high-availability topology as two owned estates side by side.
 * Left, in Amex blue, the two on-prem Hydra sites. Right, in AWS orange, the
 * cloud, with everything Temporal inside a violet group of its own.
 *
 * Laid out wide rather than tall on purpose. The canvas scales to the column,
 * so a portrait canvas renders taller than the viewport and the reader has to
 * scroll a diagram whose whole point is to be seen at once. At roughly 16:9
 * it lands around half the viewport height in a normal doc column.
 *
 * Hand-authored SVG: the product marks carry their own brand colours and
 * everything else comes from the design tokens, so light and dark both render.
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

/* Amex: the real logo, the one already shipping as the site favicon. */
function AmexMark({x, y, size = 34}) {
  const src = useBaseUrl('/img/amex-logo.png');
  return <image href={src} x={x} y={y} width={size} height={size} className={styles.amexMark} />;
}

/* AWS: the lowercase wordmark over its orange smile-arrow. Hand-drawn to the
   shape of the mark rather than the official asset, which is trademarked and
   not vendored here. */
function AwsMark({x, y, w = 44}) {
  const s = w / 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <text x="0" y="17" className={styles.awsWord}>
        aws
      </text>
      <path
        d="M1,25.5 C10,32.2 27,33 38,26.4"
        className={styles.awsSmile}
      />
      <path d="M34.6,22.6 L42.5,24.2 L37.2,30.2 Z" className={styles.awsArrow} />
    </g>
  );
}

/* Temporal: the orbit motif, two rings crossing a filled core. Same caveat as
   the AWS mark, drawn to the shape rather than vendored. */
function TemporalMark({cx, cy, size = 28}) {
  const s = size / 32;
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
      <ellipse cx="16" cy="16" rx="14.5" ry="7" className={styles.temporalRing} />
      <ellipse
        cx="16"
        cy="16"
        rx="14.5"
        ry="7"
        className={styles.temporalRing}
        transform="rotate(60 16 16)"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="14.5"
        ry="7"
        className={styles.temporalRing}
        transform="rotate(120 16 16)"
      />
      <circle cx="16" cy="16" r="4.4" className={styles.temporalCore} />
    </g>
  );
}

/* Redis: the stack of discs. */
function RedisMark({cx, cy, w = 58}) {
  const rx = w / 2;
  const ry = rx * 0.38;
  const gap = ry * 1.35;
  return (
    <g>
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

/* A service box, drawn as a small stack so "more than one instance" reads. */
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

/* A site or region inside one of the owner groups. */
function Region({x, y, w, h, cls, label, note, icon}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={16} className={cls} />
      {icon}
      <text x={x + (icon ? 40 : 20)} y={y + 26} className={styles.regionLabel}>
        {label}
      </text>
      {note && (
        <text x={x + (icon ? 40 : 20)} y={y + 43} className={styles.regionNote}>
          {note}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------- diagram --- */

export default function HADiagram() {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 1640 880"
        className={styles.svg}
        role="img"
        aria-label="High-availability topology, two estates side by side. Left, in Amex blue, the on-prem Hydra sites: US East IPC2 is the write site, with a caller reaching One-Data, then billpay-core, then the read-write Oracle primary and two read-only replicas, and a Redis fallback store under One-Data. US West IPC1 is the read site, laid out the same way but with the Data Guard Oracle standby and one read-only replica. The two Redis stores replicate active-active over CRDB. Both billpay-core instances share a gRPC bus out to the cloud. Right, in AWS orange, the AWS estate, holding a violet Temporal group: us-east-1 is the active region, with Frontend, History and Matching plus Worker services on a self-hosted EKS cluster, a PostgreSQL writer and two read replicas; us-west-1 below it is a passive standby whose PostgreSQL is replicated from the east and promoted by hand."
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

        {/* ================= the Amex estate ================= */}

        <rect x={28} y={52} width={1012} height={712} rx={22} className={styles.groupAmex} />
        <AmexMark x={48} y={66} size={32} />
        <text x={92} y={82} className={styles.groupLabel}>AMERICAN EXPRESS</text>
        <text x={92} y={99} className={styles.groupNote}>on-prem Hydra sites</text>

        <Region
          x={46}
          y={118}
          w={976}
          h={296}
          cls={styles.regionPrem}
          label="US EAST · IPC2"
          note="write site"
          icon={<Icon name="rack" x={62} y={128} size={20} cls={styles.siteIcon} />}
        />
        <Region
          x={46}
          y={452}
          w={976}
          h={296}
          cls={styles.regionPrem}
          label="US WEST · IPC1"
          note="read site"
          icon={<Icon name="rack" x={62} y={462} size={20} cls={styles.siteIcon} />}
        />

        {/* ---- east site ---- */}
        <Icon name="user" x={58} y={236} size={26} cls={styles.userIcon} />
        <text x={71} y={284} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={71} y={297} textAnchor="middle" className={styles.userLabel}>near IPC2</text>
        <path d="M92,250 H204" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Pill x={140} y={228} label="/CreatePayment.v3" tone="pApi" wf={6.1} />
        <Pill x={140} y={272} label="/ReadPayments.v1" tone="pApi" wf={6.1} />
        <Service x={210} y={218} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M300,282 V330" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={314} y={310} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={300} cy={362} w={46} />
        <text x={334} y={358} className={styles.markLabel}>Redis</text>
        <text x={334} y={373} className={styles.markSub}>fallback store</text>

        <path d="M390,250 H470" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Chip x={430} y={250} label="/payments" tone="chipReq" />
        <Service x={474} y={218} w={200} tint="tCore" icon="cube" title="billpay-core" sub="APIs · Router · Workers" badge="ACTIVE" badgeTone="pOk" />

        <path d="M682,240 H716" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Drum cx={752} cy={250} rx={30} h={38} grad="ha-g-oracle" />
        <text x={752} y={296} textAnchor="middle" className={styles.markLabel}>Oracle</text>
        <text x={752} y={312} textAnchor="middle" className={styles.markSub}>read + write</text>
        <Pill x={752} y={332} label="PRIMARY" tone="pPrimary" />
        <path d="M782,246 H852" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={880} cy={252} rx={20} h={26} grad="ha-g-oracle" />
        <Drum cx={946} cy={252} rx={20} h={26} grad="ha-g-oracle" />
        <text x={913} y={300} textAnchor="middle" className={styles.markSub}>read-only × 2</text>

        {/* ---- west site ---- */}
        <Icon name="user" x={58} y={570} size={26} cls={styles.userIcon} />
        <text x={71} y={618} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={71} y={631} textAnchor="middle" className={styles.userLabel}>near IPC1</text>
        <path d="M92,584 H204" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Pill x={140} y={562} label="/CreatePayment.v3" tone="pApi" wf={6.1} />
        <Pill x={140} y={606} label="/ReadPayments.v1" tone="pApi" wf={6.1} />
        <Service x={210} y={552} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M300,616 V664" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={314} y={644} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={300} cy={696} w={46} />
        <text x={334} y={692} className={styles.markLabel}>Redis</text>
        <text x={334} y={707} className={styles.markSub}>fallback store</text>

        {/* the two Redis stores are one active-active database */}
        <path d="M300,382 V676" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <Chip x={300} y={529} label="CRDB · active-active" tone="chipBuf" />

        <path d="M390,584 H470" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Chip x={430} y={584} label="/payments" tone="chipReq" />
        <Service x={474} y={552} w={200} tint="tCore" icon="cube" title="billpay-core" sub="APIs · Router · Workers" badge="ACTIVE" badgeTone="pOk" />

        <path d="M682,574 H716" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Drum cx={752} cy={584} rx={30} h={38} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={752} y={630} textAnchor="middle" className={styles.markLabel}>Oracle</text>
        <text x={752} y={646} textAnchor="middle" className={styles.markSub}>read only</text>
        <Pill x={752} y={666} label="STANDBY" tone="pStandby" />
        <path d="M782,580 H852" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={880} cy={586} rx={20} h={26} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={880} y={634} textAnchor="middle" className={styles.markSub}>read-only</text>

        {/* Data Guard runs down the left of the Oracle column, at x=700: the
            drums start at 722, so this is the clear lane between them and
            billpay-core. The gRPC bus hops over it in the gap. */}
        <path d="M722,258 H700 V576 H716" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Chip x={700} y={506} label="Data Guard" tone="chipRep" />

        {/* ================= the gRPC bus out to the cloud ================= */}

        <path d="M574,282 V433" className={styles.req} />
        <path d="M574,552 V433" className={styles.req} />
        <circle cx={574} cy={433} r={4} className={styles.junction} />
        {/* one continuous run, hopping the Data Guard line at x=700 rather than
            breaking for it: a gap in a request path reads as a gap in the path */}
        <path
          d="M574,433 H686 Q700,412 714,433 H1050 V310 H1122"
          className={styles.req}
          markerEnd="url(#ha-m-req)"
        />
        <Chip x={880} y={433} label="gRPC" tone="chipReq" />

        {/* ================= the AWS estate ================= */}

        <rect x={1076} y={52} width={536} height={712} rx={22} className={styles.groupAws} />
        <AwsMark x={1096} y={62} w={42} />

        <rect x={1094} y={118} width={500} height={630} rx={18} className={styles.groupTemporal} />
        <TemporalMark cx={1126} cy={146} size={26} />
        <text x={1148} y={151} className={styles.groupLabel}>TEMPORAL</text>

        {/* ---- us-east-1, the active region ---- */}
        <Region
          x={1110}
          y={180}
          w={468}
          h={372}
          cls={styles.regionAws}
          label="us-east-1"
          note="active cluster"
        />
        <Pill x={1560} y={206} label="ACTIVE" tone="pOk" anchor="end" />

        <K8sMark cx={1146} cy={252} size={24} />
        <text x={1166} y={250} className={styles.markLabel}>EKS cluster</text>
        <text x={1166} y={265} className={styles.markSub}>self-hosted · pods</text>

        <Service x={1130} y={286} w={190} h={48} tint="tTemporal" icon="hub" title="Frontend" />
        <Service x={1130} y={346} w={190} h={48} tint="tTemporal" icon="hub" title="History" />
        <Service x={1130} y={406} w={190} h={48} tint="tTemporal" icon="hub" title="Matching + Worker" />

        <path d="M1328,310 H1360" className={styles.req} />
        <path d="M1328,370 H1360" className={styles.req} />
        <path d="M1328,430 H1360" className={styles.req} />
        <path d="M1360,310 V430" className={styles.req} />
        <path d="M1360,370 H1414" className={styles.req} markerEnd="url(#ha-m-req)" />

        <Drum cx={1450} cy={370} rx={30} h={40} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={1490} y={366} className={styles.markLabel}>Postgres</text>
        <Pill x={1490} y={386} label="WRITER" tone="pPrimary" anchor="start" />
        <path d="M1450,392 V440 H1416 V463" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <path d="M1450,440 H1484 V463" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={1416} cy={482} rx={20} h={26} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <Drum cx={1484} cy={482} rx={20} h={26} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={1450} y={524} textAnchor="middle" className={styles.markSub}>read replicas × 2</text>

        {/* ---- us-west-1, the passive region ---- */}
        <Region
          x={1110}
          y={580}
          w={468}
          h={150}
          cls={styles.regionAws}
          label="us-west-1"
          note="passive standby"
        />
        <Pill x={1560} y={606} label="STANDBY" tone="pStandby" anchor="end" />

        {/* down x=1380: the replicas reach 1436 on one side and the "read
            replicas" label starts at 1400, so this is the clear lane. */}
        <path d="M1420,370 H1380 V680 H1214" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={1180} cy={680} rx={28} h={36} grad="ha-g-pg" dim glossCls={styles.drumTopDim} />
        <text x={1230} y={700} className={styles.markSub}>Replicated from the east. Promoted by hand.</text>

        {/* ---- legend ---- */}
        <g className={styles.legend}>
          <path d="M40,812 H80" className={styles.req} markerEnd="url(#ha-m-req)" />
          <text x={90} y={816}>request path</text>
          <path d="M210,812 H250" className={styles.buf} markerEnd="url(#ha-m-buf)" />
          <text x={260} y={816}>
            fallback: One-Data parks the request in Redis when billpay-core can&apos;t be reached, then replays it
          </text>
          <path d="M40,846 H80" className={styles.rep} markerEnd="url(#ha-m-rep)" />
          <text x={90} y={850}>replication</text>
          <text x={260} y={850} className={styles.legendMut}>
            dimmed drums are standbys; IPC1&apos;s Oracle and the us-west-1 Temporal cluster are both promoted by hand
          </text>
        </g>
      </svg>
    </div>
  );
}
