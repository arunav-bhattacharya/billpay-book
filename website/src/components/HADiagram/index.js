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

/* AWS: the official mark, path data from the Amazon Web Services logo
   (Wikimedia Commons, viewBox 304x182), vendored at static/img/aws-logo.svg.
   Inlined rather than <image> so the wordmark can take a light fill in dark
   mode: the shipped artwork is navy, which disappears on a dark panel. */
const AWS_PATHS = [
  {kind: 'word', d: 'M86.4,66.4c0,3.7,0.4,6.7,1.1,8.9c0.8,2.2,1.8,4.6,3.2,7.2c0.5,0.8,0.7,1.6,0.7,2.3c0,1-0.6,2-1.9,3l-6.3,4.2 c-0.9,0.6-1.8,0.9-2.6,0.9c-1,0-2-0.5-3-1.4C76.2,90,75,88.4,74,86.8c-1-1.7-2-3.6-3.1-5.9c-7.8,9.2-17.6,13.8-29.4,13.8 c-8.4,0-15.1-2.4-20-7.2c-4.9-4.8-7.4-11.2-7.4-19.2c0-8.5,3-15.4,9.1-20.6c6.1-5.2,14.2-7.8,24.5-7.8c3.4,0,6.9,0.3,10.6,0.8 c3.7,0.5,7.5,1.3,11.5,2.2v-7.3c0-7.6-1.6-12.9-4.7-16c-3.2-3.1-8.6-4.6-16.3-4.6c-3.5,0-7.1,0.4-10.8,1.3c-3.7,0.9-7.3,2-10.8,3.4 c-1.6,0.7-2.8,1.1-3.5,1.3c-0.7,0.2-1.2,0.3-1.6,0.3c-1.4,0-2.1-1-2.1-3.1v-4.9c0-1.6,0.2-2.8,0.7-3.5c0.5-0.7,1.4-1.4,2.8-2.1 c3.5-1.8,7.7-3.3,12.6-4.5c4.9-1.3,10.1-1.9,15.6-1.9c11.9,0,20.6,2.7,26.2,8.1c5.5,5.4,8.3,13.6,8.3,24.6V66.4z M45.8,81.6 c3.3,0,6.7-0.6,10.3-1.8c3.6-1.2,6.8-3.4,9.5-6.4c1.6-1.9,2.8-4,3.4-6.4c0.6-2.4,1-5.3,1-8.7v-4.2c-2.9-0.7-6-1.3-9.2-1.7 c-3.2-0.4-6.3-0.6-9.4-0.6c-6.7,0-11.6,1.3-14.9,4c-3.3,2.7-4.9,6.5-4.9,11.5c0,4.7,1.2,8.2,3.7,10.6 C37.7,80.4,41.2,81.6,45.8,81.6z M126.1,92.4c-1.8,0-3-0.3-3.8-1c-0.8-0.6-1.5-2-2.1-3.9L96.7,10.2c-0.6-2-0.9-3.3-0.9-4 c0-1.6,0.8-2.5,2.4-2.5h9.8c1.9,0,3.2,0.3,3.9,1c0.8,0.6,1.4,2,2,3.9l16.8,66.2l15.6-66.2c0.5-2,1.1-3.3,1.9-3.9c0.8-0.6,2.2-1,4-1 h8c1.9,0,3.2,0.3,4,1c0.8,0.6,1.5,2,1.9,3.9l15.8,67l17.3-67c0.6-2,1.3-3.3,2-3.9c0.8-0.6,2.1-1,3.9-1h9.3c1.6,0,2.5,0.8,2.5,2.5 c0,0.5-0.1,1-0.2,1.6c-0.1,0.6-0.3,1.4-0.7,2.5l-24.1,77.3c-0.6,2-1.3,3.3-2.1,3.9c-0.8,0.6-2.1,1-3.8,1h-8.6c-1.9,0-3.2-0.3-4-1 c-0.8-0.7-1.5-2-1.9-4L156,23l-15.4,64.4c-0.5,2-1.1,3.3-1.9,4c-0.8,0.7-2.2,1-4,1H126.1z M254.6,95.1c-5.2,0-10.4-0.6-15.4-1.8 c-5-1.2-8.9-2.5-11.5-4c-1.6-0.9-2.7-1.9-3.1-2.8c-0.4-0.9-0.6-1.9-0.6-2.8v-5.1c0-2.1,0.8-3.1,2.3-3.1c0.6,0,1.2,0.1,1.8,0.3 c0.6,0.2,1.5,0.6,2.5,1c3.4,1.5,7.1,2.7,11,3.5c4,0.8,7.9,1.2,11.9,1.2c6.3,0,11.2-1.1,14.6-3.3c3.4-2.2,5.2-5.4,5.2-9.5 c0-2.8-0.9-5.1-2.7-7c-1.8-1.9-5.2-3.6-10.1-5.2L246,52c-7.3-2.3-12.7-5.7-16-10.2c-3.3-4.4-5-9.3-5-14.5c0-4.2,0.9-7.9,2.7-11.1 c1.8-3.2,4.2-6,7.2-8.2c3-2.3,6.4-4,10.4-5.2c4-1.2,8.2-1.7,12.6-1.7c2.2,0,4.5,0.1,6.7,0.4c2.3,0.3,4.4,0.7,6.5,1.1 c2,0.5,3.9,1,5.7,1.6c1.8,0.6,3.2,1.2,4.2,1.8c1.4,0.8,2.4,1.6,3,2.5c0.6,0.8,0.9,1.9,0.9,3.3v4.7c0,2.1-0.8,3.2-2.3,3.2 c-0.8,0-2.1-0.4-3.8-1.2c-5.7-2.6-12.1-3.9-19.2-3.9c-5.7,0-10.2,0.9-13.3,2.8c-3.1,1.9-4.7,4.8-4.7,8.9c0,2.8,1,5.2,3,7.1 c2,1.9,5.7,3.8,11,5.5l14.2,4.5c7.2,2.3,12.4,5.5,15.5,9.6c3.1,4.1,4.6,8.8,4.6,14c0,4.3-0.9,8.2-2.6,11.6 c-1.8,3.4-4.2,6.4-7.3,8.8c-3.1,2.5-6.8,4.3-11.1,5.6C264.4,94.4,259.7,95.1,254.6,95.1z'},
  {kind: 'smile', d: 'M273.5,143.7c-32.9,24.3-80.7,37.2-121.8,37.2c-57.6,0-109.5-21.3-148.7-56.7c-3.1-2.8-0.3-6.6,3.4-4.4 c42.4,24.6,94.7,39.5,148.8,39.5c36.5,0,76.6-7.6,113.5-23.2C274.2,133.6,278.9,139.7,273.5,143.7z'},
  {kind: 'smile', d: 'M287.2,128.1c-4.2-5.4-27.8-2.6-38.5-1.3c-3.2,0.4-3.7-2.4-0.8-4.5c18.8-13.2,49.7-9.4,53.3-5 c3.6,4.5-1,35.4-18.6,50.2c-2.7,2.3-5.3,1.1-4.1-1.9C282.5,155.7,291.4,133.4,287.2,128.1z'},
];

