import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');

// --ink-faint carries small uppercase labels: table headers, h4, eyebrow
// kickers, the app bar. At 3.18 on the light ground it was below WCAG AA for
// normal-size text. #646D76 brings it to 4.51 on paper and 4.94 on surface,
// and #756345 does the same for sepia (4.59 / 5.02). Measured, not eyeballed.
const FIX = [
  // light theme, both places it is declared
  ['--ink:      #191D21;\n    --ink-soft: #4E5862;\n    --ink-faint:#7C868F;',
   '--ink:      #191D21;\n    --ink-soft: #4E5862;\n    --ink-faint:#646D76;'],
  ['--ink:#191D21; --ink-soft:#4E5862; --ink-faint:#7C868F;',
   '--ink:#191D21; --ink-soft:#4E5862; --ink-faint:#646D76;'],
  // the :root default block uses a different layout again
  ['  --ink-faint:  #7C868F;', '  --ink-faint:  #646D76;'],
  // sepia
  ['--ink:#332A1C; --ink-soft:#5B4A33; --ink-faint:#8A7857;',
   '--ink:#332A1C; --ink-soft:#5B4A33; --ink-faint:#756345;'],
];

let n = 0;
for (const [a, b] of FIX) {
  while (h.includes(a)) { h = h.replace(a, b); n += 1; if (n > 10) break; }
}
if (!n) throw new Error('no ink-faint declarations matched');
writeFileSync(p, h);
console.log(`raised --ink-faint contrast in ${n} declaration(s)`);
console.log('remaining old values:', (h.match(/#7C868F|#8A7857/g) || []).length);
