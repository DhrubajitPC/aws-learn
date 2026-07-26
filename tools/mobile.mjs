#!/usr/bin/env node
// Makes docs/index.html usable on a phone:
//   1. viewport + colour-scheme meta (without these nothing else matters)
//   2. off-canvas drawer nav instead of a 2,100px stacked sidebar
//   3. full-bleed code/tables with scroll shadows and a wrap toggle
//   4. 44px tap targets, 16px inputs, safe-area insets
//   5. reading-progress bar

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(path, 'utf8');
const before = h.length;
const steps = [];

function edit(label, from, to, { required = true } = {}) {
  if (!h.includes(from)) {
    if (required) throw new Error(`anchor not found: ${label}`);
    steps.push(`skip  ${label}`);
    return;
  }
  h = h.replace(from, to);
  steps.push(`ok    ${label}`);
}

// ─────────────────────────── 1. meta tags ───────────────────────────
edit('viewport meta',
  '<title>Intelligent Document Platform — AWS Build Manual</title>',
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="A twelve-sprint manual for building a multi-tenant document platform on AWS with Terraform, Fargate, Textract and Bedrock.">
<title>Intelligent Document Platform — AWS Build Manual</title>`);

// ─────────────────────────── 2. mobile CSS ──────────────────────────
const OLD_MEDIA = `@media (max-width: 900px) {
  .shell { flex-direction: column; }
  .rail {
    width: 100%; flex: none; position: static; height: auto; max-height: none;
    border-right: 0; border-bottom: 1px solid var(--rule);
  }
  .rail nav { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
  body { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`;

const NEW_MEDIA = `/* ── controls that only exist on small screens ───────────────── */
.menu-btn, .wrap-btn, .scrim, .readbar { display: none; }

.drawer-head {
  display: none;
  justify-content: space-between; align-items: center;
  padding: .2rem 1.3rem .9rem;
}
.drawer-close {
  width: 40px; height: 40px; flex: 0 0 auto;
  font-family: var(--mono); font-size: 1rem; line-height: 1;
  background: transparent; color: var(--ink-soft);
  border: 1px solid var(--rule); border-radius: 6px; cursor: pointer;
}

/* Scroll shadows: the two solid gradients are painted in the scroller's own
   coordinate space (background-attachment: local) so they slide away at the
   ends, revealing the fixed radial shadows underneath. No JS needed. */
.tw {
  background:
    linear-gradient(to right, var(--paper) 40%, transparent) left center / 32px 100% no-repeat local,
    linear-gradient(to left,  var(--paper) 40%, transparent) right center / 32px 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%,    rgba(0,0,0,.16), transparent) left center / 12px 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.16), transparent) right center / 12px 100% no-repeat scroll;
}
.code pre {
  background:
    linear-gradient(to right, var(--code-bg) 40%, transparent) left center / 28px 100% no-repeat local,
    linear-gradient(to left,  var(--code-bg) 40%, transparent) right center / 28px 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%,    rgba(0,0,0,.45), transparent) left center / 12px 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.45), transparent) right center / 12px 100% no-repeat scroll;
}
.tw, .code pre, .flow { -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }

/* Wrap long lines instead of scrolling sideways. Toggled from the app bar;
   invaluable for reading Terraform on a 375px screen. */
body.wrap-code .code pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background-image: none;
}

@media (max-width: 1080px) {
  :root { --rail-w: 16.5rem; }
  .rail nav a { font-size: .72rem; }
}

