#!/usr/bin/env node
// Mechanical AI-writing scanner for the build manual.
// Scores each section 0-10. Lower is better. Target: every section under 5.
// Usage: node site/slop-check.mjs [--verbose] [--section s7]

import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const VERBOSE = process.argv.includes('--verbose');
const ONLY = (() => {
  const i = process.argv.indexOf('--section');
  return i > -1 ? process.argv[i + 1] : null;
})();

// ── the catalog (from the fuck-slop tells reference) ─────────────────────
// weight = how damning one hit is. Negative parallelism is the worst tell.
const PATTERNS = [
  // 1. negative parallelism / "not X but Y" family
  [3.0, 'neg-parallel', /not (just|only|merely|simply|solely) [^.;<]{2,80}(but|it'?s)/gi],
  [3.0, 'neg-parallel', /isn'?t (just|only|merely|simply|about)\b/gi],
  [3.0, 'neg-parallel', /it'?s not (a|an|the|that|about|just) [^.;<]{2,80}(it'?s|but)/gi],
  [3.0, 'neg-parallel', /(is|was|are|were)n'?t about [^.;<]{2,60}\.\s+(it|this|that)'?s about/gi],
  [3.0, 'neg-parallel', /less about [^.;<]{2,60}(than|and more about)/gi],
  [3.0, 'neg-parallel', /more than (just|a mere|simply)\b/gi],
  [3.0, 'neg-parallel', /not because [^.;<]{2,80}but because/gi],
  [3.0, 'neg-parallel', /the (question|point|issue|problem|goal|real [a-z]+) is(n'?t| not) (whether|about|just|if)/gi],
  [3.0, 'neg-parallel', /(doesn'?t|don'?t|didn'?t|won'?t) (just|merely|simply) [^.;<]{2,80}(it|they|we) /gi],
  [3.0, 'neg-parallel', /no [a-z]+, no [a-z]+(, no [a-z]+)?,? just /gi],
  [3.0, 'neg-parallel', /— not [^—.;<]{2,60}, but /gi],
  [3.0, 'neg-parallel', /not only [^.;<]{2,80}but (also )?/gi],
  [3.0, 'neg-parallel', /we'?re not (just )?(talking about|looking at|dealing with)/gi],
  [3.0, 'neg-parallel', /gone are the days/gi],
  [2.0, 'neg-parallel', /(here|this)'?s the (thing|kicker|catch|twist)/gi],
  [2.0, 'neg-parallel', /\bis the whole (answer|point|thing)\b/gi],
  [2.0, 'neg-parallel', /\bthat'?s the (answer|point|whole point|design)\b/gi],
  [2.0, 'neg-parallel', /\bthe (interesting|important|real) (part|bit|thing) is\b/gi],
  [2.0, 'neg-parallel', /\bis the (entire|whole) (design|point|answer|story)\b/gi],
  [2.0, 'neg-parallel', /\bnot .{0,30}\bbut rather\b/gi],

  // 2. puffery / inflated vocabulary
  [1.2, 'puffery', /\b(delve|delving)\b/gi],
  [1.2, 'puffery', /\btapestry\b/gi],
  [1.2, 'puffery', /\b(testament|stands as)\b/gi],
  [1.2, 'puffery', /\bseamless(ly)?\b/gi],
  [1.2, 'puffery', /\b(pivotal|paramount|crucial(ly)?)\b/gi],
  [1.2, 'puffery', /\bunderscore(s|d)?\b/gi],
  [1.2, 'puffery', /\b(landscape|realm|sphere) of\b/gi],
  [1.2, 'puffery', /\bnavigat(e|ing) the\b/gi],
  [1.2, 'puffery', /\bfoster(s|ing)?\b/gi],
  [1.2, 'puffery', /\bleverag(e|es|ed|ing)\b/gi],
  [1.2, 'puffery', /\bmeticulous(ly)?\b/gi],
  [1.2, 'puffery', /\bintricate\b/gi],
  [1.2, 'puffery', /\bboasts\b/gi],
  [1.2, 'puffery', /\bgame.?chang(er|ing)\b/gi],
  [1.2, 'puffery', /\b(seismic|monumental|transformative) (shift|change)\b/gi],
  [1.2, 'puffery', /\bunwavering\b/gi],
  [1.2, 'puffery', /\bcommendable\b/gi],
  [1.2, 'puffery', /\belevate(s|d)? (the|your)\b/gi],
  [1.2, 'puffery', /\bshowcas(e|es|ing)\b/gi],
  [1.2, 'puffery', /\bresonate(s|d)?\b/gi],
  [1.2, 'puffery', /\bcompelling\b/gi],
  [1.2, 'puffery', /\bvibrant\b/gi],
  [1.2, 'puffery', /\bplays? a (vital|key|crucial|pivotal) role\b/gi],
  [1.2, 'puffery', /\bdeep(er)? dive\b/gi],
  [1.2, 'puffery', /\bunlock(s|ing)? (the|your)\b/gi],
  [1.2, 'puffery', /\bharness(es|ing)? the\b/gi],
  [1.2, 'puffery', /\bembark(s|ed|ing)? on\b/gi],
  [1.2, 'puffery', /\bever.?(evolving|changing)\b/gi],
  [1.2, 'puffery', /\bfast.?paced (world|environment)\b/gi],
  [1.2, 'puffery', /\bin today'?s\b/gi],
  [1.2, 'puffery', /\bat the end of the day\b/gi],
  [1.0, 'puffery', /\bwhen it comes to\b/gi],
  [1.2, 'puffery', /\bcutting.?edge\b/gi],
  [1.2, 'puffery', /\brobust(ness)?\b/gi],
  [1.2, 'puffery', /\bholistic\b/gi],
  [1.2, 'puffery', /\bsynergy\b/gi],
  [1.2, 'puffery', /\bempower(s|ing|ment)?\b/gi],
  [1.0, 'puffery', /\bgenuinely\b/gi],
  [1.0, 'puffery', /\bmaterially\b/gi],
  [1.0, 'puffery', /\bnon-?trivial\b/gi],
  [1.0, 'puffery', /\bearns? (its|their) (keep|cost)\b/gi],

  // 3. hedging / both-sidesing / throat-clearing
  [1.5, 'hedging', /it'?s (worth|important) (to note|noting|to remember|to consider)/gi],
  [1.5, 'hedging', /(that|it) (being )?said,/gi],
  [1.5, 'hedging', /while (it'?s|this is) (true|important)/gi],
  [1.2, 'hedging', /\barguably\b/gi],
  [1.2, 'hedging', /\bin many ways\b/gi],
  [1.2, 'hedging', /to some (extent|degree)/gi],
  [1.2, 'hedging', /\bon the other hand\b/gi],
  [1.5, 'hedging', /\bat its core\b/gi],
  [1.5, 'hedging', /\bin essence\b/gi],
  [1.5, 'hedging', /\bessentially,/gi],
  [1.5, 'hedging', /\bultimately,/gi],
  [2.0, 'hedging', /\bin conclusion\b/gi],
  [2.0, 'hedging', /\bin summary\b/gi],
  [2.0, 'hedging', /to sum(marize| up)\b/gi],
  [1.5, 'hedging', /\boverall,/gi],
  [1.5, 'hedging', /\bin the end,/gi],
  [1.5, 'hedging', /\bneedless to say\b/gi],
  [1.5, 'hedging', /as (we|you) (can see|know|all know)/gi],
  [2.0, 'hedging', /let'?s (dive|unpack|explore|take a (look|closer look))/gi],
  [1.5, 'hedging', /whether you('re| are) [^.;<]{2,60} or /gi],
  [1.2, 'hedging', /\bthe honest answer\b/gi],
  [1.2, 'hedging', /\bto be (fair|clear|honest)\b/gi],
  [1.2, 'hedging', /\bworth (naming|mentioning|saying)\b/gi],
  [1.2, 'hedging', /\bstated honestly\b/gi],
  [1.5, 'hedging', /\bthat'?s (the|a) (senior|strong|good) answer\b/gi],

  // 4. false range + rule of three
  [0.8, 'false-range', /\bfrom [a-z][^.;<]{3,40} to [a-z][^.;<]{3,40}/gi],
  [0.6, 'rule-of-three', /\b(\w+), (\w+), and (\w+)[.!?]/g],

  // 5. self-referential interview coaching used as a rhetorical crutch
  [1.0, 'crutch', /\bin an interview\b/gi],
  [1.0, 'crutch', /\bin interviews\b/gi],
  [1.2, 'crutch', /\bmost candidates\b/gi],
  [1.2, 'crutch', /\bputs you in a different (category|league)\b/gi],
];

// ── extraction ───────────────────────────────────────────────────────────
function sections() {
  const out = [];
  const re = /<section class="sprint[^"]*" id="([^"]+)">([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(HTML))) out.push({ id: m[1], html: m[2] });
  return out;
}

function toProse(html) {
  return html
    // code is not prose; do not score it
    .replace(/<div class="code">[\s\S]*?<\/div>\s*<\/div>/g, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<code[^>]*>[\s\S]*?<\/code>/g, ' CODE ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length > 2);
}

// cadence: runs of 3+ consecutive sentences within +/-4 words of each other
function cadenceRuns(text) {
  const lens = sentences(text).map((s) => s.split(/\s+/).length);
  let runs = 0;
  let i = 0;
  while (i < lens.length) {
    let j = i + 1;
    while (j < lens.length && Math.abs(lens[j] - lens[i]) <= 4) j++;
    if (j - i >= 3) runs += 1;
    i = j > i + 1 ? j : i + 1;
  }
  return runs;
}

function emDashExcess(text) {
  const words = text.split(/\s+/).length;
  const dashes = (text.match(/—/g) || []).length;
  const budget = Math.max(1, Math.round(words / 150));
  return Math.max(0, dashes - budget);
}

// ── scoring ──────────────────────────────────────────────────────────────
const K = 0.55; // calibration: weighted-hits-per-1000-words -> 0..10

function score(prose) {
  const words = prose.split(/\s+/).filter(Boolean).length || 1;
  const hits = [];
  let weighted = 0;

  for (const [w, cat, re] of PATTERNS) {
    const found = prose.match(re);
    if (found) {
      weighted += w * found.length;
      hits.push({ cat, weight: w, n: found.length, sample: found[0].slice(0, 72) });
    }
  }

  const runs = cadenceRuns(prose);
  weighted += runs * 1.0;
  if (runs) hits.push({ cat: 'cadence', weight: 1.0, n: runs, sample: `${runs} uniform-length runs` });

  const dashes = emDashExcess(prose);
  weighted += dashes * 0.5;
  if (dashes) hits.push({ cat: 'em-dash', weight: 0.5, n: dashes, sample: `${dashes} over budget` });

  const per1000 = (weighted / words) * 1000;
  return {
    words,
    weighted: +weighted.toFixed(1),
    per1000: +per1000.toFixed(2),
    score: Math.min(10, +(per1000 * K).toFixed(1)),
    hits: hits.sort((a, b) => b.weight * b.n - a.weight * a.n),
  };
}

// ── report ───────────────────────────────────────────────────────────────
const rows = [];
let worstScore = 0;
const byCat = new Map();

for (const s of sections()) {
  if (ONLY && s.id !== ONLY) continue;
  const prose = toProse(s.html);
  const r = score(prose);
  rows.push({ section: s.id, words: r.words, hits: r.weighted, per1k: r.per1000, score: r.score });
  worstScore = Math.max(worstScore, r.score);

  for (const h of r.hits) {
    byCat.set(h.cat, (byCat.get(h.cat) || 0) + h.n);
  }

  if (VERBOSE && r.hits.length) {
    console.log(`\n── ${s.id}  (score ${r.score}/10, ${r.words} words)`);
    for (const h of r.hits.slice(0, 14)) {
      console.log(`   ${String(h.n).padStart(3)}x  ${h.cat.padEnd(14)} ${h.sample}`);
    }
  }
}

console.log('\nAI-SOUNDING SCORE  (0 = human, 10 = maximally AI; target < 5)\n');
console.log('section   words   weighted  per-1k   score   verdict');
console.log('------------------------------------------------------');
for (const r of rows) {
  const verdict = r.score < 3 ? 'clean' : r.score < 5 ? 'ok' : r.score < 7 ? 'SLOPPY' : 'BAD';
  console.log(
    `${r.section.padEnd(9)} ${String(r.words).padStart(5)}   ${String(r.hits).padStart(6)}   ${String(r.per1k).padStart(6)}   ${String(r.score).padStart(4)}    ${verdict}`,
  );
}
const avg = rows.reduce((a, r) => a + r.score, 0) / (rows.length || 1);
console.log('------------------------------------------------------');
console.log(`average ${avg.toFixed(2)}   worst ${worstScore.toFixed(1)}   sections over 5: ${rows.filter((r) => r.score >= 5).length}`);

if (byCat.size) {
  console.log('\ntop categories:');
  [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([c, n]) => console.log(`   ${String(n).padStart(4)}  ${c}`));
}

process.exit(worstScore >= 5 ? 1 : 0);
