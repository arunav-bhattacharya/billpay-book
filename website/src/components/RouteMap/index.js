import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * RouteMap: the fork tree. For each trigger, the workflow the Router starts,
 * how it starts it, and the Temporal cluster it runs on.
 *
 * One tray per trigger. Colour means cluster and nothing else: the square on
 * a workflow is Bright Blue for Online and the deeper navy for Offline. How a
 * workflow starts is drawn on the line into it, never in colour:
 *
 *   solid line    it starts at once (Update-With-Start, or an async start)
 *   dashed line   it waits for a dispatcher (from One-Data's inbox, or from
 *                 a Work Tracker row)
 *   elbow         a child, started by its parent on the parent's cluster
 *
 * A payment workflow that branches by account type forks three ways at grey
 * junction squares. A branch with no child ends in a box saying the workflow
 * runs it all itself, so every branch ends on something.
 *
 * HTML and CSS rather than SVG, so the text stays text and the tree reflows.
 * Container queries put the trigger beside its tree when there is room, then
 * above it, and on a phone each fork turns into stacks that run down the page.
 *
 * Props: `triggers`, each {term, routes}. A route is
 *   {desc, flow, fork?, note?, across?}
 * `flow` lists the workflows in order, each {via, detail?, name, cluster},
 * where `via` says how it starts: 'uws', 'async', 'inbox', 'row' or 'child'.
 * The first one's `via` is the line from the trigger. `fork` lists branches,
 *   {term, via, detail?, flow, notes?}   or   {term, self: [caption, ...]}
 * hanging from the last workflow in `flow`. `note` sits beside the last
 * workflow. `across` lets a route without a fork run left to right when the
 * tree has the room.
 */

const VIA = {
  uws: {label: 'Update-With-Start'},
  async: {label: 'Async start'},
  inbox: {label: 'From the inbox', waits: true},
  row: {label: 'Work Tracker row', waits: true},
  child: {label: 'Child'},
};

const SELF = 'Runs it all itself';

const LABEL =
  'Trigger to workflow, drawn as a fork tree. Each trigger has a tray. Each condition in it leads to the workflow the Router starts, with how it starts written on the line into it: a solid line starts at once, a dashed line waits for a dispatcher, and an elbow is a child workflow on its parent\'s cluster. The square on each workflow is its cluster, Bright Blue for Online and navy for Offline. Payment workflows fork three ways by account type: a consumer payment of one amount, which the workflow runs itself, a consumer split, and a corporate payment.';

const offline = (cluster) => String(cluster).trim().toLowerCase() === 'offline';
const tone = (cluster) => (offline(cluster) ? styles.off : styles.on);

/* A long workflow name may break before a capital, and only where it must. */
function Name({text}) {
  if (text.length < 26 || /\s/.test(text)) return text;
  return text.split(/(?=[A-Z])/).map((part, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <React.Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </React.Fragment>
  ));
}

function Node({name, cluster}) {
  return (
    <span className={clsx(styles.node, tone(cluster))}>
      <i className={styles.sq} aria-hidden="true" />
      <span className={styles.name}>
        <Name text={name} />
      </span>
      <span className={styles.srOnly}>, {offline(cluster) ? 'Offline' : 'Online'} cluster</span>
    </span>
  );
}

function SelfBox({cluster, lines}) {
  return (
    <>
      <span className={clsx(styles.node, styles.self, tone(cluster))}>
        <i className={styles.sq} aria-hidden="true" />
        <span className={styles.selfText}>{SELF}</span>
        <span className={styles.srOnly}>, on the {offline(cluster) ? 'Offline' : 'Online'} cluster</span>
      </span>
      {lines.map((line) => (
        <span key={line} className={styles.caption}>
          {line}
        </span>
      ))}
    </>
  );
}

/* How a workflow starts, in words: the mode, then any detail. */
function How({via, detail}) {
  return (
    <>
      <span className={styles.mode}>{VIA[via].label}</span>
      {detail && (
        <span className={styles.det}>
          <span className={styles.sep}>, </span>
          {detail}
        </span>
      )}
    </>
  );
}

/* The line into a workflow. Its parent decides which way it runs. */
function Edge({via, detail}) {
  return (
    <span className={clsx(styles.edge, VIA[via].waits && styles.waits)}>
      <How via={via} detail={detail} />
    </span>
  );
}

function Step({step, first, aside}) {
  const node = (
    <span className={styles.nodeRow}>
      <Node name={step.name} cluster={step.cluster} />
      {aside && <span className={styles.aside}>{aside}</span>}
    </span>
  );
  if (first) return node;
  if (step.via === 'child') {
    return (
      <span className={styles.child}>
        <span className={styles.childHow}>
          <How via="child" detail={step.detail} />
        </span>
        <span className={styles.childRow}>{node}</span>
      </span>
    );
  }
  return (
    <>
      <Edge via={step.via} detail={step.detail} />
      {node}
    </>
  );
}

