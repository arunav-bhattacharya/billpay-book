import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * OnboardingPaths: the four onboarding paths and where they meet, in the
 * house build (filled cards on the panel, the house number badge, no
 * outlines), read left to right.
 *
 * Paths 1 to 3 sit in a column on the left, each with an example. They join
 * at one question, whether every behavior combination is in the build's
 * manifest. Yes runs straight on to approval; no drops to path 4, a build
 * through the deploy pipeline, which rises back into approval. From there one
 * frozen release moves through E1, E2 and E3, and for a new profile the
 * channels start sending.
 *
 * Coordinates are hand-placed on a 700 x 258 canvas. Takes no props.
 */

const W = 700;
const H = 258;

const PATHS = [
  {n: 1, y: 10, title: 'A new market', sub: 'DE consumer'},
  {n: 2, y: 92, title: 'A new account type', sub: 'US corporate, in a live US'},
  {n: 3, y: 174, title: 'A change to a profile', sub: 'raise the largest payment'},
];
const PATH_X = 10;
const PATH_W = 176;
const PATH_H = 70;

const Q = {x: 214, y: 106, w: 92, h: 42}; // the manifest question
const QY = Q.y + Q.h / 2;
const APPROVE = {x: 340, y: 98, w: 100, h: 58};
const BUILD = {x: 316, y: 188, w: 136, h: 58};
const ENVS = {x: 456, y: 98, w: 128, h: 58};
const LIVE = {x: 598, y: 98, w: 92, h: 58};

const LABEL =
  'The four onboarding paths. On the left, three ways in: path 1, a new market, such as DE consumer; path 2, a new account type in a live market, such as US corporate beside US consumer; path 3, a change to a live profile, such as raising the largest payment. All three meet at one question: is every behavior combination in the build\'s capability manifest? If yes, the profile goes straight to approval, where it is frozen as release vN. If no, path 4 comes first: a build ships through the deploy pipeline, and then the release is approved. One release then moves through E1, then E2, then E3, with test payments, sign-off and activation in each, and the RFC in E3. For paths 1 and 2, the channels then start sending traffic.';

function Card({x, y, w, h, n, title, sub, tone}) {
  return (
    <g className={styles[`t_${tone}`]}>
      <rect x={x} y={y} width={w} height={h} rx={10} className={styles.card} />
      {n != null && (
        <>
          <rect x={x + 14} y={y + 14} width={18} height={18} rx={4} className={styles.num} />
          <text x={x + 23} y={y + 27.2} textAnchor="middle" className={styles.numText}>
            {n}
          </text>
        </>
      )}
      <text x={x + (n != null ? 40 : 14)} y={y + 28} className={styles.title}>
        {title}
      </text>
      {[].concat(sub).map((line, i) => (
        <text key={line} x={x + 14} y={y + 49 + i * 14} className={styles.sub}>
          {line}
        </text>
      ))}
    </g>
  );
}

export default function OnboardingPaths() {
  const joinX = Q.x - 14;
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="op-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.head} />
            </marker>
          </defs>

          {/* the three ways in, joining at the question */}
          {PATHS.map((p) => {
            const cy = p.y + PATH_H / 2;
            const turn = cy === QY ? `H${Q.x}` : `H${joinX - 6} Q${joinX},${cy} ${joinX},${cy + (QY > cy ? 6 : -6)} V${QY + (QY > cy ? -6 : 6)} Q${joinX},${QY} ${joinX + 6},${QY} H${Q.x}`;
            return (
              <g key={p.n}>
                <Card x={PATH_X} y={p.y} w={PATH_W} h={PATH_H} n={p.n} title={p.title} sub={p.sub} tone="path" />
                <path d={`M${PATH_X + PATH_W},${cy} ${turn}`} className={styles.line} markerEnd={cy === QY ? 'url(#op-head)' : undefined} />
              </g>
            );
          })}

          {/* the question */}
          <rect x={Q.x} y={Q.y} width={Q.w} height={Q.h} rx={21} className={styles.question} />
          <text x={Q.x + Q.w / 2} y={QY - 3} textAnchor="middle" className={styles.qText}>
            In the build&apos;s
          </text>
          <text x={Q.x + Q.w / 2} y={QY + 11} textAnchor="middle" className={styles.qText}>
            manifest?
          </text>

          {/* yes: straight on to approval */}
          <path d={`M${Q.x + Q.w},${QY} H${APPROVE.x}`} className={styles.line} markerEnd="url(#op-head)" />
          <text x={(Q.x + Q.w + APPROVE.x) / 2} y={QY - 7} textAnchor="middle" className={clsx(styles.branch, styles.yes)}>
            yes
          </text>

          {/* no: path 4, then back up into approval */}
          <path d={`M${Q.x + Q.w / 2},${Q.y + Q.h} V${BUILD.y + BUILD.h / 2 - 6} Q${Q.x + Q.w / 2},${BUILD.y + BUILD.h / 2} ${Q.x + Q.w / 2 + 6},${BUILD.y + BUILD.h / 2} H${BUILD.x}`} className={styles.line} markerEnd="url(#op-head)" />
          <text x={Q.x + Q.w / 2 + 8} y={Q.y + Q.h + 22} className={clsx(styles.branch, styles.no)}>
            no
          </text>
          <Card x={BUILD.x} y={BUILD.y} w={BUILD.w} h={BUILD.h} n={4} title="A build first" sub="through the pipeline" tone="build" />
          <path d={`M${APPROVE.x + APPROVE.w / 2 + 20},${BUILD.y} V${APPROVE.y + APPROVE.h}`} className={styles.line} markerEnd="url(#op-head)" />

          {/* one frozen release, through the environments */}
          <Card x={APPROVE.x} y={APPROVE.y} w={APPROVE.w} h={APPROVE.h} title="Approve" sub="frozen as vN" tone="step" />
          <path d={`M${APPROVE.x + APPROVE.w},${QY} H${ENVS.x}`} className={styles.line} markerEnd="url(#op-head)" />

          <rect x={ENVS.x} y={ENVS.y} width={ENVS.w} height={ENVS.h} rx={10} className={styles.envCard} />
          {['E1', 'E2', 'E3'].map((e, i) => {
            const bx = ENVS.x + 12 + i * 36;
            return (
              <g key={e}>
                <rect x={bx} y={ENVS.y + 12} width={26} height={20} rx={4} className={e === 'E3' ? styles.envProd : styles.env} />
                <text x={bx + 13} y={ENVS.y + 26} textAnchor="middle" className={styles.envText}>
                  {e}
                </text>
                {i < 2 && <path d={`M${bx + 27},${ENVS.y + 22} H${bx + 35}`} className={styles.envLine} />}
              </g>
            );
          })}
          <text x={ENVS.x + 12} y={ENVS.y + 49} className={styles.sub}>
            test, then sign off
          </text>

          <path d={`M${ENVS.x + ENVS.w},${QY} H${LIVE.x}`} className={styles.line} markerEnd="url(#op-head)" />
          <Card x={LIVE.x} y={LIVE.y} w={LIVE.w} h={LIVE.h} title="Traffic" sub={['channels start', 'for paths 1, 2']} tone="live" />
          <text x={ENVS.x + 12} y={ENVS.y + ENVS.h + 20} className={styles.note}>
            RFC in E3, production
          </text>
        </svg>
      </div>
    </figure>
  );
}