/* ── phone / small tablet: drawer navigation ─────────────────── */
@media (max-width: 860px) {
  .shell { display: block; }

  .menu-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; flex: 0 0 auto;
    font-size: 1.1rem; line-height: 1;
    background: var(--surface); color: var(--ink);
    border: 1px solid var(--rule); border-radius: 7px; cursor: pointer;
  }
  .menu-btn:active { background: var(--surface-2); }

  .wrap-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; padding: 0; font-size: .95rem;
  }
  .wrap-btn[aria-pressed="true"] {
    background: var(--accent-wash); color: var(--accent-ink); border-color: var(--accent);
  }

  .drawer-head { display: flex; }

  /* The rail becomes an off-canvas drawer. Content now starts at the top of
     the page instead of below 2,100px of navigation. */
  .rail {
    position: fixed; z-index: 60;
    top: 0; left: 0; bottom: 0;
    width: min(87vw, 21rem); max-width: 21rem;
    height: 100dvh; overflow-y: auto;
    flex: none;
    border-right: 1px solid var(--rule);
    box-shadow: 0 0 44px rgba(0, 0, 0, .4);
    transform: translateX(-101%);
    transition: transform .22s ease;
    padding-top: max(1rem, env(safe-area-inset-top));
    padding-bottom: max(2.5rem, env(safe-area-inset-bottom));
  }
  .rail.open { transform: translateX(0); }

  .scrim {
    display: block; position: fixed; inset: 0; z-index: 55;
    background: rgba(6, 9, 11, .58);
    opacity: 0; pointer-events: none; transition: opacity .22s ease;
  }
  .scrim.on { opacity: 1; pointer-events: auto; }

  body.locked { overflow: hidden; }

  /* app bar */
  .topbar {
    gap: .45rem;
    padding: .45rem max(.85rem, env(safe-area-inset-right)) .45rem max(.85rem, env(safe-area-inset-left));
    padding-top: max(.45rem, env(safe-area-inset-top));
  }
  .crumb {
    flex: 1 1 auto; min-width: 0; font-size: .6rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .crumb .crumb-word { display: none; }
  .pager { gap: .3rem; flex: 0 0 auto; }
  .pager button { min-height: 42px; padding: .35rem .5rem; font-size: .68rem; }

  /* thin reading-progress bar under the app bar */
  .readbar {
    display: block; position: sticky; top: 52px; z-index: 19;
    height: 2px; background: var(--accent);
    transform-origin: 0 50%; transform: scaleX(0);
    will-change: transform;
  }

  .pad {
    padding-left: max(1.05rem, env(safe-area-inset-left));
    padding-right: max(1.05rem, env(safe-area-inset-right));
  }
  main { padding-bottom: max(4rem, env(safe-area-inset-bottom)); }
  .sprint { padding-top: 1.6rem; }

  /* tap targets: nothing interactive below ~42px */
  .rail nav a { padding: .78rem 1.2rem; font-size: .78rem; grid-template-columns: 2.5rem 1fr; }
  .rail .group-label { padding-top: 1rem; }
  .filter-wrap input { font-size: 16px; padding: .62rem .7rem; }  /* 16px stops iOS auto-zoom */
  .hits a { padding: .45rem 0; font-size: .74rem; }
  .theme-btn { padding: .6rem .8rem; font-size: .7rem; }

  .dod label { padding: .72rem .25rem; font-size: .92rem; gap: .75rem; }
  .dod input { width: 19px; height: 19px; transform: translateY(3px); }

  details.qa > summary { padding: .8rem .8rem; font-size: .9rem; }
  .qa-body { padding: .85rem .8rem .35rem; }

  .copy { padding: .42rem .6rem; font-size: .62rem; }
  .code-top { padding: .5rem .7rem; }

  .meta-grid { grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
}

/* ── narrow phones ───────────────────────────────────────────── */
@media (max-width: 560px) {
  body { font-size: 16.5px; line-height: 1.6; }

  h1 { font-size: 1.52rem; max-width: none; }
  h2 { font-size: .95rem; margin-top: 2.1rem; }
  h3 { font-size: .92rem; }
  .lede { font-size: 1rem; }

  /* Full-bleed: reclaim the page gutter for code, tables and diagrams,
     which are the things that actually need the pixels. */
  .code, .tw, .flow {
    margin-left: calc(-1 * max(1.05rem, env(safe-area-inset-left)));
    margin-right: calc(-1 * max(1.05rem, env(safe-area-inset-right)));
    border-left: 0; border-right: 0; border-radius: 0;
    max-width: none;
  }
  .code pre { font-size: .715rem; line-height: 1.58; padding: .8rem .85rem; }
  .flow { padding: .85rem; gap: .3rem; }
  .node { min-width: 6.6rem; font-size: .64rem; }
  table { font-size: .8rem; }
  th, td { padding: .45rem .55rem; }

  .note { margin-left: -.2rem; margin-right: -.2rem; padding: .8rem .85rem; }
  .meta-grid { grid-template-columns: 1fr 1fr; }
  .flow-cap { margin-top: -1.3rem; }
}

@media (max-width: 380px) {
  .meta-grid { grid-template-columns: 1fr; }
  .pager button { padding: .35rem .42rem; }
}

/* Landscape phones: the drawer would otherwise eat the whole screen */
@media (max-height: 460px) and (max-width: 900px) {
  .rail { width: min(70vw, 18rem); }
  .progress, .filter-wrap { padding-top: .6rem; padding-bottom: .6rem; }
}

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`;

edit('mobile css', OLD_MEDIA, NEW_MEDIA);

// ─────────────────────── 3. markup: drawer + app bar ────────────────
edit('rail id + drawer header',
  `<aside class="rail">
  <div class="rail-head">`,
  `<aside class="rail" id="rail" aria-label="Sprint navigation">
  <div class="drawer-head">
    <span></span>
    <button class="drawer-close" id="drawerClose" type="button" aria-label="Close menu">✕</button>
  </div>
  <div class="rail-head">`);

edit('scrim element',
  '<div class="shell">',
  '<div class="scrim" id="scrim" hidden></div>\n<div class="shell">');

edit('app bar controls',
  `  <div class="topbar">
    <span class="crumb">Sprint <b id="crumb">00 · AWS foundations</b></span>
    <span class="pager">
      <button id="prev" type="button">← Prev</button>
      <button id="next" type="button">Next →</button>
    </span>
  </div>`,
  `  <div class="topbar">
    <button class="menu-btn" id="menuBtn" type="button"
            aria-label="Open sprint menu" aria-expanded="false" aria-controls="rail">☰</button>
    <span class="crumb"><span class="crumb-word">Sprint </span><b id="crumb">00 · AWS foundations</b></span>
    <span class="pager">
      <button class="wrap-btn" id="wrapBtn" type="button" aria-pressed="false"
              title="Wrap long code lines" aria-label="Wrap long code lines">↵</button>
      <button id="prev" type="button">← Prev</button>
      <button id="next" type="button">Next →</button>
    </span>
  </div>
  <div class="readbar" id="readbar" aria-hidden="true"></div>`);

// ─────────────────────────── 4. behaviour ───────────────────────────
edit('drawer + wrap + progress js',
  `  initBoxes();
  buildIndex();
  paint();`,
  `  /* ── drawer navigation (small screens) ── */
  var rail = document.getElementById('rail');
  var scrim = document.getElementById('scrim');
  var menuBtn = document.getElementById('menuBtn');
  var drawerClose = document.getElementById('drawerClose');
  var lastFocus = null;

  function drawerOpen() {
    lastFocus = document.activeElement;
    scrim.hidden = false;
    // next frame, so the opacity transition actually runs
    requestAnimationFrame(function () {
      rail.classList.add('open');
      scrim.classList.add('on');
    });
    document.body.classList.add('locked');
    menuBtn.setAttribute('aria-expanded', 'true');
    var first = rail.querySelector('#filter');
    if (first) { first.focus({ preventScroll: true }); }
  }

  function drawerClosed() {
    rail.classList.remove('open');
    scrim.classList.remove('on');
    document.body.classList.remove('locked');
    menuBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      if (!rail.classList.contains('open')) { scrim.hidden = true; }
    }, 240);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function isDrawerMode() { return window.matchMedia('(max-width: 860px)').matches; }

  menuBtn.addEventListener('click', function () {
    rail.classList.contains('open') ? drawerClosed() : drawerOpen();
  });
  drawerClose.addEventListener('click', drawerClosed);
  scrim.addEventListener('click', drawerClosed);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && rail.classList.contains('open')) { drawerClosed(); }
  });

  // Selecting a sprint should dismiss the drawer, not leave it covering the text.
  navLinks.forEach(function (a) {
    a.addEventListener('click', function () {
      if (isDrawerMode()) { drawerClosed(); }
    });
  });

  // Returning to a wide viewport must not leave the drawer state stuck on.
  window.addEventListener('resize', function () {
    if (!isDrawerMode() && rail.classList.contains('open')) { drawerClosed(); }
  });

  // Swipe from the left edge opens it; swipe left on the drawer closes it.
  (function () {
    var x0 = null, y0 = null, tracking = false;
    document.addEventListener('touchstart', function (e) {
      if (!isDrawerMode()) { return; }
      var t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY;
      tracking = x0 < 24 || rail.classList.contains('open');
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!tracking || x0 === null) { return; }
      var t = e.changedTouches[0];
      var dx = t.clientX - x0;
      var dy = Math.abs(t.clientY - y0);
      if (dy < 60) {
        if (dx > 55 && !rail.classList.contains('open')) { drawerOpen(); }
        else if (dx < -55 && rail.classList.contains('open')) { drawerClosed(); }
      }
      x0 = null; tracking = false;
    }, { passive: true });
  })();

  /* ── wrap-code toggle: read Terraform without sideways scrolling ── */
  var wrapBtn = document.getElementById('wrapBtn');
  var wrapOn = false;
  try { wrapOn = localStorage.getItem('idp-manual-wrap') === '1'; } catch (e) {}
  function applyWrap() {
    document.body.classList.toggle('wrap-code', wrapOn);
    wrapBtn.setAttribute('aria-pressed', wrapOn ? 'true' : 'false');
    try { localStorage.setItem('idp-manual-wrap', wrapOn ? '1' : '0'); } catch (e) {}
  }
  wrapBtn.addEventListener('click', function () { wrapOn = !wrapOn; applyWrap(); });
  applyWrap();

  /* ── reading progress for the active sprint ── */
  var readbar = document.getElementById('readbar');
  var ticking = false;
  function paintProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 40 ? Math.min(1, window.scrollY / max) : 0;
    readbar.style.transform = 'scaleX(' + pct.toFixed(4) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(paintProgress); }
  }, { passive: true });

  var _show = show;
  show = function (id, push) { _show(id, push); paintProgress(); };

  initBoxes();
  buildIndex();
  paint();
  paintProgress();`);

writeFileSync(path, h);
console.log(steps.join('\\n'));
console.log(`\\n${before} -> ${h.length} bytes (+${h.length - before})`);
