/**
 * Lets the site import the YAML files under website/diagrams, each checked
 * against its schema on the way in. See website/diagrams/README.md.
 */
const path = require('path');

module.exports = function diagramDataPlugin() {
  return {
    name: 'diagram-data',
    configureWebpack() {
      return {
        module: {
          rules: [
            {
              test: /\.ya?ml$/,
              include: [path.join(__dirname, '..', '..', 'diagrams')],
              type: 'javascript/auto',
              use: [{loader: path.join(__dirname, 'loader.js')}],
            },
          ],
        },
      };
    },
  };
};
