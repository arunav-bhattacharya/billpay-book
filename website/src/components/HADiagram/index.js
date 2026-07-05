import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * HADiagram — the high-availability topology as a hand-drawn, theme-aware SVG.
 * Two on-prem Hydra sites (IPC2 east / IPC1 west) over two AWS regions
 * (us-east-1 / us-west-1), with request, buffer, and replication flows.
 * All colour comes from the design tokens, so light and dark both render.
 */

const BADGE_TONE = {
  active: styles.bActive,
  aa: styles.bAa,
  primary: styles.bPrimary,
  standby: styles.bStandby,
};

function Badge({x, y, label, tone}) {
  const w = label.length * 6.4 + 14;
  return (
    <g className={clsx(styles.badge, BADGE_TONE[tone])}>
      <rect x={x - w} y={y} width={w} height={18} rx={9} />
      <text x={x - w / 2} y={y + 12.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function Node({x, y, w = 200, h = 62, rx = 12, title, sub, badge, tone, faded, capsule}) {
  return (
    <g className={faded ? styles.faded : undefined}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={capsule ? h / 2 : rx}
        className={clsx(styles.node, capsule && styles.capsule)}
      />
      <text x={x + (capsule ? 24 : 14)} y={y + (sub ? 27 : h / 2 + 5)} className={styles.nodeTitle}>
        {title}
      </text>
      {sub && (
        <text x={x + (capsule ? 24 : 14)} y={y + 45} className={styles.nodeSub}>
          {sub}
        </text>
      )}
      {badge && <Badge x={x + w - 10} y={y + 10} label={badge} tone={tone} />}
    </g>
  );
}

function Panel({x, y, w, h, title, cloud}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={16}
        className={cloud ? styles.panelAws : styles.panelPrem}
      />
      <text x={x + 18} y={y + 27} className={styles.panelTitle}>
        {title}
      </text>
    </g>
  );
}

export default function HADiagram() {
  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 1240 880" className={styles.svg} role="img"
        aria-label="High-availability topology: One-Data Functions active-active across IPC2 and IPC1 with a shared Redis buffer; billpay-core active on IPC2 with a passive on IPC1; Oracle primary on IPC2 replicated to IPC1 via Data Guard; Temporal self-hosted on AWS us-east-1 with a passive us-west-1.">
        <defs>
          <marker id="ha-arr-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--amex-blue)" />
          </marker>
          <marker id="ha-arr-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--amex-state-choice)" />
          </marker>
          <marker id="ha-arr-slate" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--amex-mut)" />
          </marker>
        </defs>

        {/* site headers */}
        <text x={290} y={44} textAnchor="middle" className={styles.siteText}>US EAST</text>
        <text x={950} y={44} textAnchor="middle" className={styles.siteText}>US WEST</text>

        {/* panels */}
        <Panel x={40} y={60} w={500} h={330} title="On-prem · Hydra — IPC2" />
        <Panel x={700} y={60} w={500} h={330} title="On-prem · Hydra — IPC1" />
        <Panel x={40} y={560} w={500} h={210} title="AWS — us-east-1" cloud />
        <Panel x={700} y={560} w={500} h={210} title="AWS — us-west-1" cloud />

        {/* ---- flows (drawn under the nodes' labels but over panels) ---- */}
        {/* ODF-E -> core-E */}
        <path d="M180,174 V226" className={styles.flow} markerEnd="url(#ha-arr-blue)" />
        {/* ODF-W -> core-E (west traffic routes east) */}
        <path d="M870,174 V204 H240 V226" fill="none" className={styles.flow} markerEnd="url(#ha-arr-blue)" />
        <text x={555} y={197} textAnchor="middle" className={styles.flowLabel}>routes to the active core</text>
        {/* ODF-E <-> Redis */}
        <path d="M280,143 H490" className={styles.buffer} markerEnd="url(#ha-arr-gold)" markerStart="url(#ha-arr-gold)" />
        <text x={385} y={133} textAnchor="middle" className={styles.bufferLabel}>buffer / replay</text>
        {/* ODF-W <-> Redis */}
        <path d="M820,143 H750" className={styles.buffer} markerEnd="url(#ha-arr-gold)" markerStart="url(#ha-arr-gold)" />
        {/* core-E -> Oracle-E */}
        <path d="M180,288 V341 H330" fill="none" className={styles.flow} markerEnd="url(#ha-arr-blue)" />
        {/* core-E -> Temporal-E */}
        <path d="M120,288 V608" className={styles.flow} markerEnd="url(#ha-arr-blue)" />
        <text x={134} y={480} className={styles.flowLabel}>gRPC · default connection</text>
        {/* core-E -> core-W failover */}
        <path d="M280,257 H820" className={styles.repl} markerEnd="url(#ha-arr-slate)" />
        <text x={550} y={249} textAnchor="middle" className={styles.replLabel}>fails over to</text>
        {/* Oracle Data Guard */}
        <path d="M520,341 H990" className={styles.repl} markerEnd="url(#ha-arr-slate)" />
        <text x={755} y={333} textAnchor="middle" className={styles.replLabel}>Data Guard replication</text>
        {/* Temporal replication */}
        <path d="M410,656 H820" className={styles.repl} markerEnd="url(#ha-arr-slate)" />
        <text x={615} y={646} textAnchor="middle" className={styles.replLabel}>replicated · manual promotion</text>

        {/* ---- nodes ---- */}
        {/* East IPC2 */}
        <Node x={80} y={112} title="One-Data Functions" sub="API gateway" badge="ACTIVE" tone="active" />
        <Node x={80} y={226} title="billpay-core" sub="APIs · Router · Worker App" badge="ACTIVE" tone="active" />
        <Node x={330} y={310} w={190} title="Oracle DB" sub="payments schema" badge="PRIMARY" tone="primary" />
        {/* West IPC1 */}
        <Node x={820} y={112} title="One-Data Functions" sub="API gateway" badge="ACTIVE" tone="active" />
        <Node x={820} y={226} title="billpay-core" sub="promoted on failover" badge="PASSIVE" tone="standby" faded />
        <Node x={990} y={310} w={190} title="Oracle DB" sub="Data Guard standby" badge="STANDBY" tone="standby" faded />
        {/* Redis bridge */}
        <Node x={490} y={117} w={260} h={52} capsule title="Redis" badge="ACTIVE-ACTIVE" tone="aa" />
        {/* AWS */}
        <Node x={110} y={608} w={300} h={96} title="Temporal Server" sub="self-hosted · PostgreSQL persistence" badge="ACTIVE" tone="active" />
        <Node x={820} y={608} w={300} h={96} title="Temporal Server" sub="standby · replicated PostgreSQL" badge="PASSIVE" tone="standby" faded />

        {/* ---- legend ---- */}
        <g className={styles.legend}>
          <path d="M60,812 H110" className={styles.flow} markerEnd="url(#ha-arr-blue)" />
          <text x={120} y={816}>request path</text>
          <path d="M300,812 H350" className={styles.buffer} markerEnd="url(#ha-arr-gold)" />
          <text x={360} y={816}>store-and-forward — used only while billpay-core is down; One-Data replays on recovery</text>
          <path d="M60,848 H110" className={styles.repl} markerEnd="url(#ha-arr-slate)" />
          <text x={120} y={852}>replication / failover</text>
        </g>
      </svg>
    </div>
  );
}
