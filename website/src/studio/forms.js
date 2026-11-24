/**
 * The edit box: one small form per part of the journey, opened beside the
 * part you click. Each form changes the journey in place and commits, which
 * records the change for undo and redraws the diagram under it.
 */
import React, {useEffect, useState} from 'react';
import clsx from 'clsx';
import {TRIGGER_KIND as TRIGGERS} from '../lib/triggers';
import {KINDS, SWATCHES} from '../lib/journeyTheme';
import {ROUTE_KIND, paceOf} from '../components/JourneyMap';
import {endsOf, setEnds, linksOf, stepLabel, gapKind} from './rules';
import styles from './styles.module.css';

const STATES = ['INPUT', 'PENDING', 'SCHEDULED', 'ACCEPTED', 'ALLOCATING', 'ALLOCATED', 'REPRESENTING', 'PROCESSING', 'PROCESSED', 'PAID', 'REPRESENTED', 'DECLINED', 'CANCELLED', 'DISALLOWED', 'RETURNED'];
const MODES = [
  ['live', 'A caller', 'A caller waits for this step to finish.'],
  ['background', 'Nobody', 'Nobody waits. It runs in the background.'],
  ['awaiting', 'Outside', 'It waits for something from outside before it runs.'],
];
const KIND_OF_PACE = {live: 'live-step', background: 'background-step', await: 'awaiting-step'};
const STATUS = [
  ['tbd', 'Still being defined'],
  ['unmapped', 'Not yet mapped in the spec'],
  ['read-only', 'Read-only, no workflow'],
];
const triggerOptions = Object.entries(TRIGGERS).map(([k, v]) => [k, `${v.word}: ${v.note}`]);

/* ---- fields ----------------------------------------------------------- */

/* A single control sits in a label; a row of buttons sits in a plain box,
   so clicking the heading can't press the first button. */
function Field({label, hint, group, children}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={styles.f}>
      <span className={styles.fLabel}>{label}</span>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </Tag>
  );
}

