/**
 * Code blocks use GitHub's own syntax colours, light and dark, as github.com
 * shows them today (the Primer "default" palettes). prism-react-renderer's
 * built-in `github` theme is the older look and has no dark twin, so both are
 * written out here. These are syntax colours, not brand colours, so they sit
 * outside the `--amex-*` tokens on purpose.
 */

const githubLight = {
  plain: {color: '#1f2328', backgroundColor: '#f6f8fa'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: '#59636e', fontStyle: 'italic'}},
    {types: ['keyword', 'builtin', 'important', 'atrule', 'rule'], style: {color: '#cf222e'}},
    {types: ['string', 'char', 'attr-value', 'regex', 'url'], style: {color: '#0a3069'}},
    {types: ['function', 'class-name', 'maybe-class-name'], style: {color: '#8250df'}},
    {types: ['number', 'boolean', 'constant', 'symbol', 'annotation', 'property', 'attr-name'], style: {color: '#0550ae'}},
    {types: ['variable', 'parameter', 'label'], style: {color: '#953800'}},
    {types: ['tag', 'selector', 'inserted'], style: {color: '#116329'}},
    {types: ['deleted'], style: {color: '#82071e'}},
    {types: ['operator', 'punctuation', 'entity'], style: {color: '#1f2328'}},
  ],
};

const githubDark = {
  plain: {color: '#e6edf3', backgroundColor: '#0d1117'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: '#8b949e', fontStyle: 'italic'}},
    {types: ['keyword', 'builtin', 'important', 'atrule', 'rule'], style: {color: '#ff7b72'}},
    {types: ['string', 'char', 'attr-value', 'regex', 'url'], style: {color: '#a5d6ff'}},
    {types: ['function', 'class-name', 'maybe-class-name'], style: {color: '#d2a8ff'}},
    {types: ['number', 'boolean', 'constant', 'symbol', 'annotation', 'property', 'attr-name'], style: {color: '#79c0ff'}},
    {types: ['variable', 'parameter', 'label'], style: {color: '#ffa657'}},
    {types: ['tag', 'selector', 'inserted'], style: {color: '#7ee787'}},
    {types: ['deleted'], style: {color: '#ffa198'}},
    {types: ['operator', 'punctuation', 'entity'], style: {color: '#e6edf3'}},
  ],
};

module.exports = {githubLight, githubDark};
