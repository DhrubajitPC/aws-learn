#!/usr/bin/env node
// Inserts "fundamentals" teaching blocks into sprints 00-06.
// Each entry: [anchor string already in the file, html to insert BEFORE it].

import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../docs/index.html', import.meta.url);
let html = readFileSync(path, 'utf8');

const INSERTS = [];

// ─────────────────────────── SPRINT 0 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§3</span>Account setup, step by step</h2>',
  `  <h2><span class="h2n">§2b</span>Fundamentals: how AWS decides what to charge you</h2>
  <p>Beginners are surprised by AWS bills because they assume the cost is "the servers". Almost everything is billed along four axes, and once you can spot which axes a service uses, you can predict the bill before you create the resource.</p>
  <div class="tw">
  <table>
    <thead><tr><th>Axis</th><th>What it means</th><th>Examples in this project</th></tr></thead>
    <tbody>
      <tr><td><b>Time</b></td><td>You pay per hour or per second while the thing exists, whether or not you use it</td><td>NAT Gateway, RDS instance, ALB, VPC interface endpoints, KMS keys</td></tr>
      <tr><td><b>Requests</b></td><td>You pay per API call or per operation</td><td>S3 GET and PUT, KMS decrypt, Lambda invocations, SQS messages</td></tr>
      <tr><td><b>Volume stored</b></td><td>You pay per gigabyte-month, and the rate depends on storage class</td><td>S3 objects, RDS storage, CloudWatch log retention, EBS</td></tr>
      <tr><td><b>Data transfer</b></td><td>You pay to move bytes across certain boundaries</td><td>NAT processing, cross-AZ traffic, egress to the internet</td></tr>
    </tbody>
  </table>
  </div>
  <p>Three rules follow from that table, and they explain most cost surprises.</p>
  <ol>
    <li><b>Time-billed resources are the dangerous ones</b>, because they charge while you sleep. A forgotten NAT Gateway costs $32 a month forever. A forgotten Lambda costs nothing, because it is request-billed and nothing is invoking it. When you are learning, prefer request-billed services and destroy time-billed ones.</li>
    <li><b>Data transfer <em>into</em> AWS is free; moving it around and out is not.</b> Traffic between AZs is billed in both directions. Traffic to the internet is billed. Traffic to an AWS service through a NAT Gateway is billed twice over, once for NAT processing and once as transfer. That last one is why VPC endpoints exist.</li>
    <li><b>Request charges look trivial until they are not.</b> KMS costs about $0.03 per ten thousand requests. Harmless, until you realise a naive setup makes one KMS call per S3 object read, and you are reading millions of objects. S3 Bucket Keys exist precisely to collapse that.</li>
  </ol>
  <div class="note">
    <span class="tag">A useful habit</span>
    <p>Before you create anything, ask which of the four axes it bills on. If the answer includes "time", ask whether you need it running when you are not looking at it. That single question is most of cost engineering, and it is the reason this manual keeps telling you to destroy the dev environment.</p>
  </div>

`]);

