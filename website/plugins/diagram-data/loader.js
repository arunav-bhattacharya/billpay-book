/**
 * Turns a diagram's YAML file into a JavaScript module, after checking it.
 * A file with mistakes stops the build (and shows in the dev server's
 * overlay) with the plain-English list from validate.js.
 */
const {check} = require('./validate');

module.exports = function diagramYamlLoader(source) {
  const {data, errors} = check(this.resourcePath, source);
  if (errors.length) {
    throw new Error(`\n\nThis diagram file needs fixing:\n\n  - ${errors.join('\n  - ')}\n`);
  }
  return `export default ${JSON.stringify(data)};`;
};
