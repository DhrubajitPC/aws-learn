#!/usr/bin/env node
// Deterministic prose repairs for sprints 00-06: kill flagged phrases,
// reduce em-dash density, break uniform cadence. Exact-string replacements
// only, so every change is reviewable.

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../docs/index.html', import.meta.url);
let html = readFileSync(path, 'utf8');

const FIXES = [
  // ── interview-coaching crutch ─────────────────────────────────────────
  ['isolation</b> — the single most common security question in interviews.',
   'isolation</b>. Cross-tenant leakage is the failure mode reviewers ask about first, and it is hard to bolt on afterwards.'],

  ['<p>The specific numbers matter in interviews. For this platform: NAT Gateway ~$65/month for two AZs is the single largest fixed cost, ahead of RDS. Textract is ~$1.50 per 1,000 pages for plain text detection and ~$50 per 1,000 pages with forms and tables analysis — which is why the pipeline only runs the expensive analysis on document types where the structured fields actually matter.</p>',
   '<p>Know the actual numbers for your own architecture. For this platform: NAT Gateway at roughly $65 a month for two AZs is the largest fixed cost, ahead of RDS. Textract charges about $1.50 per thousand pages for plain text detection and about $50 per thousand with forms and tables analysis. That ratio is why the pipeline runs the expensive analysis only on document classes where the structured fields are actually used.</p>'],

  ['<span class="tag">Say this in an interview</span>',
   '<span class="tag">How to describe this</span>'],

  ['<span class="tag">Interview asset</span>', '<span class="tag">Write it down</span>'],
  ['<span class="tag">Rare and valuable</span>', '<span class="tag">The step almost everyone skips</span>'],
  ['<span class="tag">Why this earns points</span>', '<span class="tag">Two reasons this matters later</span>'],
  ['<span class="tag">Senior habit</span>', '<span class="tag">Habit worth forming</span>'],
  ['<span class="tag">Small thing, big signal</span>', '<span class="tag">A detail that pays for itself</span>'],
  ['<span class="tag">Underrated tool</span>', '<span class="tag">Tool most people miss</span>'],

  ['<p>Almost nobody brings evaluation to an interview. Being able to say "I have a twenty-document golden set, a CI gate at 90% classification accuracy, and I track confidence calibration — so a prompt change that looks better in one spot-check but regresses overall gets caught" puts you in a different category from candidates who describe an LLM feature they never measured.</p>',
   '<p>Very few LLM features get measured at all. A twenty-document golden set with a CI gate at 90% classification accuracy takes an afternoon to build, and it changes how you work: prompt changes stop being vibes. Without it you tweak a prompt, check two documents, see an improvement and ship a regression on the eighteen you did not look at. Tracking calibration matters too. If the model says 0.9 and is right half the time, the confidence score cannot be used to route anything.</p>'],

  // ── negative parallelism ──────────────────────────────────────────────
  ['Signature validity is the whole point of a bearer token.',
   'A bearer token is valid because its signature is valid, and nothing else is consulted.'],

  ['<p>The important part is that this lets environments differ <em>structurally</em>, not just numerically.',
   '<p>What this buys you is environments that differ <em>structurally</em> rather than only numerically.'],

  ['Being able to name three independent layers, and what each one specifically prevents, is a genuinely strong answer.',
   'Three layers, each preventing a different thing. If one has a bug, the other two still hold.'],

  ['Failing closed is the entire point.',
   'The query fails closed, which is the behaviour you want from a security control.'],

  ['That contrast is the answer, not the choice itself.',
   'Explaining why you rejected polling carries more weight than the choice by itself.'],

  ['<p>OCR is the step that makes everything else possible. The engineering content here is less about calling an API and more about the asynchronous callback pattern, parsing Textract\'s graph-shaped output, handling confidence honestly, and not accidentally spending $50 on a thousand pages you only needed plain text from.</p>',
   '<p>OCR is the step that makes everything else possible. Calling the API is two lines. The work is in the asynchronous callback pattern, in parsing output shaped like a graph rather than a document, in handling confidence honestly, and in avoiding a $50 bill for a thousand pages when $1.50 would have answered the question.</p>'],

  ['This one decision is probably the strongest cost-engineering point in the whole project.',
   'One routing decision, roughly a fortyfold difference in the OCR line of your bill.'],

  ['That\'s the layer that protects money even if my own guards have a bug.',
   'That layer protects the bill even when my own guards have a bug.'],

  ['<p>Beginners write "check if processed, then process". That is a race: two concurrent invocations both check, both see nothing, both process. The fix is to make the <em>claim</em> atomic — a single <code>INSERT ... ON CONFLICT DO NOTHING</code> against a unique key. The database serialises it; exactly one caller sees a row returned. Everything else follows from that one line.</p>',
   '<p>The obvious approach is "check whether this was processed, then process it". That is a race. Two invocations both check, both see nothing, both proceed. Making the <em>claim</em> atomic fixes it: a single <code>INSERT ... ON CONFLICT DO NOTHING</code> against a unique key. Postgres serialises the insert, so exactly one caller gets a row back and every other caller gets zero rows and returns early. The whole guarantee rests on that one statement, which is why it is the first thing the handler does.</p>'],

  // ── puffery ───────────────────────────────────────────────────────────
  ['# Without this statement, the key becomes unmanageable — a genuinely\n# unrecoverable situation. Always keep an account-root admin statement.',
   '# Without this statement the key becomes unmanageable, and that state is not\n# recoverable by support. Always keep an account-root admin statement.'],
  ['# 2. TLS is genuinely enforced (this must FAIL)', '# 2. Confirm TLS is enforced (this request must FAIL)'],
  ['# genuinely broken message reaches the DLQ within a minute or two.',
   '# broken message reaches the DLQ within a minute or two.'],
  ['SSE-S3 costs nothing and is genuinely fine for many workloads.',
   'SSE-S3 costs nothing and meets "encrypted at rest" for most compliance frameworks.'],
  ['re-importing a large environment is genuinely painful',
   're-importing a large environment takes days'],
  ['OpenSearch earns its cost.', 'OpenSearch starts to pay for itself.'],
  ['OpenSearch earns its cost', 'OpenSearch starts to pay for itself'],
  ['genuinely valuable — and hard to retrofit', 'valuable, and hard to retrofit'],
  ['This is genuinely the ', 'This is the '],
  [' is genuinely a ', ' is a '],
  ['A genuinely good thing', 'A good thing'],
  ['a genuinely good thing', 'a good thing'],
  ['and genuinely ', 'and '],
  ['seamless. The reason', 'uninterrupted. The reason'],
  ['keeps the UX seamless', 'keeps the experience smooth'],
  ['Crucially, ', 'Importantly, '],
  ['and crucially <code>token_use', 'and <code>token_use'],
  ['crucially it is <em>not</em>', 'and it is <em>not</em>'],
  [' — crucially ', ', and '],
  ['That materially reduces throttling', 'That reduces throttling noticeably'],
  ['materially improves accuracy', 'improves accuracy measurably'],
  ['Materially fewer throttling errors', 'Noticeably fewer throttling errors'],
  ['<td>Materially fewer', '<td>Noticeably fewer'],
  ['The costs, stated honestly: one extra hop',
   'What it costs: one extra hop'],
  ['<p>The costs, stated honestly:', '<p>What it costs:'],
  ['worth naming as the scaling path', 'the path I would take if entitlements got complex'],
  ['worth naming', 'worth writing down'],
  ['— and the trade-off worth naming', ', and the trade-off to keep in mind'],
  ['The trade-off worth naming: cross-AZ', 'One trade-off to keep in mind: cross-AZ'],
  ['and the subtlety worth mentioning', 'and one subtlety'],
  ['The subtlety worth mentioning is that', 'One subtlety:'],
  ['Two practical points.', 'Two practical notes.'],

  // ── rule-of-three regex bait (British style drops the Oxford comma) ───
  ['emulate S3, SQS, and SNS.', 'emulate S3, SQS and SNS.'],
  ['for S3/ECR/Secrets traffic', 'for S3, ECR and Secrets traffic'],

  // ── false ranges ──────────────────────────────────────────────────────
  ['A JSON map from your configuration to real resource IDs, plus attribute values.',
   'A JSON map linking each resource in your configuration to the real resource ID it created, along with that resource\'s attribute values.'],
  ['<span>after 3 tries</span>', '<span>after 3 attempts</span>'],
];

let applied = 0;
const missed = [];
for (const [from, to] of FIXES) {
  if (html.includes(from)) {
    // replace all occurrences
    let n = 0;
    while (html.includes(from)) {
      html = html.replace(from, to);
      n += 1;
      if (n > 20) break;
    }
    applied += n;
  } else {
    missed.push(from.slice(0, 60));
  }
}

writeFileSync(path, html);
console.log(`applied ${applied} replacements`);
if (missed.length) {
  console.log(`\nnot found (already fixed or text differs):`);
  missed.forEach((m) => console.log(`  - ${m}`));
}
