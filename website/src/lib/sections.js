import ordinal from './ordinal';

/**
 * The eight top-level sections, in sidebar order.
 *
 * Each one owns a hue, defined as --amex-cat-<slug> in css/custom.css and used
 * by the sidebar numerals, the contents rail and the lead paragraph on every
 * page. The order here is the numbering: Vision is 01.
 */
export const SECTION_ORDER = [
  'vision',
  'architecture',
  'design',
  'build',
  'testing',
  'deployment',
  'observability',
  'operations',
];

/** Which section a docs URL belongs to, or null for anything outside them. */
export function sectionFromPath(pathname) {
  const match = (pathname || '').match(/\/docs\/([^/]+)/);
  const slug = match ? match[1] : null;
  const index = slug ? SECTION_ORDER.indexOf(slug) : -1;
  if (index === -1) {
    return null;
  }
  return {
    slug,
    number: ordinal(index + 1),
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}

/**
 * The CSS colour a page should accent with, from its URL.
 *
 * Falls back to the Vision hue off a docs page, which is where the homepage
 * and the contributing pages sit.
 */
export function accentFromPath(pathname) {
  const section = sectionFromPath(pathname);
  return `var(--amex-cat-${section ? section.slug : 'vision'})`;
}
