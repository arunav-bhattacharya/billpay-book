import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * OnboardingFlow: how a market release travels from the Market Onboarding UI to the three
 * environments.
 *
 * The control plane sits across the top because there is one of it, and the
 * environments sit in a row below because there are three and they are alike.
 * Every line between them goes through the Market Onboarding API, which is the
 * whole point: a release only ever flows one way, through one door, and the
 * control plane never touches an environment's own databases. Inside each
 * environment the five steps of MarketOnboardingWorkflow are listed, with
 * E3's sign-off carrying the RFC.
 *
 * Coordinates are hand-placed on a 980 x 468 canvas. Takes no props.
 */

const W = 980;
const H = 468;

const CP = {x: 12, y: 12, w: W - 24, h: 110};

const CHIPS = [
  {title: 'Author', sub: 'profile and settings'},
  {title: 'Approve', sub: 'maker-checker, once'},
  {title: 'Freeze', sub: 'vN, with a checksum'},
  {title: 'Track', sub: 'deployment rows'},
];
const CHIP_X0 = 280;
const CHIP_W = 160;
const CHIP_GAP = 11;
const CHIP_Y = 38;
const CHIP_H = 58;

const ENV_Y = 178;
const ENV_H = 280;
const ENV_W = 300;
const ENVS = [
  {id: 'E1', x: 12, tag: '', link: 'vN, then its sign-off', step4: 'Wait for sign-off'},
  {id: 'E2', x: 340, tag: '', link: 'vN, once active and signed off in E1', step4: 'Wait for sign-off'},
  {id: 'E3', x: 668, tag: 'production', link: 'vN, once active and signed off in E2', step4: 'Sign-off, after the RFC'},
];

const STEPS = (e) => ['Check against the manifest', 'Save vN, inactive', 'Test payments', e.step4, 'Activate vN'];

const LABEL =
  'How a market release reaches the environments. Across the top is the Market Onboarding UI, the control plane, one for every environment: a profile and its settings are authored, approved once by a maker and a checker, frozen as release vN with a checksum, and tracked through deployment rows. Below are three environments, E1, E2 and E3, where E3 is production. Each one takes the release only through its Market Onboarding API, and in each a MarketOnboardingWorkflow checks vN against the build\'s capability manifest, saves it as an inactive version, tests it with payments, waits for sign-off, and activates it by pointing market_config_active at vN. The control plane sends vN to E1 first, then the same vN to E2 once it is active and signed off in E1, then to E3 once it is active and signed off in E2. In E3 the sign-off also needs a change request. Progress flows back up the same line.';

export default function OnboardingFlow() {
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <marker id="of-arrow" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.head} />
            </marker>
            <marker id="of-link" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.headLink} />
            </marker>
          </defs>

          {/* ---- the control plane ---- */}
          <rect x={CP.x} y={CP.y} width={CP.w} height={CP.h} rx={14} className={styles.cp} />
          <text x={32} y={52} className={styles.cpTitle}>
            Market Onboarding UI
          </text>
          <text x={32} y={76} className={styles.cpNote}>
            the control plane for every environment
          </text>
          {CHIPS.map((c, i) => {
            const x = CHIP_X0 + i * (CHIP_W + CHIP_GAP);
            return (
              <g key={c.title}>
                <rect x={x} y={CHIP_Y} width={CHIP_W} height={CHIP_H} rx={9} className={styles.chip} />
                <text x={x + 14} y={CHIP_Y + 25} className={styles.chipTitle}>
                  {c.title}
                </text>
                <text x={x + 14} y={CHIP_Y + 43} className={styles.chipSub}>
                  {c.sub}
                </text>
                {i > 0 && (
                  <path d={`M${x - CHIP_GAP},${CHIP_Y + CHIP_H / 2} H${x}`} className={styles.step} markerEnd="url(#of-arrow)" />
                )}
              </g>
            );
          })}

          {/* ---- the environments ---- */}
          {ENVS.map((e) => {
            const linkX = e.x + 236;
            const apiY = ENV_Y + 44;
            const wfY = ENV_Y + 84;
            return (
              <g key={e.id}>
                <path
                  d={`M${linkX},${CP.y + CP.h} V${apiY}`}
                  className={styles.link}
                  markerStart="url(#of-link)"
                  markerEnd="url(#of-link)"
                />
                <text x={linkX - 10} y={CP.y + CP.h + 34} textAnchor="end" className={styles.linkLabel}>
                  {e.link}
                </text>

                <rect x={e.x} y={ENV_Y} width={ENV_W} height={ENV_H} rx={14} className={clsx(styles.env, e.tag && styles.envProd)} />
                <text x={e.x + 18} y={ENV_Y + 28} className={styles.envTitle}>
                  {e.id}
                </text>
                {e.tag && (
                  <text x={e.x + 48} y={ENV_Y + 28} className={styles.envTag}>
                    {e.tag}
                  </text>
                )}

                <rect x={e.x + 16} y={apiY} width={ENV_W - 32} height={30} rx={8} className={styles.api} />
                <text x={e.x + 30} y={apiY + 20} className={styles.apiText}>
                  /market-onboarding/releases
                </text>

                <rect x={e.x + 16} y={wfY} width={ENV_W - 32} height={142} rx={9} className={styles.wf} />
                <text x={e.x + 30} y={wfY + 24} className={styles.wfTitle}>
                  MarketOnboardingWorkflow
                </text>
                {STEPS(e).map((s, i) => (
                  <g key={s}>
                    <rect x={e.x + 30} y={wfY + 37 + i * 20} width={15} height={15} rx={3} className={styles.num} />
                    <text x={e.x + 37.5} y={wfY + 48 + i * 20} textAnchor="middle" className={styles.numText}>
                      {i + 1}
                    </text>
                    <text x={e.x + 54} y={wfY + 49 + i * 20} className={styles.stepText}>
                      {s}
                    </text>
                  </g>
                ))}

                <rect x={e.x + 16} y={ENV_Y + 238} width={ENV_W - 32} height={28} rx={8} className={styles.cfg} />
                <text x={e.x + 30} y={ENV_Y + 257} className={styles.cfgText}>
                  market_config_active → vN
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        Releases flow one way, through one API. The control plane never reads or writes an environment's Oracle or
        Temporal, and an environment never reads the authoring tables.
      </figcaption>
    </figure>
  );
}
