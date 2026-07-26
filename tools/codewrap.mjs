#!/usr/bin/env node
// Code-block wrapping, done properly:
//   1. default ON below 860px (unless the reader has chosen otherwise)
//   2. a labelled "Wrap" button in every code header, next to Copy —
//      the cryptic app-bar glyph was undiscoverable
//   3. hanging indent on continuation lines, so a wrapped line is visually
//      distinct from a real new statement
//   4. copy still yields byte-identical text

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(path, 'utf8');
const steps = [];

function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// ───────────────────────────── CSS ─────────────────────────────
edit('code header button group css',
  `.copy {
  font-family: var(--mono); font-size: .6rem; letter-spacing: .08em; text-transform: uppercase;
  background: transparent; color: #8C97A2; border: 1px solid var(--code-rule);
  padding: .2rem .45rem; border-radius: 3px; cursor: pointer; flex: 0 0 auto;
}
.copy:hover { color: #DCE1DA; border-color: #4A545E; }`,
  `.code-btns { display: flex; gap: .3rem; flex: 0 0 auto; }
.copy, .wrapbtn {
  font-family: var(--mono); font-size: .6rem; letter-spacing: .08em; text-transform: uppercase;
  background: transparent; color: #8C97A2; border: 1px solid var(--code-rule);
  padding: .2rem .45rem; border-radius: 3px; cursor: pointer; flex: 0 0 auto;
  white-space: nowrap;
}
.copy:hover, .wrapbtn:hover { color: #DCE1DA; border-color: #4A545E; }
.wrapbtn[aria-pressed="true"] {
  color: #CFE0F5; border-color: #4B6somethingE; background: rgba(135, 169, 220, .16);
}`);

// fix the placeholder typo above in one go (kept explicit so the intent is visible)
h = h.replace('#4B6somethingE', '#4B6A93');

edit('wrap + hanging indent css',
  `/* Wrap long lines instead of scrolling sideways. Toggled from the app bar;
   invaluable for reading Terraform on a 375px screen. */
body.wrap-code .code pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background-image: none;
}`,
  `/* Wrap long lines instead of scrolling sideways. Default on small screens,
   toggled per reader from any code header. */
body.wrap-code .code pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background-image: none;   /* scroll shadows are meaningless once wrapped */
}

/* Hanging indent. Each source line is its own block, so a line that wraps
   continues at 2.4ch while real lines stay flush with their own indentation.
   Without this, wrapped Terraform is very hard to read: you cannot tell a
   continuation from a new attribute. */
body.wrap-code .code pre .cl {
  display: block;
  padding-left: 2.4ch;
  text-indent: -2.4ch;
}
/* Blank lines still need their height, and :empty keeps the copied text exact. */
body.wrap-code .code pre .cl:empty { height: 1.6em; }`);

// ───────────────────── remove the cryptic app-bar glyph ─────────────────────
edit('drop app-bar wrap glyph',
  `      <button class="wrap-btn" id="wrapBtn" type="button" aria-pressed="false"
              title="Wrap long code lines" aria-label="Wrap long code lines">↵</button>
`, '');

edit('drop wrap-btn css (mobile)',
  `  .wrap-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; padding: 0; font-size: .95rem;
  }
  .wrap-btn[aria-pressed="true"] {
    background: var(--accent-wash); color: var(--accent-ink); border-color: var(--accent);
  }

`, '');

edit('drop wrap-btn from hidden-controls list',
  '.menu-btn, .wrap-btn, .scrim, .readbar { display: none; }',
  '.menu-btn, .scrim, .readbar { display: none; }');

// ───────────────────────────── behaviour ─────────────────────────────
edit('replace wrap js',
  `  /* ── wrap-code toggle: read Terraform without sideways scrolling ── */
  var wrapBtn = document.getElementById('wrapBtn');
  var wrapOn = false;
  try { wrapOn = localStorage.getItem('idp-manual-wrap') === '1'; } catch (e) {}
  function applyWrap() {
    document.body.classList.toggle('wrap-code', wrapOn);
    wrapBtn.setAttribute('aria-pressed', wrapOn ? 'true' : 'false');
    try { localStorage.setItem('idp-manual-wrap', wrapOn ? '1' : '0'); } catch (e) {}
  }
  wrapBtn.addEventListener('click', function () { wrapOn = !wrapOn; applyWrap(); });
  applyWrap();`,
  `  /* ── code wrapping ─────────────────────────────────────────────
     Default ON below 860px, because horizontal scrolling through
     Terraform on a phone is unusable. An explicit choice is remembered
     and beats the default from then on. */
  var wrapOn;
  var wrapStored = null;
  try { wrapStored = localStorage.getItem('idp-manual-wrap'); } catch (e) {}
  if (wrapStored === '1' || wrapStored === '0') {
    wrapOn = wrapStored === '1';
  } else {
    wrapOn = window.matchMedia('(max-width: 860px)').matches;
  }

  function applyWrap() {
    document.body.classList.toggle('wrap-code', wrapOn);
    Array.prototype.forEach.call(document.querySelectorAll('.wrapbtn'), function (b) {
      b.setAttribute('aria-pressed', wrapOn ? 'true' : 'false');
      b.textContent = wrapOn ? 'Wrap ✓' : 'Wrap';
    });
    if (wrapOn) { splitLines(document.querySelector('.sprint.on')); }
  }

  /* Split each source line into its own block-level span so the hanging
     indent in CSS has something to hang off. Done lazily per section: doing
     all 86 blocks up front costs time nobody asked for. textContent is
     preserved exactly, so copy still returns the original bytes. */
  function splitLines(scope) {
    if (!scope) { return; }
    Array.prototype.forEach.call(scope.querySelectorAll('.code pre > code'), function (code) {
      if (code.dataset.split === '1') { return; }
      var lines = code.textContent.split('\\n');
      var frag = document.createDocumentFragment();
      for (var i = 0; i < lines.length; i++) {
        var span = document.createElement('span');
        span.className = 'cl';
        span.textContent = lines[i];
        frag.appendChild(span);
        // Keep a real newline between lines so innerText, textContent and
        // clipboard output all still match the original source.
        if (i < lines.length - 1) { frag.appendChild(document.createTextNode('\\n')); }
      }
      code.textContent = '';
      code.appendChild(frag);
      code.dataset.split = '1';
    });
  }

  /* A labelled control in every code header. The previous single glyph in
     the app bar was not discoverable — put the affordance on the thing it
     affects. */
  Array.prototype.forEach.call(document.querySelectorAll('.code-top'), function (top) {
    var copy = top.querySelector('.copy');
    if (!copy) { return; }
    var group = document.createElement('span');
    group.className = 'code-btns';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wrapbtn';
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Wrap long lines instead of scrolling sideways';
    btn.textContent = 'Wrap';
    btn.addEventListener('click', function () {
      wrapOn = !wrapOn;
      try { localStorage.setItem('idp-manual-wrap', wrapOn ? '1' : '0'); } catch (e) {}
      applyWrap();
    });
    top.replaceChild(group, copy);
    group.appendChild(btn);
    group.appendChild(copy);
  });

  // Split the newly shown section too, when wrapping is active.
  var _showWrap = show;
  show = function (id, push) {
    _showWrap(id, push);
    if (wrapOn) { splitLines(document.getElementById(id)); }
  };

  applyWrap();`);

writeFileSync(path, h);
console.log(steps.join('\n'));
