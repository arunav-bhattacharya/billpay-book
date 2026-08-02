import React from 'react';
import DataTable from '../DataTable';
import styles from './styles.module.css';

/**
 * ScheduleTable: the Temporal Schedules and the workflow each one fires.
 *
 * Every one of these runs on the Offline worker, so the workflow names carry
 * the same gold the Offline card uses rather than the global code blue.
 *
 * rows: [{schedule, workflow}]
 */
const COLUMNS = [
  {
    key: 'schedule',
    header: 'Schedule',
    width: '46%',
    rowHeader: true,
    className: styles.scheduleCell,
  },
  {
    key: 'workflow',
    header: 'Workflow it fires',
    className: styles.wfCell,
    render: (r) => <code className={styles.wf}>{r.workflow}</code>,
  },
];

export default function ScheduleTable({rows = []}) {
  return (
    <DataTable
      className={styles.table}
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.schedule}
    />
  );
}
