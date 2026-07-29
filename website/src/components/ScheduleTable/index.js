import React from 'react';
import styles from './styles.module.css';

/**
 * ScheduleTable — the Temporal Schedules and the workflow each one fires.
 *
 * Every one of these runs on the Offline worker, so the workflow names carry
 * the same gold the Offline card uses rather than the global code blue.
 *
 * rows: [{schedule, workflow, cadence?}]
 */
export default function ScheduleTable({rows = []}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thSchedule}>Schedule</th>
            <th>Workflow it fires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.schedule}>
              <th scope="row" className={styles.scheduleCell}>
                {r.schedule}
              </th>
              <td className={styles.wfCell}>
                <code className={styles.wf}>{r.workflow}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