// ─────────────────────────── SPRINT 1 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§3</span>Migrations with node-pg-migrate</h2>',
  `  <h2><span class="h2n">§2b</span>Fundamentals: ORMs, query builders and migration tools</h2>
  <p>Three categories of tool, often confused, doing different jobs. Understanding the split is why this project uses two libraries where many tutorials use one.</p>
  <ul>
    <li>A <b>full ORM</b> (Hibernate, older TypeORM, Django's ORM) maps rows to objects and manages their identity and lifecycle for you. It hides SQL. That is comfortable at first and expensive later, because you eventually need to reason about the SQL it generates and you have lost direct access to it.</li>
    <li>A <b>query builder with types</b> (Drizzle, Kysely) gives you SQL semantics with TypeScript checking. You still write joins and where clauses; the library checks that the columns exist and infers the shape of the result. There is no hidden lazy loading and no surprise N+1 query.</li>
    <li>A <b>migration tool</b> (node-pg-migrate, Flyway, Liquibase) does one thing: apply ordered, recorded schema changes to a database, with a lock so two runners cannot collide, and a record of which migrations have run.</li>
  </ul>
  <p>Drizzle can generate migrations from your schema definition, which is convenient in development. It is the wrong shape for deploying to a shared database, because the generated file is derived from a diff rather than authored by you, and reviewing a diff of a diff is unpleasant. So this project takes the typed query builder from Drizzle and the migration discipline from node-pg-migrate, and accepts one cost: the schema is declared twice, and a check in CI verifies the two agree.</p>

  <h3>Connection pooling, and why it matters more than you expect</h3>
  <p>Every Postgres connection is a separate operating-system process on the server with its own memory. A <code>db.t4g.micro</code> allows on the order of 80 connections. That number, not CPU, is usually what breaks first.</p>
  <p>A <b>pool</b> keeps a small number of connections open and lends them to requests. Ten connections can serve hundreds of requests per second, because each request holds a connection for only a few milliseconds. Two consequences shape the design of this system:</p>
  <ul>
    <li><b>A long-lived server is the ideal pool holder.</b> The Fargate API opens ten connections at boot and reuses them, which is one reason the API is a container rather than a Lambda.</li>
    <li><b>Serverless breaks the assumption.</b> A hundred concurrent Lambdas each want their own connection, and there is no shared pool between them. That is the problem RDS Proxy solves, by holding the real pool outside your functions. At portfolio scale the Lambda concurrency cap does the same job for free, which is why Sprint 04 sets one.</li>
  </ul>
  <p>The number to remember: pool size per instance, multiplied by number of instances, must stay comfortably under <code>max_connections</code>, leaving room for migrations, your own psql session and the monitoring agent.</p>

`]);

// ─────────────────────────── SPRINT 2 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§2</span>Repository and state layout</h2>',
  `  <h2><span class="h2n">§1b</span>Fundamentals: what Terraform actually does</h2>
  <p>Terraform has a small number of moving parts. Once they click, error messages start making sense.</p>
  <h3>The three-way comparison</h3>
  <p>Every <code>terraform plan</code> compares three things: your <b>configuration</b> (the .tf files), the <b>state</b> (what Terraform believes it created) and <b>reality</b> (what the AWS API reports right now). The plan is the set of API calls needed to make reality match configuration, and state is what lets Terraform know which real resource each block in your code refers to.</p>
  <p>That framing explains the common confusions:</p>
  <ul>
    <li><b>Drift</b> is reality differing from state. Someone changed something in the console. The plan shows it because Terraform refreshes state from the API before comparing.</li>
    <li><b>"Resource already exists"</b> means reality has it but state does not. Either it was created outside Terraform, or state was lost. The fix is <code>terraform import</code>, or an <code>import</code> block in newer versions.</li>
    <li><b>Losing state does not delete anything.</b> Your infrastructure keeps running. Terraform simply no longer knows it owns it, and the next apply tries to create duplicates. This is why the state bucket is versioned.</li>
  </ul>
  <h3>The dependency graph</h3>
  <p>Terraform does not run your file top to bottom. It builds a directed graph from the references between resources and walks it, creating independent resources in parallel. When you write <code>subnet_id = aws_subnet.app[0].id</code>, that reference <em>is</em> the dependency declaration, which is why explicit <code>depends_on</code> is rarely needed. You need it only when the dependency is real but invisible to Terraform, such as an IAM policy that must exist before a service can assume a role.</p>
  <h3>Providers, and why versions get pinned</h3>
  <p>A provider is a plugin that translates Terraform resources into a specific API's calls. The AWS provider is a large program with its own release cycle, and its releases change defaults. A minor provider upgrade genuinely can produce a plan that wants to replace a resource. Pin with <code>~&gt;</code>, commit the lock file, and upgrade deliberately while reading the changelog.</p>
  <div class="note">
    <span class="tag">Read the plan properly</span>
    <p>Plan output uses symbols that carry very different consequences. <code>+</code> create. <code>-</code> destroy. <code>~</code> update in place, which is safe. <code>-/+</code> destroy then create, which for a database or a bucket means data loss. Terraform prints <code># forces replacement</code> next to the attribute responsible. Search for that string in every plan before applying, and understand why it appeared.</p>
  </div>

`]);

