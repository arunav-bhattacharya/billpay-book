import React from 'react';
import DataTable from '../DataTable';
import styles from './styles.module.css';

/**
 * ScheduleTable: the Temporal Schedules and the workflow each one starts.
 *
 * Every Schedule lives on the Offline cluster, so the workflow names carry the
 * same tone the Offline card uses rather than the global code blue. A name that
 * is a workflow class renders as code; a description, such as "the leg
 * dispatcher", stays as text. The `runs` column appears when any row has one.
 *
 * rows: [{schedule, workflow, runs?}]
 */
const isClass = (name) => /^[A-Z][A-Za-z]+Workflow$/.test(String(name));

const BASE = [
  {
    key: 'schedule',
    header: 'Schedule',
    width: '30%',
    rowHeader: true,
    className: styles.scheduleCell,
  },
  {
    key: 'workflow',
    header: 'Workflow it starts',
    className: styles.wfCell,
    render: (r) => (isClass(r.workflow) ? <code className={styles.wf}>{r.workflow}</code> : r.workflow),
  },
];

const RUNS = {key: 'runs', header: 'Runs', className: styles.runsCell};

export default function ScheduleTable({rows = []}) {
  const columns = rows.some((r) => r.runs) ? [...BASE, RUNS] : BASE;
  return (
    <DataTable
      className={styles.table}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.schedule}
    />
  );
}
