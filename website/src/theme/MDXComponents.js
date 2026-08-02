import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import {TableShell} from '@site/src/components/DataTable';

/**
 * Every markdown table gets the same chrome the table components carry: a
 * rounded surface with a solid Amex-blue header band. A table cannot clip its
 * own corners or scroll sideways, so it needs a wrapper, and markdown gives no
 * place to add one.
 *
 * This used to be a hand-maintained copy of that chrome in custom.css, which
 * meant every change had to be made twice. TableShell is the same panel the
 * components use, without the column rendering they do not need here: the
 * table arrives from MDX already built.
 */
function Table(props) {
  return (
    <TableShell>
      <table {...props} />
    </TableShell>
  );
}

export default {
  ...MDXComponents,
  table: Table,
};
