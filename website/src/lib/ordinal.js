/**
 * 1 becomes "01". The site numbers its sections, principles and cards this
 * way, so the index reads as a label rather than as a count.
 *
 * A formatter rather than a component: the four places that show one of these
 * genuinely differ in size, weight, tracking and colour, and flattening them
 * would be a design change. The one thing they all need is digits that hold
 * their width, which is the `ordinal` class in css/recipes.module.css.
 */
export default function ordinal(n) {
  return String(n).padStart(2, '0');
}
