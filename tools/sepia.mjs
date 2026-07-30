import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const steps = [];
function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// ── the palette ──────────────────────────────────────────────────────
// Aged paper rather than the cream-and-terracotta default: the neutrals are
// warm, the ink is a dark walnut rather than black, and the code panel moves
// from cool slate to dark walnut so it belongs to the same world. The accent
// stays in the indigo family across all four themes so links, active nav and
// section numbers remain recognisable when you switch.
edit('sepia tokens',
  `:root[data-theme="light"] {
  --paper:#EDEEEA; --surface:#F7F8F5; --surface-2:#E3E5DF;
  --ink:#191D21; --ink-soft:#4E5862; --ink-faint:#7C868F;
  --rule:#D3D7CF; --rule-soft:#E1E4DD;
  --accent:#2C4A7C; --accent-ink:#21385F; --accent-wash:#DFE5EF;
  --ochre:#8A6516; --ochre-wash:#F1E8D4;
  --oxide:#A3402C; --oxide-wash:#F3E2DD;
  --moss:#3F6B4A; --moss-wash:#DFE9DF;
  --code-bg:#1C2126; --code-ink:#DCE1DA; --code-rule:#2E353C;
}`,
  `:root[data-theme="light"] {
  color-scheme: light;
  --paper:#EDEEEA; --surface:#F7F8F5; --surface-2:#E3E5DF;
  --ink:#191D21; --ink-soft:#4E5862; --ink-faint:#7C868F;
  --rule:#D3D7CF; --rule-soft:#E1E4DD;
  --accent:#2C4A7C; --accent-ink:#21385F; --accent-wash:#DFE5EF;
  --ochre:#8A6516; --ochre-wash:#F1E8D4;
  --oxide:#A3402C; --oxide-wash:#F3E2DD;
  --moss:#3F6B4A; --moss-wash:#DFE9DF;
  --code-bg:#1C2126; --code-ink:#DCE1DA; --code-rule:#2E353C;
}

/* Sepia: aged paper for long reading sessions. Lower contrast than the light
   theme and no blue in the ground, which is the point of a sepia mode. Ink is
   dark walnut rather than black so the contrast is soft without going muddy;
   it still clears WCAG AA on the paper ground. */
:root[data-theme="sepia"] {
  color-scheme: light;
  --paper:#EFE4CE; --surface:#F7EEDC; --surface-2:#E3D5B8;
  --ink:#332A1C; --ink-soft:#5B4A33; --ink-faint:#8A7857;
  --rule:#D7C7A6; --rule-soft:#E5D8BD;
  --accent:#2C4C7A; --accent-ink:#1F3757; --accent-wash:#E0DED2;
  --ochre:#7A5A12; --ochre-wash:#EDDFBB;
  --oxide:#98371F; --oxide-wash:#EFDAC9;
  --moss:#3D6340; --moss-wash:#E0E4CB;
  /* Dark walnut instead of the cool slate used by the other light theme. */
  --code-bg:#2A2117; --code-ink:#E6DBC5; --code-rule:#3E3324;
}`);

edit('dark colour-scheme',
  `:root[data-theme="dark"] {
  --paper:#15191C;`,
  `:root[data-theme="dark"] {
  color-scheme: dark;
  --paper:#15191C;`);

edit('media query colour-scheme',
  `@media (prefers-color-scheme: dark) {
  :root {
    --paper:      #15191C;`,
  `@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --paper:      #15191C;`);

// ── the cycle ────────────────────────────────────────────────────────
edit('theme cycle js',
  `  /* ── theme toggle: auto → light → dark ── */
  var modes = ['auto', 'light', 'dark'];
  var glyph = { auto: '◐', light: '☀', dark: '☾' };`,
  `  /* ── theme toggle: auto → light → sepia → dark ──
     Ordered by brightness so the cycle feels like a dimmer rather than a
     random walk through four options. */
  var modes = ['auto', 'light', 'sepia', 'dark'];
  var glyph = { auto: '◐', light: '☀', sepia: '▤', dark: '☾' };`);

// The stored value is now one of four; guard against an unknown string from an
// older visit or a hand-edited localStorage.
edit('theme restore guard',
  `  var mode = 'auto';
  try { mode = localStorage.getItem('idp-manual-theme') || 'auto'; } catch (e) {}`,
  `  var mode = 'auto';
  try { mode = localStorage.getItem('idp-manual-theme') || 'auto'; } catch (e) {}
  if (modes.indexOf(mode) === -1) { mode = 'auto'; }`);

writeFileSync(p, h);
console.log(steps.join('\n'));
