/**
 * The colours a journey diagram takes from diagrams/theme.yaml: one colour
 * per kind of part, each named from the Amex palette.
 *
 * A name is never a colour value. JourneyMap's stylesheet turns each name
 * into a token pair, one for light and one for dark, so whatever the file
 * says works in both themes. The Studio offers the same names, kind by kind,
 * and the theme schema allows the same sets. Pink stays with events from
 * outside, as everywhere else on the site.
 */

export const SWATCHES = {
  'bright-blue': 'Bright Blue',
  'deep-blue': 'Deep Blue',
  'deep-400': 'Deep Blue 400',
  'light-blue': 'Light Blue',
  grey: 'Grey',
  pink: 'Trigger pink',
  'pale-blue': 'Pale Bright Blue',
  'pale-deep': 'Pale Deep Blue',
  'pale-grey': 'Pale Grey',
};

const SOLID = ['bright-blue', 'deep-blue', 'deep-400', 'light-blue', 'grey'];
const PALE = ['pale-blue', 'pale-deep', 'pale-grey'];

/* prop is the custom property JourneyMap's stylesheet reads; each also has
   an -ink partner for the type on it. */
export const KINDS = {
  'live-step': {label: 'Steps a caller waits on', def: 'bright-blue', set: SOLID, prop: '--jm-live'},
  'background-step': {label: 'Steps nobody waits on', def: 'deep-blue', set: SOLID, prop: '--jm-background'},
  'awaiting-step': {label: 'Steps that wait on something outside', def: 'pale-deep', set: [...PALE, ...SOLID], prop: '--jm-await'},
  trigger: {label: 'Events from outside', def: 'pink', set: ['pink', ...SOLID], prop: '--jm-trigger'},
  call: {label: 'Calls to other systems', def: 'pale-blue', set: PALE, prop: '--jm-call'},
  link: {label: 'Links between steps', def: 'deep-400', set: SOLID, prop: '--jm-link'},
};

export const DEFAULT_THEME = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, K.def]));

/* The inline style that points each kind at its swatch. A name the kind
   doesn't allow falls back to the default, though the check stops that
   before it gets here. */
export function themeStyle(theme = {}) {
  const style = {};
  for (const [kind, K] of Object.entries(KINDS)) {
    const name = K.set.includes(theme[kind]) ? theme[kind] : K.def;
    style[K.prop] = `var(--jm-sw-${name})`;
    style[`${K.prop}-ink`] = `var(--jm-sw-${name}-ink)`;
  }
  return style;
}
