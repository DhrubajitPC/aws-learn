import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');

// Per-indent-level classes. For a line with n leading spaces we want the first
// visual line to sit at column n (it already does, via its own spaces) and any
// continuation to sit at n+2. That means padding-left = n+2 and text-indent =
// -(n+2). One class per level beats an inline style on all 5,794 line spans.
let rules = '';
for (let n = 0; n <= 24; n += 1) {
  rules += `body.wrap-code .code pre .i${n} { padding-left: ${n + 2}ch; text-indent: -${n + 2}ch; }\n`;
}

const FROM = `/* Hanging indent, wrapped mode only: a line that wraps continues at 2.4ch
   while real lines stay flush with their own indentation. Without it you
   cannot tell a continuation from a new attribute. */
body.wrap-code .code pre .cl {
  padding-left: 2.4ch;
  text-indent: -2.4ch;
}`;

const TO = `/* Hanging indent, wrapped mode only.

   A fixed indent is not good enough for code: a continuation of a line nested
   eight levels deep would jump to the left margin and read like a new
   top-level statement. Instead each line carries an .iN class for its own
   leading-space count, so a continuation sits two columns deeper than the
   line it belongs to. Same behaviour as VS Code's wrappingIndent: indent. */
body.wrap-code .code pre .cl { padding-left: 2ch; text-indent: -2ch; }
${rules.trimEnd()}`;

if (!h.includes(FROM)) throw new Error('indent css anchor missing');
h = h.replace(FROM, TO);

// tag each line span with its indent level while splitting
const SPLIT_FROM = `        var span = document.createElement('span');
        span.className = 'cl';
        span.textContent = lines[i];
        frag.appendChild(span);`;

const SPLIT_TO = `        var span = document.createElement('span');
        // Indent level drives which hanging-indent rule applies. Capped at 24
        // because past that the continuation would push off a phone screen.
        var lead = lines[i].length - lines[i].replace(/^ +/, '').length;
        span.className = 'cl i' + Math.min(lead, 24);
        span.textContent = lines[i];
        frag.appendChild(span);`;

if (!h.includes(SPLIT_FROM)) throw new Error('splitter anchor missing');
h = h.replace(SPLIT_FROM, SPLIT_TO);

writeFileSync(p, h);
console.log('indent-aware wrapping applied (levels 0-24)');
