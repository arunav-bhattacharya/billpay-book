import React, {useState} from 'react';
import Link from '@docusaurus/Link';

function TOCNode({heading, className, linkClassName}) {
  const hasChildren = heading.children && heading.children.length > 0;
  const [open, setOpen] = useState(true);

  return (
    <li className={hasChildren ? 'bp-toc-group' : undefined}>
      <div className="bp-toc-row">
        {hasChildren && (
          <button
            type="button"
            className="bp-toc-group__btn"
            aria-expanded={open}
            aria-label={open ? 'Collapse section' : 'Expand section'}
            onClick={() => setOpen((v) => !v)}>
            <span className="bp-toc-group__icon" aria-hidden="true">▾</span>
          </button>
        )}
        <Link
          to={`#${heading.id}`}
          className={linkClassName ?? undefined}
          dangerouslySetInnerHTML={{__html: heading.value}}
        />
      </div>
      {hasChildren && open && (
        <TOCItemTree
          isChild
          toc={heading.children}
          className={className}
          linkClassName={linkClassName}
        />
      )}
    </li>
  );
}

function TOCItemTree({toc, className, linkClassName, isChild}) {
  if (!toc.length) return null;
  return (
    <ul className={isChild ? undefined : className}>
      {toc.map((heading) => (
        <TOCNode
          key={heading.id}
          heading={heading}
          className={className}
          linkClassName={linkClassName}
        />
      ))}
    </ul>
  );
}

export default React.memo(TOCItemTree);