// ─────────────────────────── SPRINT 3 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§3</span>Terraform: the user pool</h2>',
  `  <h2><span class="h2n">§2b</span>Fundamentals: what a JWT actually is</h2>
  <p>A JSON Web Token is three base64url-encoded strings joined by dots. You can decode one by hand, and doing so once removes most of the mystery.</p>
  <div class="code">
    <div class="code-top"><span>Shell</span><span class="path">decode a token yourself</span><button class="copy" type="button">Copy</button></div>
<pre><code># Split on dots, decode the first two parts. The third is the signature,
# which is binary and will not decode to anything readable.
TOKEN="eyJraWQiOiJ..."

# Header: which algorithm, and which key signed it
echo "$TOKEN" | cut -d. -f1 | base64 -d 2&gt;/dev/null | jq .
# { "kid": "abc123...", "alg": "RS256" }

# Payload: the claims
echo "$TOKEN" | cut -d. -f2 | base64 -d 2&gt;/dev/null | jq .
# {
#   "sub": "9f8e7d6c-...",         <- stable user id, our join key
#   "token_use": "access",          <- MUST be checked
#   "iss": "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_AbC",
#   "client_id": "1h57kf5...",
#   "exp": 1735689600,              <- expiry, seconds since epoch
#   "iat": 1735688700,
#   "custom:tenant_id": "..."
# }</code></pre>
  </div>
  <p>Four things follow from that structure, and each one matters.</p>
  <ol>
    <li><b>A JWT is signed, not encrypted.</b> Anyone holding the token can read every claim. Never put a secret in one. The signature guarantees the claims have not been altered; it does not hide them.</li>
    <li><b>The <code>kid</code> in the header selects the key.</b> Identity providers rotate signing keys and publish several at once, so the verifier fetches the key set and picks the matching key by id. That is why key rotation does not break running services.</li>
    <li><b>Verification is local and cheap.</b> RSA signature verification takes microseconds. No network call, which is why your API does not ask Cognito anything per request.</li>
    <li><b>A valid signature is the only thing consulted.</b> There is no lookup, so there is no way to invalidate one token before <code>exp</code> without adding shared state. That is the trade you accept for statelessness, and it is why token lifetime is a security decision rather than a convenience one.</li>
  </ol>
  <div class="note warn">
    <span class="tag">The checks people skip</span>
    <p>Verifying the signature is necessary and not sufficient. A correctly signed token from a <em>different</em> user pool, or minted for a different app client, or an ID token presented where an access token was required, all have perfectly valid signatures. So the verifier must also check <code>iss</code> matches your pool, <code>aud</code> or <code>client_id</code> matches your app client, <code>exp</code> has not passed and <code>token_use</code> is what you expect. The <code>aws-jwt-verify</code> library does all of this when configured properly, which is a reason to use it rather than a generic JWT library.</p>
  </div>

`]);

