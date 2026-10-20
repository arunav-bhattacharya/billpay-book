import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * GitflowMap: the branch model on Code Merge Strategy, drawn as lanes in the
 * house style. One lane per kind of branch, top to bottom: feature and fix,
 * develop, release, main, hotfix. `develop` and `main` run the full width;
 * the short-lived branches appear only while they live. Dots are commits,
 * curved connectors are branches and merges, and the small E1 E2 E3 card is
 * the one build a release or hotfix takes through the environments.
 *
 * Coordinates are hand-placed on a 700 x 330 canvas. Takes no props.
 */

const W = 700;
const H = 330;
const X0 = 136; // where the lanes start
const LANE = {F: 44, D: 104, R: 164, M: 224, H: 284};
const C = 20; // the run of one branch or merge curve

const LANES = [
  {key: 'F', name: 'feature/*', note: 'and fix/*', tone: 'feature'},
  {key: 'D', name: 'develop', tone: 'develop'},
  {key: 'R', name: 'release/*', tone: 'release'},
  {key: 'M', name: 'main', note: 'production copy', tone: 'main'},
  {key: 'H', name: 'hotfix/*', tone: 'hotfix'},
];

const LABEL =
  'The branch model, as five lanes. Feature and fix branches start from develop and are squashed back into it. A release branch is cut from develop; a fix found in testing goes onto the release branch; its one build moves through E1, E2 and E3; once it is live, the release branch merges to main with a merge commit and the tag v1.4, then merges back into develop. Main is the production copy. A hotfix branch starts from main, takes the fix, its build moves through E1, E2 and E3, and it merges to main, tagged v1.4.1, and back to develop.';

/* A curve from one lane to another, starting at x and moving right by C. */
const hop = (x, from, to) => `M${x},${from} C${x + C * 0.6},${from} ${x + C * 0.4},${to} ${x + C},${to}`;

function Dot({x, y, tone, hollow}) {
  return <circle cx={x} cy={y} r={5} className={clsx(styles.dot, styles[`d_${tone}`], hollow && styles.hollow)} />;
}

function Envs({x, y}) {
  return (
    <g>
      <rect x={x} y={y - 12} width={78} height={24} rx={6} className={styles.envCard} />
      {['E1', 'E2', 'E3'].map((e, i) => (
        <g key={e}>
          <rect x={x + 5 + i * 24} y={y - 8} width={20} height={16} rx={3} className={e === 'E3' ? styles.envProd : styles.env} />
          <text x={x + 15 + i * 24} y={y + 3.6} textAnchor="middle" className={clsx(styles.envText, e === 'E3' && styles.envTextProd)}>
            {e}
          </text>
        </g>
      ))}
    </g>
  );
}

function Tag({x, y, text}) {
  const w = text.length * 6.6 + 14;
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} className={styles.tag} />
      <text x={x} y={y + 3.6} textAnchor="middle" className={styles.tagText}>
        {text}
      </text>
    </g>
  );
}

