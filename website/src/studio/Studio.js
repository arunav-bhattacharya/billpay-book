/**
 * The Diagram Studio: a journey from All Journeys, drawn by JourneyMap in
 * edit mode, that you change by clicking on it.
 *
 * Every change is made to the journey's plain data and recorded, so undo,
 * redo and the list of changes all read from one history. Saving writes the
 * changed files out in the repository's own layout and walks you through
 * proposing them on GitHub, where the pull request check runs as for any
 * other edit. Nothing here writes anywhere by itself.
 */
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import clsx from 'clsx';
import {useHistory, useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';
import {Journey, listJourneys, SYSTEM_LIST, THEME, SYSTEMS_PATH, THEME_PATH} from '../components/JourneyMap';
import jm from '../components/JourneyMap/styles.module.css';
import {KINDS} from '../lib/journeyTheme';
import useOverlay from '../lib/useOverlay';
import {emitJourney, emitSystems, emitTheme, diffLines} from './emit';
import {clone, validate, addStep, deleteStep, moveStep, stepLabel, linksOf} from './rules';
import {formFor, FormView} from './forms';
import styles from './styles.module.css';

/* One journey's editing session: the file as it is, the copy being changed,
   and every step of the way there. */
function fresh(j) {
  const snap = {j: clone(j.data), t: clone(THEME), s: [], desc: ''};
  return {
    name: j.name,
    file: j.file,
    original: clone(j.data),
    J: clone(j.data),
    T: clone(THEME),
    S: [],
    history: [snap],
    ptr: 0,
    lastKey: null,
    lastTime: 0,
  };
}

const FIRST = 'first field';

const TRIES = [
  ['rename', 'Rename a step'],
  ['add', 'Add a step'],
  ['between', 'Change what happens between steps'],
  ['link', 'Link two steps'],
  ['system', 'Add a system'],
  ['colour', 'Change a colour'],
  ['delete', 'Delete a step'],
];

export default function Studio({sources}) {
  const journeys = useMemo(listJourneys, []);
  const {siteConfig} = useDocusaurusContext();
  const repo = `https://github.com/${siteConfig.organizationName}/${siteConfig.projectName}`;
  const location = useLocation();
  const history = useHistory();
  const asked = new URLSearchParams(location.search).get('journey');
  const ed = useRef(null);
  if (!ed.current) ed.current = fresh(journeys.find((j) => j.name === asked) || journeys[0]);
  const E = ed.current;

  const [, redraw] = useReducer((x) => x + 1, 0);
  const [sel, setSel] = useState(null);
  const [popOpts, setPopOpts] = useState({});
  const [linkFrom, setLinkFrom] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hint, setHint] = useState(null);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);
  const [switchTo, setSwitchTo] = useState(null);
  const [armed, setArmed] = useState(false);
  const stageRef = useRef(null);
  const popRef = useRef(null);
  const barRef = useRef(null);
  const focusNext = useRef(null);

  const systems = [...SYSTEM_LIST, ...E.S];
  const systemMap = Object.fromEntries(systems.map((s) => [s.name, s]));
  const errs = validate(E.J);
  const bad = new Set(errs.map((e) => e.key));
  const changes = E.ptr;

  /* ---- history -------------------------------------------------------- */

  const commit = useCallback((desc, key) => {
    const e = ed.current;
    const now = Date.now();
    const snap = {j: clone(e.J), t: clone(e.T), s: clone(e.S), desc};
    if (key && key === e.lastKey && now - e.lastTime < 5000 && e.ptr === e.history.length - 1 && e.ptr > 0) {
      e.history[e.ptr] = snap;
      /* Typing a field back to what it was leaves no change behind. */
      const prev = e.history[e.ptr - 1];
      if (JSON.stringify([prev.j, prev.t, prev.s]) === JSON.stringify([snap.j, snap.t, snap.s])) {
        e.history.pop();
        e.ptr--;
        e.lastKey = null;
        redraw();
        return;
      }
    } else {
      e.history = e.history.slice(0, e.ptr + 1);
      e.history.push(snap);
      e.ptr++;
    }
    e.lastKey = key || null;
    e.lastTime = now;
    redraw();
  }, []);

  const restore = useCallback((i) => {
    const e = ed.current;
    e.ptr = i;
    e.J = clone(e.history[i].j);
    e.T = clone(e.history[i].t);
    e.S = clone(e.history[i].s);
    e.lastKey = null;
    setLinkFrom(null);
    setHint(null);
    redraw();
  }, []);
  const undo = useCallback(() => ed.current.ptr > 0 && restore(ed.current.ptr - 1), [restore]);
  const redo = useCallback(() => ed.current.ptr < ed.current.history.length - 1 && restore(ed.current.ptr + 1), [restore]);

  /* ---- the edit box --------------------------------------------------- */

  const open = useCallback((key, opts = {}) => {
    setSel(key);
    setPopOpts(opts);
    if (opts.focus) focusNext.current = opts.focus;
    else if (opts.focusFirst) focusNext.current = FIRST;
  }, []);
  const close = useCallback(() => {
    setSel(null);
    setPopOpts({});
  }, []);

  const showToast = useCallback((text) => setToast({text, at: Date.now()}), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!hint || !hint.brief) return undefined;
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
  }, [hint]);

  const startLink = useCallback(
    (i) => {
      close();
      setLinkFrom(i);
      setHint({text: `Click the step that step ${i + 1} links to. Press Esc to cancel.`, cancel: true});
    },
    [close],
  );
  const cancelLink = useCallback(() => {
    setLinkFrom(null);
    setHint(null);
  }, []);
  const finishLink = (t) => {
    const i = linkFrom;
    setLinkFrom(null);
    setHint(null);
    const J = E.J;
    if (t === i) return setHint({text: "A step can't link to itself. Pick another step.", brief: true});
    const from = J.steps[i];
    if (linksOf(from).some((l) => l.to === J.steps[t].name)) return setHint({text: 'Those two steps are already linked.', brief: true});
    from.links = [...linksOf(from), {to: J.steps[t].name, label: ''}];
    commit(`Link added from ${stepLabel(J, i)} to ${stepLabel(J, t)}`);
    return open(`link:${i}:${from.links.length - 1}`, {focus: 'st-llabel'});
  };

  const api = {
    J: E.J,
    T: E.T,
    S: E.S,
    siteTheme: THEME,
    systems,
    commit,
    open,
    close,
    toast: showToast,
    startLink,
    focusSoon: (id) => {
      focusNext.current = id;
    },
    addStep: (b) => {
      const desc = addStep(E.J, b);
      commit(desc);
      open(`step:${b}`, {focus: 'st-name'});
    },
    deleteStep: (i, notes) => {
      const desc = deleteStep(E.J, i, notes);
      close();
      commit(desc);
      showToast(`${desc}.`);
    },
    moveStep: (from, b) => {
      const label = stepLabel(E.J, from);
      const to = moveStep(E.J, from, b);
      if (to === null) return;
      commit(`${label} moved to step ${to + 1}`);
      if (sel === `step:${from}`) open(`step:${to}`);
    },
  };

  /* The steps a state field covers, read from the drawing. */
  const runOf = (key) => {
    const el = stageRef.current && stageRef.current.querySelector(`[data-key="${key}"]`);
    return el && el.dataset.steps ? el.dataset.steps.split(' ').map(Number) : null;
  };

  /* ---- clicks and keys on the diagram --------------------------------- */

  const activate = (key, how = {}) => {
    const [part, a] = key.split(':');
    if (part === 'link-start') return startLink(Number(a));
    if (linkFrom !== null) {
      if (part === 'step') return finishLink(Number(a));
      return cancelLink();
    }
    if (part === 'route-add') {
      const g = a;
      E.J[g] = E.J[g] || [];
      E.J[g].push(g === 'workflow' ? {label: 'NewWorkflow'} : {kind: g === 'entry' ? 'function' : 'api', label: g === 'entry' ? 'NewFunction.v1' : 'POST /new'});
      commit(`${{entry: 'Entry point', core: 'Billpay API', workflow: 'Workflow'}[g]} added`);
      return open(`route:${g}:${E.J[g].length - 1}`, {focus: 'st-rlabel'});
    }
    if (part === 'note-add') {
      E.J.detail = E.J.detail || [];
      E.J.detail.push({text: ''});
      commit('Note added');
      return open(`note:${E.J.detail.length - 1}`, {focus: 'st-ntext'});
    }
    if (key === sel) return close();
    return open(key, {focusFirst: how.keyboard, run: part === 'state' ? runOf(key) : undefined});
  };

  const onStageClick = (e) => {
    const el = e.target.closest('[data-key]');
    if (e.target.closest('a')) e.preventDefault();
    if (!el || !stageRef.current.contains(el)) return;
    e.stopPropagation();
    activate(el.dataset.key);
  };
  const onStageKey = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-key][role="button"]')) {
      e.preventDefault();
      activate(e.target.dataset.key, {keyboard: true});
    }
  };

  /* Drag a step onto a gap to move it. */
  const onDragStart = (e) => {
    const el = e.target.closest && e.target.closest('[data-key^="step:"]');
    if (!el || linkFrom !== null) {
      e.preventDefault();
      return;
    }
    const from = Number(el.dataset.key.split(':')[1]);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(from));
    close();
    setDrag({from, over: null});
  };
  const gapAt = (e) => {
    const g = e.target.closest && e.target.closest('[data-key^="gap:"]');
    return g ? Number(g.dataset.key.split(':')[1]) : null;
  };
  const onDragOver = (e) => {
    if (!drag) return;
    const b = gapAt(e);
    if (b === null) return;
    e.preventDefault();
    if (drag.over !== b) setDrag({...drag, over: b});
  };
  const onDrop = (e) => {
    if (!drag) return;
    const b = gapAt(e);
    if (b === null) return;
    e.preventDefault();
    const {from} = drag;
    setDrag(null);
    api.moveStep(from, b);
  };

  /* ---- placing the edit box beside what it edits ---------------------- */

  const findPart = useCallback((key) => {
    const stage = stageRef.current;
    if (!stage || !key) return null;
    const direct = stage.querySelector(`[data-key="${key}"]`);
    if (direct) return direct;
    if (key.startsWith('state:')) {
      const i = key.split(':')[1];
      return [...stage.querySelectorAll('[data-key^="state:"]')].find((x) => (x.dataset.steps || '').split(' ').includes(i)) || null;
    }
    return null;
  }, []);

  const place = useCallback(() => {
    const pop = popRef.current;
    if (!pop || !sel) return;
    if (window.innerWidth <= 640) {
      pop.style.left = '';
      pop.style.top = '';
      return;
    }
    const el = findPart(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const barH = (barRef.current ? barRef.current.getBoundingClientRect().bottom : 0) + 10;
    const clampTop = (t) => Math.min(Math.max(barH, t), Math.max(barH, H - h - 12));
    let left;
    let top;
    if (r.bottom + 10 + h <= H - 12) {
      top = r.bottom + 10;
      left = Math.min(Math.max(16, r.left), W - w - 16);
    } else if (W - r.right - 16 >= w + 10) {
      left = r.right + 10;
      top = clampTop(r.top - 24);
    } else if (r.left - 16 >= w + 10) {
      left = r.left - w - 10;
      top = clampTop(r.top - 24);
    } else {
      left = Math.min(Math.max(16, r.left), W - w - 16);
      top = r.top - h - 10 >= barH ? r.top - h - 10 : clampTop(r.bottom + 10);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, [sel, findPart]);

  useLayoutEffect(() => {
    place();
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    if (want === FIRST) {
      const first = popRef.current && popRef.current.querySelector(`.${styles.popBody} input, .${styles.popBody} select, .${styles.popBody} textarea, .${styles.popBody} button`);
      if (first) first.focus();
      return;
    }
    const f = document.getElementById(want);
    if (f) {
      f.focus();
      if (f.select) f.select();
    }
  });
  useEffect(() => {
    const f = () => place();
    window.addEventListener('resize', f);
    window.addEventListener('scroll', f, true);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('scroll', f, true);
    };
  }, [place]);

  /* A part that has gone (deleted, or undone away) takes its box with it. */
  const form = sel ? formFor(sel, api, popOpts) : null;
  useEffect(() => {
    if (sel && !form) close();
  });

  /* ---- keys and clicks anywhere --------------------------------------- */

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.matches && e.target.matches('input, textarea, select');
      if (e.key === 'Escape') {
        if (panel) return;
        if (linkFrom !== null) return cancelLink();
        if (sel) {
          const had = sel;
          close();
          const el = findPart(had);
          if (el) el.focus();
        }
        return;
      }
      if (typing || panel) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && sel.startsWith('step:')) {
        e.preventDefault();
        const i = Number(sel.split(':')[1]);
        const notes = (E.J.detail || []).filter((d) => d.step === i + 1).length;
        if (notes) open(sel, {confirmDelete: true});
        else api.deleteStep(i);
      }
    };
    const onClick = (e) => {
      if (!document.contains(e.target)) return;
      if (linkFrom !== null && !e.target.closest(`.${styles.stage}, .${styles.pop}, .${styles.hintBar}, .${styles.toast}, .${styles.tries}`)) cancelLink();
      if (!sel) return;
      if (e.target.closest(`.${styles.pop}, .${styles.bar}, .${styles.stage}, .${styles.toast}, .${styles.tries}, [role="dialog"]`)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  });

  /* Leaving with changes not yet saved asks first. */
  useEffect(() => {
    if (!changes) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changes]);

  /* ---- switching journey ---------------------------------------------- */

  const switchJourney = (name) => {
    const j = journeys.find((x) => x.name === name);
    if (!j) return;
    ed.current = fresh(j);
    setSwitchTo(null);
    close();
    setLinkFrom(null);
    setHint(null);
    setToast(null);
    history.replace(`${location.pathname}?journey=${name}`);
    redraw();
  };
  const pick = (name) => {
    if (name === E.name) return;
    if (changes) setSwitchTo(name);
    else switchJourney(name);
  };

  /* ---- the try-it buttons --------------------------------------------- */

  const tryIt = (t) => {
    const steps = E.J.steps || [];
    const go = (key, opts) => {
      open(key, opts);
      setTimeout(() => {
        const el = findPart(key);
        if (el) el.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'});
      }, 0);
    };
    if (!steps.length) return go('gap:0');
    const last = steps.length - 1;
    if (t === 'rename') return go('step:0', {focus: 'st-name'});
    if (t === 'add') return go(`gap:${steps.length}`);
    if (t === 'between') return go(`gap:${Math.min(1, last)}`);
    if (t === 'link') return startLink(0);
    if (t === 'system') return go('calls:0', {newSystem: true, focus: 'st-sysname'});
    if (t === 'delete') return go(`step:${last}`);
    const kind = ['live-step', 'background-step', 'trigger', 'link'].find((k) => stageRef.current.querySelector(`[data-key="legend:${k}"]`));
    return go(kind ? `legend:${kind}` : 'calls:0');
  };

  /* ---- saving ---------------------------------------------------------- */

  const files = (() => {
    if (panel !== 'save') return [];
    const out = [];
    const before = sources[E.file] ?? emitJourney(E.original);
    const after = emitJourney(E.J);
    if (after !== emitJourney(E.original)) out.push({path: E.file, what: 'the journey', before, after});
    if (Object.keys(KINDS).some((k) => E.T[k] !== THEME[k])) {
      out.push({path: THEME_PATH, what: 'the colours every journey shares', before: sources[THEME_PATH] ?? emitTheme(THEME), after: emitTheme(E.T)});
    }
    if (E.S.length) {
      out.push({path: SYSTEMS_PATH, what: 'the list of systems', before: sources[SYSTEMS_PATH] ?? emitSystems(SYSTEM_LIST), after: emitSystems([...SYSTEM_LIST, ...E.S])});
    }
    return out;
  })();

  const closePanel = useCallback(() => {
    setPanel(null);
    setArmed(false);
  }, []);

  const goTo = (key) => {
    closePanel();
    open(key, {focusFirst: true});
    setTimeout(() => {
      const el = findPart(key);
      if (el) el.scrollIntoView({block: 'center', inline: 'center', behavior: 'smooth'});
    }, 0);
  };

  /* ---- drawing --------------------------------------------------------- */

  const stepsless = !Array.isArray(E.J.steps);
  const fileUrl = `${repo}/blob/main/${E.file}`;

  return (
    <div className={styles.studio}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Diagrams</p>
        <h1 className={styles.h1}>Diagram Studio</h1>
        <p className={styles.lead}>
          Click any part of a journey to change it. Hover between two steps to add one, or drag a step to move it. To link two steps, hover over a step and click its arrow, then click the step it goes to. Colours are set by kind of part, so a change applies to every
          journey. When you're done, Save shows you how to propose the change on GitHub.
        </p>
        <div className={styles.tries}>
          <span className={styles.triesLabel}>Try it</span>
          {TRIES.map(([k, label]) => (
            <button key={k} type="button" className={styles.try} onClick={() => tryIt(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.bar} ref={barRef}>
        <label className={styles.pick}>
          <span>Journey</span>
          <select className={styles.input} value={E.name} onChange={(e) => pick(e.target.value)}>
            {journeys.map((j) => (
              <option key={j.name} value={j.name}>
                {j.data.title}
              </option>
            ))}
          </select>
        </label>
        <a className={styles.fileLink} href={fileUrl} target="_blank" rel="noopener noreferrer">
          View the file on GitHub
        </a>
        <span className={styles.grow} />
        <button type="button" className={clsx(styles.btn, styles.icon)} onClick={undo} disabled={E.ptr === 0} aria-label="Undo" title="Undo (Ctrl+Z)">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5.5 3 2.5 6l3 3" />
            <path d="M2.5 6h7a4 4 0 0 1 0 8h-3" />
          </svg>
        </button>
        <button type="button" className={clsx(styles.btn, styles.icon)} onClick={redo} disabled={E.ptr === E.history.length - 1} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10.5 3l3 3-3 3" />
            <path d="M13.5 6h-7a4 4 0 0 0 0 8h3" />
          </svg>
        </button>
        <button type="button" className={styles.btn} onClick={() => setPanel('changes')}>
          Changes <span className={styles.count}>{changes}</span>
        </button>
        {errs.length > 0 && (
          <button type="button" className={clsx(styles.btn, styles.fix)} onClick={() => goTo(errs[0].key)}>
            {errs.length === 1 ? '1 thing to fix' : `${errs.length} things to fix`}
          </button>
        )}
        <button type="button" className={clsx(styles.btn, styles.primary)} onClick={() => (close(), setPanel('save'))}>
          Save
        </button>
      </div>

      {switchTo && (
        <div className={styles.switch} role="alert">
          <span>
            You have {changes === 1 ? 'one change' : `${changes} changes`} to {E.J.title || 'this journey'} that you haven't saved. Opening another journey drops them.
          </span>
          <button type="button" className={clsx(styles.btn, styles.small, styles.danger)} onClick={() => switchJourney(switchTo)}>
            Drop them and open {journeys.find((j) => j.name === switchTo).data.title}
          </button>
          <button type="button" className={clsx(styles.btn, styles.small)} onClick={() => setSwitchTo(null)}>
            Stay here
          </button>
        </div>
      )}

      {asked && !journeys.some((j) => j.name === asked) && (
        <p className={styles.notice}>There is no journey called "{asked}", so the Studio opened the first one. Pick another from the list.</p>
      )}

      <div
        className={styles.stage}
        ref={stageRef}
        onClick={onStageClick}
        onKeyDown={onStageKey}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={() => setDrag(null)}>
        <Journey {...E.J} theme={E.T} systems={systemMap} edit={{sel, bad, linkFrom, dragging: !!drag, dropAt: drag && drag.over}} />
        {stepsless && (
          <div className={styles.noSteps}>
            <p>This journey has no steps to draw yet, so the page shows why instead. Click its name to change what it says, or give it a first step.</p>
            <button
              type="button"
              className={clsx(styles.btn, styles.primary)}
              onClick={() => {
                E.J.steps = [];
                api.addStep(0);
              }}>
              + Add the first step
            </button>
          </div>
        )}
      </div>

      {form &&
        createPortal(
          <div ref={popRef} className={clsx(styles.pop, jm.swatchScope)} role="dialog" aria-labelledby="st-pop-title">
            <FormView
              key={sel}
              Form={form.Form}
              props={form.props}
              api={api}
              opts={popOpts}
              errors={errs.filter((e) => e.key === sel)}
              onClose={close}
            />
          </div>,
          document.body,
        )}

      {hint && (
        <div className={styles.hintBar} role="status">
          <span>{hint.text}</span>
          {hint.cancel && (
            <button type="button" onClick={cancelLink}>
              Cancel
            </button>
          )}
        </div>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              undo();
              setToast(null);
            }}>
            Undo
          </button>
        </div>
      )}

      <Changes
        open={panel === 'changes'}
        onClose={closePanel}
        E={E}
        armed={armed}
        onStartAgain={() => {
          if (!E.ptr) return;
          if (!armed) return setArmed(true);
          setArmed(false);
          return switchJourney(E.name);
        }}
      />
      <Save open={panel === 'save'} onClose={closePanel} errs={errs} files={files} repo={repo} goTo={goTo} />
    </div>
  );
}

/* ---- the two panels ----------------------------------------------------- */

function Changes({open, onClose, E, armed, onStartAgain}) {
  const ref = useRef(null);
  useOverlay({open, onClose, focusRef: ref});
  if (!open) return null;
  const items = E.history.slice(1, E.ptr + 1);
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="st-changes-title">
        <div className={styles.dHead}>
          <h2 id="st-changes-title">Your changes</h2>
          <button type="button" ref={ref} className={clsx(styles.btn, styles.small)} onClick={onClose}>
            Close
          </button>
        </div>
        {items.length ? (
          <ol className={styles.log}>
            {items.map((h, n) => (
              <li key={n}>{h.desc}</li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No changes yet. Click any part of the diagram to start.</p>
        )}
        <div className={styles.dFoot}>
          <button type="button" className={clsx(styles.btn, styles.small, styles.danger)} onClick={onStartAgain} disabled={!items.length}>
            Start again
          </button>
          <span className={styles.note}>{armed ? 'Click again to drop every change.' : 'Drops every change, back to the file as it is.'}</span>
        </div>
      </aside>
    </>
  );
}

function FileCard({f, repo}) {
  const [copied, setCopied] = useState('');
  const [manual, setManual] = useState(false);
  const area = useRef(null);
  const rows = useMemo(() => diffLines(f.before, f.after), [f.before, f.after]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.after);
      setCopied('Copied');
    } catch (e) {
      setManual(true);
      setCopied('Press Ctrl+C to copy');
      setTimeout(() => {
        if (area.current) {
          area.current.focus();
          area.current.select();
        }
      }, 0);
    }
  };
  return (
    <div className={styles.fileCard}>
      <span className={styles.fileName}>{f.path}</span>
      <details>
        <summary>What changes in the file</summary>
        <div className={styles.diff}>
          {rows.map(([t, line], k) => (
            <div key={k} className={clsx(t === '+' && styles.add, t === '-' && styles.del, t === '~' && styles.skip)}>
              {t === '~' ? '  ...' : `${t} ${line}`}
            </div>
          ))}
        </div>
      </details>
      <ol className={styles.steps}>
        <li>
          <button type="button" className={clsx(styles.btn, styles.small, styles.primary)} onClick={copy}>
            {copied || 'Copy the new file'}
          </button>
        </li>
        <li>
          <a className={clsx(styles.btn, styles.small)} href={`${repo}/edit/main/${f.path}`} target="_blank" rel="noopener noreferrer">
            Open it in GitHub
          </a>
        </li>
        <li>
          Click in the file, press <kbd>Ctrl</kbd>+<kbd>A</kbd> to select it all, then <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste. On a Mac, use <kbd>Cmd</kbd>.
        </li>
        <li>
          Click <b>Commit changes</b>, choose <b>Create a new branch and start a pull request</b>, then <b>Propose changes</b>.
        </li>
      </ol>
      {manual && <textarea ref={area} className={styles.copyBox} readOnly value={f.after} aria-label="The new file" />}
    </div>
  );
}

function Save({open, onClose, errs, files, repo, goTo}) {
  const ref = useRef(null);
  useOverlay({open, onClose, focusRef: ref});
  if (!open) return null;
  const count = ['One file changes', 'Two files change', 'Three files change'][files.length - 1];
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="st-save-title">
        <div className={styles.dHead}>
          <h2 id="st-save-title">Save your changes</h2>
          <button type="button" ref={ref} className={clsx(styles.btn, styles.small)} onClick={onClose}>
            Close
          </button>
        </div>
        {errs.length > 0 ? (
          <>
            <p>
              Fix {errs.length === 1 ? 'this' : 'these'} first. The check on the pull request would stop on {errs.length === 1 ? 'it' : 'them'} too.
            </p>
            <ul className={styles.steps}>
              {errs.map((e, k) => (
                <li key={k}>
                  {e.msg}{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => goTo(e.key)}>
                    Show me
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : files.length === 0 ? (
          <p className={styles.empty}>Nothing has changed yet, so there is nothing to save.</p>
        ) : (
          <>
            <p className={styles.note}>
              {count}: {files.map((f) => f.what).join(', ').replace(/, ([^,]*)$/, ' and $1')}. For each one, copy it, open it in GitHub, and paste it over the old text. Then propose the change. Someone reviews it, and once it's merged the site updates in a few minutes.
            </p>
            {files.map((f) => (
              <FileCard key={f.path} f={f} repo={repo} />
            ))}
            <p className={styles.note}>
              Prefer to edit the files by hand? The <Link to="/docs/contributing">Contributing</Link> pages and the guide in <code>website/diagrams/README.md</code> show how.
            </p>
          </>
        )}
      </div>
    </>
  );
}