// ─────────────────────────── SPRINT 4 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§3</span>Issuing the presigned URL</h2>',
  `  <h2><span class="h2n">§2b</span>Fundamentals: queues, and the guarantees they do and do not give</h2>
  <p>A queue looks simple and has sharp edges. Four properties determine how you have to write the consumer.</p>
  <h3>Delivery semantics</h3>
  <p>SQS standard queues are <b>at-least-once</b>. A message can be delivered twice, occasionally more. This is not a bug or a rare edge case; it is the documented behaviour, and it happens for mundane reasons: your consumer succeeded but crashed before acknowledging, or the visibility timeout expired while work was still in progress, or an internal retry occurred.</p>
  <p>Exactly-once delivery is not something a distributed queue can provide. What you can build is <b>effectively-once processing</b>, by making the consumer idempotent. That is why the ingest worker claims a dedupe key before doing anything else.</p>
  <p>FIFO queues offer ordering and deduplication within a five-minute window, at a much lower throughput ceiling and with a required message group id. We do not use one, because our documents are independent, ordering does not matter and throughput does.</p>
  <h3>Visibility timeout</h3>
  <p>When a consumer receives a message, the queue hides it from other consumers for the visibility timeout rather than deleting it. If the consumer deletes it in time, it is gone. If the consumer dies, the timeout expires and the message reappears for someone else. That is the retry mechanism, and it is why the timeout must exceed your processing time with margin. With a Lambda event source mapping, the guidance is at least six times the function timeout.</p>
  <h3>The redrive policy</h3>
  <p><code>maxReceiveCount</code> is how many times a message may be received before the queue moves it to the dead-letter queue. It counts receives, not failures, so a message that times out repeatedly consumes attempts without your code ever completing. Three is a reasonable default: enough to ride out a transient failure, few enough that a permanently broken message surfaces quickly instead of being retried for hours.</p>
  <h3>Long polling</h3>
  <p>With <code>receive_wait_time_seconds</code> at zero, a poll returns immediately even when the queue is empty, so you pay for empty receives and get more of them. Setting it to 20 makes the request wait until a message arrives or the time expires. Fewer requests, lower cost, lower latency. There is no reason to leave it at zero.</p>
  <div class="note">
    <span class="tag">The mental model</span>
    <p>A queue is not a pipe that transports messages. It is a durable store with a lease protocol. Consumers take a lease on a message, and the message returns to the pool if the lease expires without a delete. Once you picture it that way, duplicate delivery stops being surprising and idempotency stops feeling like defensive programming.</p>
  </div>

`]);

// ─────────────────────────── SPRINT 5 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§2</span>The callback architecture</h2>',
  `  <h2><span class="h2n">§1b</span>Fundamentals: what OCR does, and what confidence means</h2>
  <p>Optical character recognition takes an image of text and returns characters. Modern OCR runs several stages, and knowing them explains most of the failures you will see.</p>
  <ol>
    <li><b>Rasterisation.</b> A PDF may already contain a text layer, or it may be a scanned image. Textract handles both, but a scanned page is an image and everything downstream is inference rather than lookup.</li>
    <li><b>Preprocessing.</b> Deskewing a page photographed at an angle, correcting rotation, normalising contrast. This is why a phone photo of a receipt on a dark desk performs worse than a flatbed scan.</li>
    <li><b>Detection.</b> Finding regions that contain text and drawing bounding boxes around words and lines.</li>
    <li><b>Recognition.</b> Converting each region to characters, with a confidence score.</li>
    <li><b>Layout analysis.</b> Deciding that this word is a form label and that word is its value, or that these boxes form a table with rows and columns. This is the hard part, and it is what the more expensive Textract features are actually paying for.</li>
  </ol>
  <h3>Geometry is normalised, which is more useful than it sounds</h3>
  <p>Every block comes with a bounding box whose coordinates run from 0 to 1 as fractions of the page, not pixels. So a box at <code>Left: 0.1, Top: 0.05</code> is a tenth of the way across and a twentieth down, whatever the page resolution. That means you can render highlight overlays on a page image of any size without rescaling, and you can reason about position (is this in the top-right, where invoice numbers usually live?) without knowing the DPI.</p>
  <h3>Confidence is a per-block probability, and the average lies</h3>
  <p>Each word carries a confidence from 0 to 100, which is the model's own estimate that it read the characters correctly. Two things to understand about using it:</p>
  <ul>
    <li><b>It is per-block, so it composes badly.</b> A form field is a key block and a value block. Taking the mean of the two overstates reliability; taking the minimum is honest, because a perfectly-read label attached to a misread value is a wrong field.</li>
    <li><b>The mean over a page hides the distribution.</b> A page where 70% of words score 98 and 30% score 40 averages around 80, which looks acceptable. It is not acceptable; nearly a third of the page is noise. That is why this project gates on the <em>proportion of words below 80</em> rather than on the mean. A distribution measure catches the failure that a central-tendency measure smooths away.</li>
  </ul>
  <p>What causes low confidence in practice: handwriting, stamps and signatures overlapping printed text, low-resolution faxes, skew, photocopies of photocopies, unusual fonts and text over background images. Most of these are properties of how the customer scans documents, which is why a sudden drop in confidence for one tenant is a conversation rather than an incident.</p>

`]);