export default function GitflowMap() {
  const {F, D, R, M, H: HF} = LANE;
  // where things happen, left to right
  const feat = {out: 150, a: 190, b: 214, back: 236};
  const rel = {cut: 274, fix: 312, envs: 330, merge: 424, back: 436};
  const hot = {out: 490, fix: 526, envs: 542, merge: 632, back: 644};
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          {/* the lanes and their names */}
          {LANES.map((l) => (
            <g key={l.key} className={styles[`t_${l.tone}`]}>
              <rect x={10} y={LANE[l.key] - 17} width={112} height={34} rx={8} className={styles.laneChip} />
              <text x={22} y={LANE[l.key] + (l.note ? -2 : 4)} className={styles.laneName}>
                {l.name}
              </text>
              {l.note && (
                <text x={22} y={LANE[l.key] + 11} className={styles.laneNote}>
                  {l.note}
                </text>
              )}
              <path d={`M${X0},${LANE[l.key]} H${W - 8}`} className={styles.track} />
            </g>
          ))}

          {/* develop and main live the whole time */}
          <path d={`M${X0},${D} H${W - 8}`} className={clsx(styles.rail, styles.r_develop)} />
          <path d={`M${X0},${M} H${W - 8}`} className={clsx(styles.rail, styles.r_main)} />

          {/* a feature: out from develop, two commits, squashed back */}
          <path d={hop(feat.out, D, F)} className={clsx(styles.rail, styles.r_feature)} />
          <path d={`M${feat.out + C},${F} H${feat.back}`} className={clsx(styles.rail, styles.r_feature)} />
          <path d={hop(feat.back, F, D)} className={clsx(styles.rail, styles.r_feature)} />
          <Dot x={feat.a} y={F} tone="feature" />
          <Dot x={feat.b} y={F} tone="feature" />
          <Dot x={feat.back + C} y={D} tone="develop" />
          <text x={feat.back + 24} y={F + 26} className={styles.label}>
            squash
          </text>

          {/* a release: cut, a fix, one build through the environments, then out */}
          <path d={hop(rel.cut, D, R)} className={clsx(styles.rail, styles.r_release)} />
          <path d={`M${rel.cut + C},${R} H${rel.back}`} className={clsx(styles.rail, styles.r_release)} />
          <Dot x={rel.cut} y={D} tone="develop" />
          <text x={rel.cut + 26} y={D + 26} className={styles.label}>
            cut
          </text>
          <Dot x={rel.fix} y={R} tone="release" />
          <text x={rel.fix} y={R + 24} textAnchor="middle" className={styles.label}>
            a fix
          </text>
          <Envs x={rel.envs} y={R} />
          <path d={hop(rel.merge, R, M)} className={clsx(styles.rail, styles.r_release)} />
          <Dot x={rel.merge + C} y={M} tone="main" />
          <Tag x={rel.merge + C} y={M + 24} text="v1.4" />
          <path d={`M${rel.back},${R} C${rel.back + 12},${R} ${rel.back + 8},${D} ${rel.back + C + 4},${D}`} className={clsx(styles.rail, styles.r_release, styles.back)} />
          <Dot x={rel.back + C + 4} y={D} tone="develop" />
          <text x={rel.merge - 2} y={R + 32} textAnchor="end" className={styles.label}>
            merge commit
          </text>
          <text x={rel.back + 30} y={D - 12} className={styles.label}>
            merge back
          </text>

          {/* a hotfix: from main, one build, back to main and to develop */}
          <path d={hop(hot.out, M, HF)} className={clsx(styles.rail, styles.r_hotfix)} />
          <path d={`M${hot.out + C},${HF} H${hot.back}`} className={clsx(styles.rail, styles.r_hotfix)} />
          <Dot x={hot.out} y={M} tone="main" />
          <Dot x={hot.fix} y={HF} tone="hotfix" />
          <text x={hot.fix} y={HF + 24} textAnchor="middle" className={styles.label}>
            the fix
          </text>
          <Envs x={hot.envs} y={HF} />
          <path d={hop(hot.merge, HF, M)} className={clsx(styles.rail, styles.r_hotfix)} />
          <Dot x={hot.merge + C} y={M} tone="main" />
          <Tag x={hot.merge - 26} y={M - 24} text="v1.4.1" />
          <path
            d={`M${hot.back},${HF} C${hot.back + 14},${HF} ${hot.back + 10},${D} ${hot.back + C + 16},${D}`}
            className={clsx(styles.rail, styles.r_hotfix, styles.back)}
          />
          <Dot x={hot.back + C + 16} y={D} tone="develop" />
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.li}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" className={clsx(styles.dot, styles.d_develop)} />
          </svg>
          a commit
        </span>
        <span className={styles.li}>
          <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true">
            <path d="M1,6 H29" className={clsx(styles.rail, styles.r_release, styles.back)} />
          </svg>
          merged back into develop
        </span>
        <span className={styles.li}>
          <span className={styles.envSw} aria-hidden="true">E1</span>
          one build, tested in E1, E2, E3
        </span>
      </div>
    </figure>
  );
}
