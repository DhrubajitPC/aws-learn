import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const NL = String.fromCharCode(92) + 'n'; // the two characters \ and n as they appear in the JS source

const F = [
  // 1. line spans are blocks in BOTH modes, so no newline text nodes are needed
  [`/* Hanging indent. Each source line is its own block, so a line that wraps
   continues at 2.4ch while real lines stay flush with their own indentation.
   Without this, wrapped Terraform is very hard to read: you cannot tell a
   continuation from a new attribute. */
body.wrap-code .code pre .cl {
  display: block;
  padding-left: 2.4ch;
  text-indent: -2.4ch;
}
/* Blank lines still need their height, and :empty keeps the copied text exact. */
body.wrap-code .code pre .cl:empty { height: 1.6em; }`,
   `/* Each source line becomes a block, in BOTH modes. Keeping it block when
   unwrapped means no newline text nodes are needed in the DOM, which is what
   stops innerText emitting a blank line between every line. */
.code pre .cl { display: block; }
.code pre .cl:empty { min-height: 1.6em; min-height: 1lh; }

/* Hanging indent, wrapped mode only: a line that wraps continues at 2.4ch
   while real lines stay flush with their own indentation. Without it you
   cannot tell a continuation from a new attribute. */
body.wrap-code .code pre .cl {
  padding-left: 2.4ch;
  text-indent: -2.4ch;
}`],

  // 2. splitter: drop the newline nodes, stash the original text
  [`      var lines = code.textContent.split('${NL}');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < lines.length; i++) {
        var span = document.createElement('span');
        span.className = 'cl';
        span.textContent = lines[i];
        frag.appendChild(span);
        // Keep a real newline between lines so innerText, textContent and
        // clipboard output all still match the original source.
        if (i < lines.length - 1) { frag.appendChild(document.createTextNode('${NL}')); }
      }
      code.textContent = '';
      code.appendChild(frag);
      code.dataset.split = '1';`,
   `      // Stash the exact source before rewriting the DOM. Held in a Map
      // rather than a data attribute so the page weight does not double.
      rawCode.set(code.closest('pre'), code.textContent);

      var lines = code.textContent.split('${NL}');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < lines.length; i++) {
        var span = document.createElement('span');
        span.className = 'cl';
        span.textContent = lines[i];
        frag.appendChild(span);
      }
      code.textContent = '';
      code.appendChild(frag);
      code.dataset.split = '1';`],

  // 3. declare the Map
  [`  function splitLines(scope) {
    if (!scope) { return; }`,
   `  var rawCode = new Map();

  function splitLines(scope) {
    if (!scope) { return; }`],

  // 4. copy from the stashed source
  [`    var pre = btn.closest('.code').querySelector('pre');
    var text = pre.innerText;`,
   `    var pre = btn.closest('.code').querySelector('pre');
    // Not innerText: it is CSS-aware and adds a newline per block-level line
    // span. The Map holds the pre-split original for line-wrapped blocks.
    var text = rawCode.get(pre) || pre.textContent;`],
];

let n = 0;
for (const [a, b] of F) {
  if (!h.includes(a)) throw new Error('MISS: ' + a.slice(0, 80));
  h = h.replace(a, b);
  n++;
}
writeFileSync(p, h);
console.log('applied', n, 'fixes');
