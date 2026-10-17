import React from 'react';
import Link from '@docusaurus/Link';

/**
 * The two bits of markdown that table data still needs.
 *
 * Row data is authored as plain strings so a page stays readable as source,
 * but a cell often wants to mark the phrase that is the point of it, or name a
 * field as code. Both are the same operation: split on a delimiter, wrap the
 * odd pieces, leave the even ones as text.
 */

/** Wrap the odd-index parts of a split, leave the even ones as they are. */
function wrapOdd(parts, wrap) {
  return parts.map((part, i) =>
    i % 2 ? wrap(part, i) : <React.Fragment key={i}>{part}</React.Fragment>,
  );
}

/**
 * `**phrase**` becomes the emphasised part of a cell.
 * Anything that is not a string is handed back untouched, so a cell can hold
 * real markup instead.
 */
export function bold(text, className) {
  if (typeof text !== 'string') {
    return text;
  }
  return wrapOdd(text.split('**'), (part, i) => (
    <strong key={i} className={className}>
      {part}
    </strong>
  ));
}

/** `` `phrase` `` becomes code. */
export function ticks(text) {
  if (typeof text !== 'string') {
    return text;
  }
  return wrapOdd(text.split(/`([^`]+)`/), (part, i) => <code key={i}>{part}</code>);
}

/**
 * `[label](target)` becomes a link, and `` `phrase` `` inside or around it
 * becomes code. Notes under a diagram are written as plain strings, so this is
 * how they point at the next page or the journey above.
 */
export function links(text) {
  if (typeof text !== 'string') {
    return text;
  }
  const parts = text.split(/\[([^\]]+)\]\(([^)\s]+)\)/);
  const out = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) {
      out.push(<React.Fragment key={`t${i}`}>{ticks(parts[i])}</React.Fragment>);
    }
    if (i + 1 < parts.length) {
      out.push(
        <Link key={`l${i}`} to={parts[i + 2]}>
          {ticks(parts[i + 1])}
        </Link>,
      );
    }
  }
  return out;
}
