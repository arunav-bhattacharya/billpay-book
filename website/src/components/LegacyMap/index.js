import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LegacyMap — the estate Billpay replaced, drawn as a hand-authored SVG.
 * One monolith owning instruments, arrangements and Amex-initiated payments at
 * once; third-party payments in a separate set of applications; and a third
 * application whose only job was to stitch the two histories back together.
 * The crossing paths are the point — a channel had to know which application
 * held the answer. All colour comes from the design tokens.
 */

function Node({x, y, w = 180, h = 50, title, sub, tone, dashed}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className={clsx(styles.node, tone && styles[tone], dashed && styles.dashed)}
      />
      <text x={x + w / 2} y={y + (sub ? 22 : h / 2 + 4.5)} className={styles.nodeTitle}>
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 38} className={styles.nodeSub}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Panel({x, y, w, h, title}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={15} className={styles.panel} />
      <text x={x + w / 2} y={y + 26} className={styles.panelTitle}>
        {title}
      </text>
    </g>
  );
}

export default function LegacyMap() {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox="0 0 1160 620"
        className={styles.svg}
        role="img"
        aria-label="The legacy payments estate. Four channels — Myca, Mobile, IVR and ISP — each call a different application directly, with no shared contract. One Bill Pay monolith owns instruments, arrangements (mandates and autopays) and Amex-initiated payments over a single shared schema. Third-party-initiated payments live in a separate set of applications. A third application, the payment history consolidator, exists only to stitch the Amex-initiated and third-party histories back into one view.">
        <defs>
          <marker
            id="lg-arr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--amex-state-failure)" />
          </marker>
          <marker
            id="lg-arr-mut"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--amex-mut)" />
          </marker>
        </defs>

        {/* ---- channel column ---- */}
        <text x={110} y={86} textAnchor="middle" className={styles.colText}>
          CHANNELS
        </text>
        <Node x={35} y={102} w={150} h={44} title="Myca" tone="channel" />
        <Node x={35} y={172} w={150} h={44} title="Mobile" tone="channel" />
        <Node x={35} y={242} w={150} h={44} title="IVR" tone="channel" />
        <Node x={35} y={312} w={150} h={44} title="ISP" tone="channel" />

        {/* ---- the tangle: every channel reaches a different application ---- */}
        <path d="M185,124 C280,124 300,232 400,232" className={styles.tangle} markerEnd="url(#lg-arr)" />
        <path d="M185,194 C270,194 290,133 400,133" className={styles.tangle} markerEnd="url(#lg-arr)" />
        <path
          d="M185,264 C250,264 250,40 470,40 H900 C960,40 962,90 940,106"
          className={styles.tangle}
          markerEnd="url(#lg-arr)"
        />
        <path
          d="M185,334 C300,334 330,500 610,500"
          className={styles.tangle}
          markerEnd="url(#lg-arr)"
        />
        <text x={352} y={492} className={styles.tangleLabel}>
          asks a third app for history
        </text>
        <text x={520} y={34} className={styles.tangleLabel}>
          third-party push goes somewhere else entirely
        </text>

        {/* ---- the monolith ---- */}
        <Panel x={390} y={62} w={420} h={300} title="Bill Pay Monolith — one deployable" />
        <Node x={412} y={104} w={185} h={58} title="Instruments" sub="funding accounts" tone="mono" />
        <Node
          x={607}
          y={104}
          w={185}
          h={58}
          title="Arrangements"
          sub="mandates & autopays"
          tone="mono"
        />
        <Node
          x={412}
          y={182}
          w={380}
          h={58}
          title="Payments — Amex-initiated"
          sub="lifecycle, execution, history"
          tone="mono"
        />
        <Node
          x={412}
          y={262}
          w={380}
          h={54}
          title="One shared schema"
          sub="three domains, one release train"
          tone="schema"
          dashed
        />

        {/* ---- the third-party estate ---- */}
        <Panel x={862} y={62} w={262} h={230} title="Third-party payments" />
        <Node x={884} y={106} w={218} h={52} title="Inbound Receiver" sub="its own contract" tone="mono" />
        <Node x={884} y={172} w={218} h={52} title="TP Payments App" sub="its own store" tone="mono" />
        <Node x={884} y={238} w={218} h={38} title="…and more" tone="schema" dashed />

        {/* ---- the consolidator ---- */}
        <path d="M602,318 C602,400 610,430 660,470" className={styles.feed} markerEnd="url(#lg-arr-mut)" />
        <path d="M993,296 C993,400 900,440 858,470" className={styles.feed} markerEnd="url(#lg-arr-mut)" />
        <Node
          x={610}
          y={472}
          w={300}
          h={64}
          title="Payment History Consolidator"
          sub="exists only to merge the two"
          tone="consolidator"
        />
        <text x={760} y={562} textAnchor="middle" className={styles.caption}>
          One payment history — assembled after the fact, never owned
        </text>

        {/* ---- legend ---- */}
        <g className={styles.legend}>
          <path d="M40,588 H92" className={styles.tangle} markerEnd="url(#lg-arr)" />
          <text x={102} y={592}>channel calls an application directly — no shared contract</text>
          <path d="M600,588 H652" className={styles.feed} markerEnd="url(#lg-arr-mut)" />
          <text x={662} y={592}>history stitched back together downstream</text>
        </g>
      </svg>
    </div>
  );
}
