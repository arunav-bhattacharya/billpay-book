import ordinal from './ordinal';

/**
 * The nine top-level sections, in sidebar order.
 *
 * The order here is the numbering: Vision is 01. The number becomes the
 * section badge in the page banner (via DocItem/Layout) and matches the
 * sidebar badges and the homepage board.
 */
export const SECTION_ORDER = [
  'vision',
  'architecture',
  'design',
  'onboarding',
  'build',
  'testing',
  'deployment',
  'observability',
  'operations',
];

/** A section whose name isn't just its slug with a capital letter. */
const LABELS = {
  onboarding: 'Market Onboarding',
};

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
    label: LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}
