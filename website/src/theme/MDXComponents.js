import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';

/**
 * Every markdown table gets the panel treatment the table components carry
 * (ApiTable, ScheduleTable, CompareTable): a rounded surface with a solid
 * Amex-blue header band. A table cannot clip its own corners or scroll
 * sideways, so it needs a wrapper, and markdown gives no place to add one.
 * Styling lives in custom.css under `.mdTable`.
 */
function Table(props) {
  return (
    <div className="mdTable">
      <table {...props} />
    </div>
  );
}

export default {
  ...MDXComponents,
  table: Table,
};