function Text({id, value, onChange, placeholder, area}) {
  const Tag = area ? 'textarea' : 'input';
  return (
    <Tag
      id={id}
      className={styles.input}
      type={area ? undefined : 'text'}
      value={value ?? ''}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* A list typed as one line, split on commas. It keeps its own text while you
   type, so the comma you just typed doesn't vanish, and takes the list again
   when it changes from outside (an undo, say). */
function CommaList({id, value, onChange, placeholder}) {
  const joined = (value || []).join(', ');
  const [text, setText] = useState(joined);
  const parse = (t) => t.split(',').map((x) => x.trim()).filter(Boolean);
  useEffect(() => {
    if (parse(text).join(', ') !== joined) setText(joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  return (
    <input
      id={id}
      className={styles.input}
      type="text"
      value={text}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

function Select({id, value, options, onChange}) {
  return (
    <select id={id} className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Seg({value, options, onChange, label}) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => v !== value && onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Check({id, checked, onChange, label}) {
  return (
    <label className={styles.check} htmlFor={id}>
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const Row = ({children}) => <div className={styles.row}>{children}</div>;
const Btn = ({kind, small = true, className, ...p}) => (
  <button type="button" className={clsx(styles.btn, small && styles.small, kind && styles[kind], className)} {...p} />
);
const Sub = ({children}) => <div className={styles.sub}>{children}</div>;

/* The colour of one kind of part, for every journey at once. */
function Colour({kind, api}) {
  const K = KINDS[kind];
  const now = api.T[kind];
  const set = (v) => {
    if (now === v) return;
    api.T[kind] = v;
    api.commit(`${K.label}: ${SWATCHES[v]}, in every journey`);
  };
  return (
    <div className={styles.colour}>
      <p className={styles.colourHead}>
        Colour of {K.label.toLowerCase()}
        <span>Changes it in every journey, and in the key</span>
      </p>
      <div className={styles.swatches} role="radiogroup" aria-label={`Colour of ${K.label.toLowerCase()}`}>
        {K.set.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={now === n}
            className={styles.sw}
            title={SWATCHES[n]}
            aria-label={SWATCHES[n]}
            style={{'--c': `var(--jm-sw-${n})`, '--ci': `var(--jm-sw-${n}-ink)`}}
            onClick={() => set(n)}
          />
        ))}
      </div>
      <span className={styles.swName}>
        {SWATCHES[now]}
        {now === api.siteTheme[kind] ? ', as the site has it' : ''}
      </span>
      {now !== api.siteTheme[kind] && (
        <button type="button" className={styles.linkBtn} onClick={() => set(api.siteTheme[kind])}>
          Back to {SWATCHES[api.siteTheme[kind]]}
        </button>
      )}
    </div>
  );
}

/* ---- the forms -------------------------------------------------------- */

function Head({api}) {
  const J = api.J;
  return {
    title: 'This journey',
    body: (
      <>
        <Field label="Name">
          <Text id="st-title" value={J.title} onChange={(v) => ((J.title = v), api.commit(`Journey name is now "${v}"`, 'head-title'))} />
        </Field>
        <Field label="Line above the name">
          <Text
            id="st-eyebrow"
            value={J.eyebrow}
            placeholder="Optional"
            onChange={(v) => (v ? (J.eyebrow = v) : delete J.eyebrow, api.commit('Line above the name changed', 'head-eyebrow'))}
          />
        </Field>
        <Field label="Who starts it" group>
          <Seg
            label="Who starts it"
            value={J.kind}
            options={[
              ['customer', 'A customer'],
              ['system', 'A system'],
            ]}
            onChange={(v) => ((J.kind = v), api.commit(`Journey is now started by ${v === 'customer' ? 'a customer' : 'a system'}`))}
          />
        </Field>
        {J.status && (
          <>
            <Field label="Why there are no steps">
              <Select id="st-skind" value={J.status.kind} options={STATUS} onChange={(v) => ((J.status.kind = v), api.commit('Reason for no steps changed'))} />
            </Field>
            <Field label="What to say">
              <Text id="st-snote" area value={J.status.note} onChange={(v) => ((J.status.note = v), api.commit('Note on why there are no steps changed', 'status-note'))} />
            </Field>
          </>
        )}
      </>
    ),
  };
}

function Route({api, group, k}) {
  const J = api.J;
  if (group === 'origin') {
    const o = J.origin || (J.origin = {});
    return {
      title: 'Who starts it',
      body: (
        <>
          <Field label="Who">
            <Text id="st-actor" value={o.actor} placeholder="Such as Cardmember" onChange={(v) => (v ? (o.actor = v) : delete o.actor, api.commit('"From" changed', 'origin-actor'))} />
          </Field>
          <Field label="Ways in" hint="Separate them with commas.">
            <CommaList
              id="st-channels"
              value={o.channels}
              placeholder="Such as Web, Mobile app"
              onChange={(list) => (list.length ? (o.channels = list) : delete o.channels, api.commit('"From" ways in changed', 'origin-channels'))}
            />
          </Field>
          <Field label="Text on hover">
            <Text id="st-onote" value={o.note} placeholder="Optional" onChange={(v) => (v ? (o.note = v) : delete o.note, api.commit('"From" hover text changed', 'origin-note'))} />
          </Field>
        </>
      ),
    };
  }
  const arr = J[group];
  const it = arr[k];
  const noun = {entry: 'Entry point', core: 'Billpay API', workflow: 'Workflow'}[group];
  const isWf = group === 'workflow';
  const kinds = Object.entries(ROUTE_KIND).filter(([v]) => v !== 'workflow');
  return {
    title: noun,
    body: (
      <>
        {!isWf && (
          <Field label="Kind">
            <Select id="st-rkind" value={it.kind || ''} options={[['', 'Not given'], ...kinds]} onChange={(v) => (v ? (it.kind = v) : delete it.kind, api.commit(`${noun} ${k + 1}: kind is now ${ROUTE_KIND[v] || 'not given'}`))} />
          </Field>
        )}
        <Field label="Name">
          <Text id="st-rlabel" value={it.label} onChange={(v) => ((it.label = v), api.commit(`${noun} ${k + 1}: name is now "${v}"`, `route-${group}-${k}-label`))} />
        </Field>
        <Field label="Note beside it">
          <Text id="st-rnote" value={it.note} placeholder="Optional" onChange={(v) => (v ? (it.note = v) : delete it.note, api.commit(`${noun} ${k + 1}: note changed`, `route-${group}-${k}-note`))} />
        </Field>
        {isWf && (
          <Check
            id="st-child"
            checked={it.child}
            label="A parent workflow starts this one"
            onChange={(on) => (on ? (it.child = true) : delete it.child, api.commit(`${noun} "${it.label}": ${on ? 'now a child workflow' : 'no longer a child workflow'}`))}
          />
        )}
        <Row>
          <span className={styles.grow} />
          <Btn
            kind="danger"
            onClick={() => {
              arr.splice(k, 1);
              if (!arr.length) delete J[group];
              api.close();
              api.commit(`${noun} "${it.label}" removed`);
            }}>
            Remove
          </Btn>
        </Row>
      </>
    ),
  };
}

function Step({api, i, opts}) {
  const J = api.J;
  const st = J.steps[i];
  const n = i + 1;
  const mode = st.mode || 'live';
  const notes = (J.detail || []).filter((d) => d.step === n).length;
  const [confirm, setConfirm] = useState(!!opts.confirmDelete);
  useEffect(() => setConfirm(!!opts.confirmDelete), [i, opts.confirmDelete]);
  const del = (how) => api.deleteStep(i, how);
  return {
    title: `Step ${n}`,
    body: (
      <>
        <Field label="Name">
          <Text
            id="st-name"
            value={st.name}
            onChange={(v) => {
              const old = st.name;
              J.steps.forEach((x) => linksOf(x).forEach((l) => old && l.to === old && (l.to = v)));
              st.name = v;
              api.commit(`Step ${n}: name is now "${v}"`, `step-${i}-name`);
            }}
          />
        </Field>
        <Field label="Who waits for it" group hint={MODES.find((m) => m[0] === mode)[2]}>
          <Seg
            label="Who waits for it"
            value={mode}
            options={MODES.map(([v, l]) => [v, l])}
            onChange={(v) => {
              st.mode = v;
              delete st.waiting;
              api.commit(`${stepLabel(J, i)}: ${MODES.find((m) => m[0] === v)[2].replace(/\.$/, '').toLowerCase()}`);
            }}
          />
        </Field>
        <Field label="State it reaches">
          <Select
            id="st-state"
            value={st.state || ''}
            options={[['', 'Same as the step before'], ...STATES.map((x) => [x, x])]}
            onChange={(v) => (v ? (st.state = v) : delete st.state, api.commit(`${stepLabel(J, i)}: ${v ? `state is now ${v}` : 'keeps the state of the step before'}`))}
          />
        </Field>
        <Field label="Text on hover">
          <Text id="st-caption" value={st.caption} placeholder="Optional" onChange={(v) => (v ? (st.caption = v) : delete st.caption, api.commit(`Step ${n}: hover text changed`, `step-${i}-caption`))} />
        </Field>
        <Row>
          <Btn disabled={i === 0} onClick={() => api.moveStep(i, i - 1)} aria-label="Move earlier">
            Earlier
          </Btn>
          <Btn disabled={i === J.steps.length - 1} onClick={() => api.moveStep(i, i + 2)} aria-label="Move later">
            Later
          </Btn>
          <span className={styles.grow} />
          <Btn kind="danger" onClick={() => (notes ? setConfirm(true) : del())}>
            Delete step
          </Btn>
        </Row>
        {confirm && (
          <div className={styles.confirm}>
            <span>{notes === 1 ? 'A note under the diagram explains' : `${notes} notes under the diagram explain`} this step.</span>
            <Row>
              <Btn kind="danger" autoFocus onClick={() => del('delete')}>
                Delete the step and {notes === 1 ? 'its note' : 'its notes'}
              </Btn>
              <Btn onClick={() => del('keep')}>Delete the step, keep {notes === 1 ? 'the note' : 'the notes'}</Btn>
            </Row>
          </div>
        )}
        <Btn onClick={() => api.startLink(i)}>Link to another step</Btn>
        <Colour kind={KIND_OF_PACE[paceOf(st)]} api={api} />
      </>
    ),
  };
}

function Outside({api, i}) {
  const J = api.J;
  const st = J.steps[i];
  const t = st.trigger;
  const label = stepLabel(J, i);
  return {
    title: `Step ${i + 1}: from outside`,
    body: (
      <>
        {i === 0 && !t && (
          <Field label="Word for how it starts">
            <Text
              id="st-arrives"
              value={st.arrives}
              placeholder={J.kind === 'system' ? 'start' : 'request'}
              onChange={(v) => (v ? (st.arrives = v) : delete st.arrives, api.commit(`Step 1: starts with "${v || (J.kind === 'system' ? 'start' : 'request')}"`, 'arrives'))}
            />
          </Field>
        )}
        <Check
          id="st-hasTrigger"
          checked={!!t}
          label="An event from outside starts or resumes this step"
          onChange={(on) => {
            if (on) st.trigger = {kind: 'signal', name: 'New event'};
            else delete st.trigger;
            api.commit(`${label}: ${on ? 'now started by an event from outside' : 'no event from outside'}`);
            if (on) api.focusSoon('st-tname');
          }}
        />
        {t && (
          <Sub>
            <Field label="Event name" hint="Shown in the lane.">
              <Text id="st-tname" value={t.name} placeholder="Such as Bank Settled Event" onChange={(v) => ((t.name = v), api.commit(`${label}: event is now "${v}"`, `trig-${i}-name`))} />
            </Field>
            <Field label="How it arrives">
              <Select id="st-tkind" value={t.kind} options={triggerOptions} onChange={(v) => ((t.kind = v), api.commit(`${label}: event now arrives as a ${TRIGGERS[v].word.toLowerCase()}`))} />
            </Field>
            <Field label="What it is">
              <Text id="st-tlabel" value={t.label} placeholder="One line, shown on hover" onChange={(v) => (v ? (t.label = v) : delete t.label, api.commit(`${label}: event hover text changed`, `trig-${i}-label`))} />
            </Field>
          </Sub>
        )}
        <Check
          id="st-hasReply"
          checked={st.reply != null}
          label="This step answers the caller"
          onChange={(on) => {
            if (on) st.reply = 'to the caller';
            else delete st.reply;
            api.commit(`${label}: ${on ? 'now answers the caller' : 'no longer answers the caller'}`);
            if (on) api.focusSoon('st-reply');
          }}
        />
        {st.reply != null && (
          <Sub>
            <Field label="Who gets what">
              <Text id="st-reply" value={st.reply} placeholder="Such as to the caller with PENDING" onChange={(v) => ((st.reply = v), api.commit(`${label}: reply text changed`, `reply-${i}`))} />
            </Field>
          </Sub>
        )}
        {t && <Colour kind="trigger" api={api} />}
      </>
    ),
  };
}

function NewSystem({api, onAdd, open}) {
  const [name, setName] = useState('');
  const [full, setFull] = useState('');
  const [err, setErr] = useState('');
  return (
    <details className={styles.newSys} open={open}>
      <summary>+ A system that isn't on the list</summary>
      <Sub>
        <Field label="Name">
          <Text id="st-sysname" value={name} placeholder="Shown in the lane, such as Fraud Hub" onChange={setName} />
        </Field>
        <Field label="Full name">
          <Text id="st-sysfull" value={full} placeholder="Shown on hover, such as Fraud Hub, which scores the payment" onChange={setFull} />
        </Field>
        <Btn
          kind="primary"
          onClick={() => {
            const n = name.trim();
            if (!n) return setErr('Give the system a name.');
            if (api.systems.some((s) => s.name === n)) return setErr(`${n} is already on the list. Pick it above.`);
            setErr('');
            setName('');
            setFull('');
            return onAdd({name: n, full: full.trim() || n});
          }}>
          Add it, and call it here
        </Btn>
        <p className={styles.hint}>It joins the list for every journey.</p>
        {err && <p className={styles.errs}>{err}</p>}
      </Sub>
    </details>
  );
}

function Calls({api, i, opts}) {
  const J = api.J;
  const st = J.steps[i];
  const label = stepLabel(J, i);
  const on = new Set(st.systems || []);
  const toggle = (n) => {
    const list = st.systems || [];
    st.systems = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
    if (!st.systems.length) delete st.systems;
    api.commit(`${label}: ${list.includes(n) ? 'no longer calls' : 'now calls'} ${n}`);
  };
  return {
    title: `Step ${i + 1}: calls`,
    body: (
      <>
        <Field label="Systems it calls" group hint="Hover over a system for its full name.">
          <div className={styles.chips}>
            {api.systems.map((s) => (
              <button key={s.name} type="button" className={styles.chip} aria-pressed={on.has(s.name)} title={s.full} onClick={() => toggle(s.name)}>
                {s.name}
              </button>
            ))}
          </div>
        </Field>
        <NewSystem
          api={api}
          open={!!opts.newSystem}
          onAdd={(sys) => {
            api.S.push(sys);
            st.systems = [...(st.systems || []), sys.name];
            api.commit(`New system ${sys.name} added to the list, and ${label} calls it`);
          }}
        />
        <Check
          id="st-hasPoll"
          checked={!!st.poll}
          label="Repeats one call until it has an answer"
          onChange={(v) => {
            if (v) st.poll = {label: ''};
            else delete st.poll;
            api.commit(`${label}: ${v ? 'now repeats a call' : 'no repeated call'}`);
            if (v) api.focusSoon('st-plabel');
          }}
        />
        {st.poll && (
          <Sub>
            <Field label="The call">
              <Text id="st-plabel" value={st.poll.label} placeholder="Such as GET /payment-status" onChange={(v) => ((st.poll.label = v), api.commit(`${label}: repeated call changed`, `poll-${i}-label`))} />
            </Field>
            <Field label="Text on hover">
              <Text id="st-pnote" value={st.poll.note} placeholder="Optional" onChange={(v) => (v ? (st.poll.note = v) : delete st.poll.note, api.commit(`${label}: repeated call changed`, `poll-${i}-note`))} />
            </Field>
          </Sub>
        )}
        <Colour kind="call" api={api} />
      </>
    ),
  };
}

function Ends({api, i}) {
  const J = api.J;
  const st = J.steps[i];
  const label = stepLabel(J, i);
  const ends = endsOf(st);
  const change = (k, f, v) => {
    const list = endsOf(st).map((e) => ({...e}));
    if (v) list[k][f] = v;
    else delete list[k][f];
    setEnds(st, list);
    api.commit(`${label}: an end changed`, `end-${i}-${k}-${f}`);
  };
  return {
    title: `Step ${i + 1}: where it can end`,
    body: (
      <>
        {ends.length ? (
          <div className={styles.f}>
            <span className={styles.fLabel}>State, and why</span>
            {ends.map((e, k) => (
              <div key={k} className={styles.endRow}>
                <Select id={`st-es${k}`} value={e.state || ''} options={[['', 'Not a state'], ...STATES.map((x) => [x, x])]} onChange={(v) => change(k, 'state', v)} />
                <Text id={`st-el${k}`} value={e.label} placeholder="Why, such as failed" onChange={(v) => change(k, 'label', v)} />
                <button
                  type="button"
                  className={styles.rm}
                  aria-label="Remove this end"
                  title="Remove"
                  onClick={() => {
                    const list = endsOf(st).map((x) => ({...x}));
                    list.splice(k, 1);
                    setEnds(st, list);
                    api.commit(`${label}: an end removed`);
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.hint}>The payment cannot end at this step.</p>
        )}
        <Btn
          onClick={() => {
            const list = endsOf(st).map((x) => ({...x}));
            list.push({state: 'DECLINED'});
            setEnds(st, list);
            api.commit(`${label}: can now end DECLINED`);
            api.focusSoon(`st-el${list.length - 1}`);
          }}>
          + Add an end
        </Btn>
      </>
    ),
  };
}

function State({api, i, run}) {
  const J = api.J;
  const idx = run && run.length ? run : [i];
  const current = (J.steps[idx[0]] && J.steps[idx[0]].state) || '';
  const span = idx.length > 1 ? `steps ${idx[0] + 1} to ${idx[idx.length - 1] + 1}` : `step ${idx[0] + 1}`;
  return {
    title: `State for ${span}`,
    body: (
      <>
        <Field label="State">
          <Select
            id="st-runstate"
            value={current}
            options={STATES.map((x) => [x, x])}
            onChange={(v) => {
              idx.forEach((k) => J.steps[k] && J.steps[k].state && (J.steps[k].state = v));
              api.commit(`${span[0].toUpperCase() + span.slice(1)}: state is now ${v}`);
            }}
          />
        </Field>
        <p className={styles.hint}>To give one step its own state, click the step.</p>
      </>
    ),
  };
}

function Gap({api, b}) {
  const J = api.J;
  const steps = J.steps || [];
  const n = steps.length;
  const next = steps[b];
  const middle = b > 0 && b < n;
  const how = middle ? gapKind(next) : null;
  const title = b === 0 ? 'Before step 1' : b === n ? `After step ${n}` : `Between step ${b} and step ${b + 1}`;
  const said = {
    straight: `Step ${b + 1} runs as soon as step ${b} is done.`,
    wait: `Step ${b + 1} waits for something outside first.`,
    event: `An event from outside starts step ${b + 1}. It shows in pink.`,
  };
  return {
    title,
    body: (
      <>
        {middle && (
          <>
            <Field label="What happens here" group hint={said[how]}>
              <Seg
                label="What happens here"
                value={how}
                options={[
                  ['straight', 'Straight on'],
                  ['wait', 'A wait'],
                  ['event', 'An event'],
                ]}
                onChange={(v) => {
                  if (v === 'straight') {
                    delete next.trigger;
                    if (next.mode === 'awaiting') next.mode = 'background';
                    delete next.waiting;
                  }
                  if (v === 'wait') {
                    delete next.trigger;
                    next.mode = 'awaiting';
                  }
                  if (v === 'event') next.trigger = {kind: 'signal', name: 'New event'};
                  api.commit(`Before ${stepLabel(J, b)}: ${{straight: 'straight on', wait: 'a wait', event: 'an event from outside'}[v]}`);
                  if (v === 'event') api.focusSoon('st-gname');
                }}
              />
            </Field>
            {how === 'event' && (
              <Sub>
                <Field label="Event name">
                  <Text id="st-gname" value={next.trigger.name} onChange={(v) => ((next.trigger.name = v), api.commit(`${stepLabel(J, b)}: event is now "${v}"`, `trig-${b}-name`))} />
                </Field>
                <Field label="How it arrives">
                  <Select id="st-gkind" value={next.trigger.kind} options={triggerOptions} onChange={(v) => ((next.trigger.kind = v), api.commit(`${stepLabel(J, b)}: event now arrives as a ${TRIGGERS[v].word.toLowerCase()}`))} />
                </Field>
              </Sub>
            )}
          </>
        )}
        <Btn kind="primary" small={false} onClick={() => api.addStep(b)}>
          + Add a step {b === 0 ? 'at the start' : b === n ? 'at the end' : 'here'}
        </Btn>
      </>
    ),
  };
}

function Note({api, k}) {
  const J = api.J;
  const d = J.detail[k];
  return {
    title: `Note ${k + 1}`,
    body: (
      <>
        <Field label="Explains">
          <Select
            id="st-nstep"
            value={d.step ? String(d.step) : ''}
            options={[['', 'No step: a note between steps'], ...J.steps.map((st, i) => [String(i + 1), `Step ${i + 1}, ${st.name}`])]}
            onChange={(v) => (v ? (d.step = Number(v)) : delete d.step, api.commit(`Note ${k + 1}: ${v ? `now explains step ${v}` : 'now a note between steps'}`))}
          />
        </Field>
        <Field label="Text" hint="Use `backticks` for names in code and **two stars** for bold.">
          <Text id="st-ntext" area value={d.text} onChange={(v) => ((d.text = v), api.commit(`Note ${k + 1}: text changed`, `note-${k}`))} />
        </Field>
        <Row>
          <span className={styles.grow} />
          <Btn
            kind="danger"
            onClick={() => {
              J.detail.splice(k, 1);
              if (!J.detail.length) delete J.detail;
              api.close();
              api.commit(`Note ${k + 1} deleted`);
              api.toast(`Note ${k + 1} deleted.`);
            }}>
            Delete note
          </Btn>
        </Row>
      </>
    ),
  };
}

function LinkForm({api, i, k}) {
  const J = api.J;
  const from = J.steps[i];
  const l = from.links[k];
  const opts = J.steps.map((x, n) => [x.name, `Step ${n + 1}, ${x.name}`]);
  const targetKnown = J.steps.some((x) => x.name === l.to);
  return {
    title: 'Link',
    body: (
      <>
        <Field label="From">
          <Select
            id="st-lfrom"
            value={from.name}
            options={opts}
            onChange={(v) => {
              const ni = J.steps.findIndex((x) => x.name === v);
              from.links.splice(k, 1);
              if (!from.links.length) delete from.links;
              const to = J.steps[ni];
              to.links = [...linksOf(to), l];
              api.commit(`Link "${l.label}" now starts at ${stepLabel(J, ni)}`);
              api.open(`link:${ni}:${to.links.length - 1}`);
            }}
          />
        </Field>
        <Field label="To">
          <Select id="st-lto" value={l.to} options={targetKnown ? opts : [[l.to, `${l.to} (not a step)`], ...opts]} onChange={(v) => ((l.to = v), api.commit(`Link from ${stepLabel(J, i)} now goes to ${v}`))} />
        </Field>
        <Field label="Why" hint="Shown on the line.">
          <Text id="st-llabel" value={l.label} placeholder="A few words, such as retry" onChange={(v) => ((l.label = v), api.commit(`Link from ${stepLabel(J, i)}: "${v}"`, `link-${i}-${k}`))} />
        </Field>
        <Row>
          <span className={styles.grow} />
          <Btn
            kind="danger"
            onClick={() => {
              from.links.splice(k, 1);
              if (!from.links.length) delete from.links;
              api.close();
              api.commit(`Link from ${stepLabel(J, i)} to ${l.to} deleted`);
              api.toast('Link deleted.');
            }}>
            Delete link
          </Btn>
        </Row>
        <Colour kind="link" api={api} />
      </>
    ),
  };
}

function Legend({api, kind}) {
  return {title: KINDS[kind].label, body: <Colour kind={kind} api={api} />};
}

/* The form for a key such as "step:3" or "link:2:0", or null when the part
   it names has gone (deleted, or undone away). */
export function formFor(key, api, opts) {
  const [part, a, b] = key.split(':');
  const J = api.J;
  const steps = J.steps || [];
  const i = Number(a);
  switch (part) {
    case 'head':
      return {Form: Head, props: {}};
    case 'route':
      if (a !== 'origin' && !(J[a] && J[a][Number(b)])) return null;
      return {Form: Route, props: {group: a, k: Number(b)}};
    case 'step':
      return steps[i] ? {Form: Step, props: {i}} : null;
    case 'outside':
      return steps[i] ? {Form: Outside, props: {i}} : null;
    case 'calls':
      return steps[i] ? {Form: Calls, props: {i}} : null;
    case 'ends':
      return steps[i] ? {Form: Ends, props: {i}} : null;
    case 'state':
      return steps[i] ? {Form: State, props: {i, run: opts.run}} : null;
    case 'gap':
      return i <= steps.length ? {Form: Gap, props: {b: i}} : null;
    case 'note':
      return J.detail && J.detail[i] ? {Form: Note, props: {k: i}} : null;
    case 'link':
      return steps[i] && steps[i].links && steps[i].links[Number(b)] ? {Form: LinkForm, props: {i, k: Number(b)}} : null;
    case 'legend':
      return KINDS[a] ? {Form: Legend, props: {kind: a}} : null;
    default:
      return null;
  }
}

/* Forms are functions that return a title and a body, so the box can put the
   title in its own header. This renders one as a component, so the forms
   that keep a little state of their own (the delete confirmation, the new
   system) can use hooks. */
export function FormView({Form, props, api, opts, errors, onClose}) {
  const {title, body} = Form({api, opts, ...props});
  return (
    <>
      <div className={styles.popHead}>
        <b id="st-pop-title">{title}</b>
        <button type="button" className={styles.x} aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.popBody}>
        {errors.length > 0 && (
          <p className={styles.errs}>
            {errors.map((e, n) => (
              <React.Fragment key={n}>
                {n > 0 && <br />}
                {e.msg}
              </React.Fragment>
            ))}
          </p>
        )}
        {body}
      </div>
    </>
  );
}
