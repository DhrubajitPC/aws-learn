import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const steps = [];

function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// ── token ────────────────────────────────────────────────────────────
// Sized to what the content actually uses, not to the screen. The widest
// child is a table or flow diagram at 104ch (~853px); 62rem gives 864px of
// inner width after the 4rem gutters, so nothing is clipped and the container
// carries no dead space on its right. A wider container would centre the box
// but leave the visible text sitting left inside it, which defeats the point.
edit('content-max token',
  `  --rail-w: 19rem;
  --measure: 74ch;`,
  `  --rail-w: 19rem;
  --measure: 74ch;
  --content-max: 62rem;`);

// ── centre the content column ────────────────────────────────────────
edit('centre .pad',
  `.pad { padding: 0 clamp(1.2rem, 4vw, 4rem); }`,
  `.pad {
  padding: 0 clamp(1.2rem, 4vw, 4rem);
  /* Centre within the space left of the rail. On a widescreen monitor the
     content was pinned to the far left with ~1,000px of dead space beside it. */
  max-width: var(--content-max);
  margin-inline: auto;
}`);

// ── the app bar needs the same treatment ─────────────────────────────
// Its background, blur and border must stay full-bleed, so the bar keeps its
// width and an inner element carries the max-width.
edit('topbar becomes a shell',
  `.topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  padding: .7rem clamp(1.2rem, 4vw, 4rem);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--rule);
  font-family: var(--mono); font-size: .68rem; color: var(--ink-faint);
  letter-spacing: .06em; text-transform: uppercase;
}`,
  `.topbar {
  position: sticky; top: 0; z-index: 20;
  padding: .7rem clamp(1.2rem, 4vw, 4rem);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--rule);
  font-family: var(--mono); font-size: .68rem; color: var(--ink-faint);
  letter-spacing: .06em; text-transform: uppercase;
}
/* Bar chrome stays full-bleed; its contents align with the article column. */
.bar-inner {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  max-width: var(--content-max);
  margin-inline: auto;
}`);

edit('bar-inner markup',
  `  <div class="topbar">
    <button class="menu-btn" id="menuBtn" type="button"
            aria-label="Open sprint menu" aria-expanded="false" aria-controls="rail">☰</button>
    <span class="crumb"><span class="crumb-word">Sprint </span><b id="crumb">00 · AWS foundations</b></span>
    <span class="pager">
      <button id="prev" type="button">← Prev</button>
      <button id="next" type="button">Next →</button>
    </span>
    <div class="readbar" id="readbar" aria-hidden="true"></div>
  </div>`,
  `  <div class="topbar">
    <div class="bar-inner">
      <button class="menu-btn" id="menuBtn" type="button"
              aria-label="Open sprint menu" aria-expanded="false" aria-controls="rail">☰</button>
      <span class="crumb"><span class="crumb-word">Sprint </span><b id="crumb">00 · AWS foundations</b></span>
      <span class="pager">
        <button id="prev" type="button">← Prev</button>
        <button id="next" type="button">Next →</button>
      </span>
    </div>
    <div class="readbar" id="readbar" aria-hidden="true"></div>
  </div>`);

// ── mobile: the gap moved off .topbar onto .bar-inner ────────────────
edit('mobile gap target',
  `  .topbar {
    gap: .45rem;
    padding: .45rem max(.85rem, env(safe-area-inset-right)) .45rem max(.85rem, env(safe-area-inset-left));
    padding-top: max(.45rem, env(safe-area-inset-top));
  }`,
  `  .topbar {
    padding: .45rem max(.85rem, env(safe-area-inset-right)) .45rem max(.85rem, env(safe-area-inset-left));
    padding-top: max(.45rem, env(safe-area-inset-top));
  }
  .bar-inner { gap: .45rem; }`);

// ── very wide displays: let the column breathe a little ──────────────
edit('ultrawide tier',
  `@media (max-width: 1080px) {
  :root { --rail-w: 16.5rem; }
  .rail nav a { font-size: .72rem; }
}`,
  `/* Above ~1600px there is room to widen the column slightly and grow the
   prose measure, which stops the text looking like a narrow ribbon stranded
   in the middle of a large display. */
@media (min-width: 1600px) {
  :root { --content-max: 68rem; --measure: 78ch; }
}
@media (min-width: 2100px) {
  :root { --rail-w: 21rem; --content-max: 72rem; }
  body { font-size: 17.5px; }
}

@media (max-width: 1080px) {
  :root { --rail-w: 16.5rem; }
  .rail nav a { font-size: .72rem; }
}`);

writeFileSync(p, h);
console.log(steps.join('\n'));