/* A run of workflows, each started by the one before it or for it. The first
   one's line is drawn by whoever holds the flow: the trigger, or a fork arm. */
function Flow({steps, aside}) {
  return steps.map((step, i) => (
    <Step key={`${step.name}-${i}`} step={step} first={i === 0} aside={i === steps.length - 1 ? aside : null} />
  ));
}

function Fork({branches, cluster}) {
  return (
    <span className={styles.fork}>
      {branches.map((b) => (
        <span
          key={b.term}
          className={clsx(styles.branch, b.self && styles.selfBranch, !b.self && VIA[b.via].waits && styles.waits)}>
          <i className={styles.junction} aria-hidden="true" />
          <span className={styles.arm}>
            <span className={styles.armHead}>
              <span className={styles.armTerm}>{b.term}</span>
              <i className={styles.armLine} aria-hidden="true" />
            </span>
            <span className={styles.armHow}>{b.self ? 'No child' : <How via={b.via} detail={b.detail} />}</span>
          </span>
          <span className={styles.end}>
            {b.self ? <SelfBox cluster={cluster} lines={b.self} /> : <Flow steps={b.flow} />}
          </span>
          {b.notes && (
            <span className={styles.notes}>
              {b.notes.map((n) => (
                <span key={n} className={styles.noteLine}>
                  {n}
                </span>
              ))}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function Route({route, term}) {
  const first = route.flow[0];
  const last = route.flow[route.flow.length - 1];
  return (
    <div className={clsx(styles.route, route.across && !route.fork && styles.across)}>
      <div className={styles.trig}>
        {term && <span className={styles.term}>{term}</span>}
        <span className={styles.desc}>{route.desc}</span>
      </div>
      <div className={styles.entry}>
        <Edge via={first.via} detail={first.detail} />
      </div>
      <div className={styles.flow}>
        <Flow steps={route.flow} aside={route.note} />
        {route.fork && <Fork branches={route.fork} cluster={last.cluster} />}
      </div>
    </div>
  );
}

function Key() {
  return (
    <div className={styles.key}>
      <div className={styles.keyGrid}>
        <span className={styles.keyHead}>Runs on</span>
        <span className={styles.keyItems}>
          <span className={styles.keyItem}>
            <span className={clsx(styles.node, styles.swatch, styles.on)} aria-hidden="true">
              <i className={styles.sq} />
            </span>
            Online cluster
          </span>
          <span className={styles.keyItem}>
            <span className={clsx(styles.node, styles.swatch, styles.off)} aria-hidden="true">
              <i className={styles.sq} />
            </span>
            Offline cluster
          </span>
        </span>
        <span className={styles.keyHead}>Starts at once</span>
        <span className={styles.keyItems}>
          <span className={styles.keyItem}>
            <i className={styles.kLine} aria-hidden="true" />
            Update-With-Start
          </span>
          <span className={styles.keyItem}>
            <i className={styles.kLine} aria-hidden="true" />
            Async start
          </span>
        </span>
        <span className={styles.keyHead}>Waits for a dispatcher</span>
        <span className={styles.keyItems}>
          <span className={styles.keyItem}>
            <i className={clsx(styles.kLine, styles.kDash)} aria-hidden="true" />
            From the inbox
          </span>
          <span className={styles.keyItem}>
            <i className={clsx(styles.kLine, styles.kDash)} aria-hidden="true" />
            Work Tracker row
          </span>
        </span>
        <span className={styles.keyHead}>Under a workflow</span>
        <span className={styles.keyItems}>
          <span className={styles.keyItem}>
            <i className={styles.kElbow} aria-hidden="true" />
            Child, on its parent&apos;s cluster
          </span>
          <span className={styles.keyItem}>
            <i className={styles.kFork} aria-hidden="true" />
            Branch the account type picks
          </span>
        </span>
      </div>
      <p className={styles.keyNote}>Names drop the Workflow suffix.</p>
    </div>
  );
}

export default function RouteMap({triggers}) {
  return (
    <div className={styles.wrap} role="group" aria-label={LABEL}>
      <Key />
      {triggers.map((t) => (
        <section key={t.term} className={styles.tray} aria-label={t.term}>
          {t.routes.map((route, i) => (
            <Route key={route.desc} route={route} term={i === 0 ? t.term : null} />
          ))}
        </section>
      ))}
    </div>
  );
}