// ─────────────────────────── SPRINT 6 ───────────────────────────
INSERTS.push([
  '  <h2><span class="h2n">§3</span>Structured output via tool use — the technique that matters</h2>',
  `  <h2><span class="h2n">§2b</span>Fundamentals: what an embedding is</h2>
  <p>Semantic search rests on one idea, and it is worth understanding rather than treating as magic.</p>
  <p>An <b>embedding model</b> reads a piece of text and returns a list of numbers, in our case 1,024 of them. That list is a position in a 1,024-dimensional space. The model has been trained so that texts with similar meaning land near each other in that space, even when they share no words. "Terminate the agreement early" and "cancel before the end of the term" end up close together. "Bank" in a financial document and "bank" of a river end up apart, because the model reads the surrounding context.</p>
  <p>Search then becomes geometry. You embed the user's query the same way, and look for the stored vectors closest to it.</p>
  <h3>Cosine distance, and why we normalise</h3>
  <p>Closeness is measured by the angle between two vectors rather than the straight-line distance, because the direction carries the meaning and the length mostly reflects text length. Cosine similarity runs from -1 to 1, where 1 means the same direction. pgvector's <code>&lt;=&gt;</code> operator gives cosine <em>distance</em>, which is 1 minus similarity, so smaller is more similar and <code>ORDER BY</code> ascending is what you want.</p>
  <p>Asking Titan for <code>normalize: true</code> returns unit-length vectors, which makes that computation cheaper and makes cosine and dot-product ranking equivalent.</p>
  <h3>Why chunk at all</h3>
  <p>Two reasons. An embedding is a fixed-size summary of whatever you give it, so embedding a forty-page contract into 1,024 numbers averages everything into mush and matches nothing precisely. And a search result should point at a passage a person can read, not at a whole document. Chunking at roughly a thousand characters keeps each vector about one idea, which is what makes results feel precise.</p>
  <p>The overlap exists for a specific failure: a sentence that straddles a chunk boundary is fully present in neither chunk, so a query matching that sentence finds nothing good. Carrying 150 characters from the previous chunk into the next one costs a little storage and removes the blind spot.</p>
  <h3>Approximate search, and the honest trade</h3>
  <p>Finding the true nearest neighbours means comparing the query against every vector, which is linear and eventually too slow. HNSW builds a navigable graph so search visits a small fraction of the vectors. It is <b>approximate</b>: it can miss a true nearest neighbour. The knob is <code>ef_search</code>, which controls how much of the graph to explore. Higher means better recall and more time. Being able to say "my vector search is approximate, here is the parameter that controls recall, and here is why I set it per query type" is the difference between using a vector index and understanding one.</p>
  <div class="note warn">
    <span class="tag">Sizing, because this catches people out</span>
    <p>At 1,024 dimensions with four-byte floats, one vector is about 4 KB. A million chunks is roughly 4 GB of raw vectors, plus the graph structure on top. HNSW wants to live in memory; when it does not fit, queries start touching disk and latency changes character rather than degrading gently. That arithmetic, not row count, is what tells you which RDS instance class you need, and it is the number that eventually pushes a growing corpus towards a dedicated vector store.</p>
  </div>

`]);

let ok = 0;
const missing = [];
for (const [anchor, block] of INSERTS) {
  if (html.includes(anchor)) {
    html = html.replace(anchor, block + anchor);
    ok += 1;
  } else {
    missing.push(anchor.slice(0, 70));
  }
}

writeFileSync(path, html);
console.log(`inserted ${ok}/${INSERTS.length} blocks`);
missing.forEach((m) => console.log(`  MISSING ANCHOR: ${m}`));