function AwsMark({x, y, w = 44}) {
  const h = (w * 182) / 304;
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 304 182" overflow="visible">
      {AWS_PATHS.map((p) => (
        <path
          key={p.d.slice(0, 24)}
          d={p.d}
          className={p.kind === 'word' ? styles.awsWord : styles.awsSmile}
          fillRule={p.kind === 'smile' ? 'evenodd' : undefined}
        />
      ))}
    </svg>
  );
}

/* Temporal: two crossed ellipses, one tall and one wide, tracing a four-point
   orbit. Outline only, no centre. */
function TemporalMark({cx, cy, size = 28}) {
  const s = size / 32;
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
      <ellipse cx="16" cy="16" rx="5.3" ry="14" className={styles.temporalRing} />
      <ellipse cx="16" cy="16" rx="14" ry="5.3" className={styles.temporalRing} />
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

/* Kubernetes: the blue heptagon with the ship's helm inside. Seven spokes off
   a hub, a ring around them, and seven handle pegs poking out past the ring,
   each peg lined up with a spoke. Generated round the circle rather than
   hand-listed, so the sevenfold symmetry is exact. */
function K8sMark({cx, cy, size = 34}) {
  const s = size / 24;
  const pts = '12,2.6 19.5,6.2 21.36,14.3 16.16,20.8 7.84,20.8 2.64,14.3 4.5,6.2';
  const wheel = {x: 12, y: 12.4};
  const arms = Array.from({length: 7}, (_, i) => {
    const a = ((-90 + i * (360 / 7)) * Math.PI) / 180;
    const at = (r) => `${(wheel.x + r * Math.cos(a)).toFixed(2)},${(wheel.y + r * Math.sin(a)).toFixed(2)}`;
    return {spoke: `M${at(1.7)} L${at(5.5)}`, peg: `M${at(6.1)} L${at(7.5)}`};
  });
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
      <polygon points={pts} className={styles.k8sBody} />
      <circle cx={wheel.x} cy={wheel.y} r="5.9" className={styles.k8sRing} />
      {arms.map((a) => (
        <path key={a.spoke} d={a.spoke} className={styles.k8sSpoke} />
      ))}
      {arms.map((a) => (
        <path key={a.peg} d={a.peg} className={styles.k8sPeg} />
      ))}
      <circle cx={wheel.x} cy={wheel.y} r="1.55" className={styles.k8sHub} />
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

function Pill({x, y, label, tone, anchor = 'middle', wf = 7.5}) {
  const w = label.length * wf + 18;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return (
    <g className={clsx(styles.pill, styles[tone])}>
      <rect x={left} y={y - 11} width={w} height={22} rx={11} />
      <text x={left + w / 2} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* An opaque chip that sits on top of a connector so the label never collides. */
function Chip({x, y, label, tone = 'chipTray'}) {
  const w = label.length * 7.8 + 24;
  return (
    <g className={clsx(styles.chip, styles[tone])}>
      <rect x={x - w / 2} y={y - 12} width={w} height={24} rx={12} />
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
        aria-label="High-availability topology, two estates side by side. Left, in Amex blue, the on-prem Hydra sites: US East IPC2 is the write site, with a caller reaching the One-Data gateway, then billpay-core, then the read-write Oracle primary and two read-only replicas, and a Redis fallback store under One-Data. US West IPC1 is the read site, laid out the same way but with the Data Guard Oracle standby and one read-only replica. The two Redis stores replicate active-active over CRDB. Both billpay-core instances share a gRPC bus out to the cloud. Right, in AWS orange, the AWS estate, holding a violet Temporal group: us-east-1 is the active region, with Frontend, History and Matching plus Worker services on a self-hosted EKS cluster, a PostgreSQL writer and two read replicas; us-west-1 below it is a passive standby whose PostgreSQL is replicated from the east and promoted by hand."
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
        <text x={92} y={99} className={styles.groupNote}>on-prem</text>

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
        <Icon name="user" x={79} y={236} size={26} cls={styles.userIcon} />
        <text x={92} y={284} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={92} y={297} textAnchor="middle" className={styles.userLabel}>near IPC2</text>
        <path d="M112,250 H204" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Service x={210} y={218} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M300,282 V330" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={314} y={310} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={300} cy={362} w={46} />
        <text x={334} y={358} className={styles.markLabel}>Redis</text>
        <text x={334} y={373} className={styles.markSub}>fallback store</text>

        <path d="M390,250 H470" className={styles.req} markerEnd="url(#ha-m-req)" />
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
        <Icon name="user" x={79} y={602} size={26} cls={styles.userIcon} />
        <text x={92} y={650} textAnchor="middle" className={styles.userLabel}>caller</text>
        <text x={92} y={663} textAnchor="middle" className={styles.userLabel}>near IPC1</text>
        <path d="M112,616 H204" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Service x={210} y={584} tint="tGw" icon="gateway" title="One-Data" sub="API gateway" badge="ACTIVE" badgeTone="pOk" />

        <path d="M300,580 V550" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <text x={314} y={556} className={styles.bufLabel}>park + replay</text>
        <RedisMark cx={300} cy={526} w={46} />
        <text x={334} y={522} className={styles.markLabel}>Redis</text>
        <text x={334} y={537} className={styles.markSub}>fallback store</text>

        {/* the two Redis stores are one active-active database */}
        <path d="M300,382 V500" className={styles.buf} markerEnd="url(#ha-m-buf)" markerStart="url(#ha-m-buf)" />
        <Chip x={300} y={441} label="CRDB · active-active" tone="chipBuf" />

        <path d="M390,616 H470" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Service x={474} y={584} w={200} tint="tCore" icon="cube" title="billpay-core" sub="APIs · Router · Workers" badge="ACTIVE" badgeTone="pOk" />

        <path d="M682,606 H716" className={styles.req} markerEnd="url(#ha-m-req)" />
        <Drum cx={752} cy={616} rx={30} h={38} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={752} y={662} textAnchor="middle" className={styles.markLabel}>Oracle</text>
        <text x={752} y={678} textAnchor="middle" className={styles.markSub}>read only</text>
        <Pill x={752} y={698} label="STANDBY" tone="pStandby" />
        <path d="M782,612 H852" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={880} cy={618} rx={20} h={26} grad="ha-g-oracle-dim" glossCls={styles.drumTopDim} />
        <text x={880} y={666} textAnchor="middle" className={styles.markSub}>read-only</text>

        {/* Data Guard runs down the left of the Oracle column, at x=700: the
            drums start at 722, so this is the clear lane between them and
            billpay-core. The gRPC bus hops over it in the gap. */}
        <path d="M722,258 H700 V608 H716" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Chip x={700} y={506} label="Data Guard" tone="chipRep" />

        {/* ================= the gRPC bus out to the cloud ================= */}

        <path d="M574,282 V433" className={styles.req} />
        <path d="M574,584 V433" className={styles.req} />
        <circle cx={574} cy={433} r={4} className={styles.junction} />
        {/* one continuous run, hopping the Data Guard line at x=700 rather than
            breaking for it: a gap in a request path reads as a gap in the path */}
        <path
          d="M574,433 H686 Q700,412 714,433 H1050 V316 H1118"
          className={styles.req}
          markerEnd="url(#ha-m-req)"
        />
        <Chip x={880} y={433} label="gRPC" tone="chipReq" />

        {/* ================= the AWS estate ================= */}

        <rect x={1076} y={52} width={536} height={712} rx={22} className={styles.groupAws} />
        <AwsMark x={1096} y={66} w={56} />

        <rect x={1094} y={118} width={500} height={630} rx={18} className={styles.groupTemporal} />
        <TemporalMark cx={1128} cy={148} size={34} />
        <text x={1152} y={153} className={styles.groupLabel}>TEMPORAL</text>

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

        {/* The three services are pods on one cluster, so they get a box of
            their own in Kubernetes blue. Postgres sits outside it: it is a
            managed database, not something running on the cluster. */}
        <rect x={1122} y={236} width={218} height={236} rx={14} className={styles.groupEks} />
        <K8sMark cx={1146} cy={258} size={26} />
        <text x={1166} y={256} className={styles.markLabel}>EKS cluster</text>
        <text x={1166} y={270} className={styles.markSub}>self-hosted · pods</text>

        <Service x={1130} y={292} w={190} h={48} tint="tTemporal" icon="hub" title="Frontend" />
        <Service x={1130} y={352} w={190} h={48} tint="tTemporal" icon="hub" title="History" />
        <Service x={1130} y={412} w={190} h={48} tint="tTemporal" icon="hub" title="Matching + Worker" />

        <path d="M1328,316 H1362" className={styles.req} />
        <path d="M1328,376 H1362" className={styles.req} />
        <path d="M1328,436 H1362" className={styles.req} />
        <path d="M1362,316 V436" className={styles.req} />
        <path d="M1362,376 H1414" className={styles.req} markerEnd="url(#ha-m-req)" />

        <Drum cx={1450} cy={376} rx={30} h={40} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={1490} y={372} className={styles.markLabel}>Postgres</text>
        <Pill x={1490} y={392} label="WRITER" tone="pPrimary" anchor="start" />
        <path d="M1450,398 V446 H1416 V469" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <path d="M1450,446 H1484 V469" className={styles.rep} markerEnd="url(#ha-m-rep)" />
        <Drum cx={1416} cy={488} rx={20} h={26} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <Drum cx={1484} cy={488} rx={20} h={26} grad="ha-g-pg" glossCls={styles.drumTopPg} />
        <text x={1450} y={530} textAnchor="middle" className={styles.markSub}>read replicas × 2</text>

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
        <path d="M1420,376 H1380 V680 H1214" className={styles.rep} markerEnd="url(#ha-m-rep)" />
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
