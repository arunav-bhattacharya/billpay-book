/**
 * Lets the site import the YAML files under website/diagrams, each checked
 * against its schema on the way in, and adds the Diagram Studio at /studio.
 * See website/diagrams/README.md.
 *
 * The Studio shows an edit against each file exactly as it is written, so it
 * needs the files' text as well as their data. That text reaches the Studio's
 * route alone, as route data, and never the pages that only draw a diagram.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'diagrams');
const REPO_PREFIX = 'website/diagrams';

/* Every diagram file, by its path in the repository. */
function readSources() {
  const out = {};
  const walk = (dir) =>
    fs.readdirSync(dir, {withFileTypes: true}).forEach((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (d.name !== 'schemas') walk(p);
      } else if (/\.ya?ml$/.test(d.name)) {
        out[`${REPO_PREFIX}/${path.relative(ROOT, p).split(path.sep).join('/')}`] = fs.readFileSync(p, 'utf8');
      }
    });
  walk(ROOT);
  return out;
}

module.exports = function diagramDataPlugin(context) {
  return {
    name: 'diagram-data',
    getPathsToWatch() {
      return [path.join(ROOT, '**/*.{yaml,yml}')];
    },
    async loadContent() {
      return readSources();
    },
    async contentLoaded({content, actions}) {
      const sources = await actions.createData('diagram-sources.json', JSON.stringify(content));
      actions.addRoute({
        path: `${context.baseUrl}studio`,
        component: '@site/src/studio/index.js',
        exact: true,
        modules: {sources},
      });
    },
    configureWebpack() {
      return {
        module: {
          rules: [
            {
              test: /\.ya?ml$/,
              include: [ROOT],
              type: 'javascript/auto',
              use: [{loader: path.join(__dirname, 'loader.js')}],
            },
          ],
        },
      };
    },
  };
};
