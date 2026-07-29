import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const steps = [];

function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// ═══════════════ SPRINT 04: the read path ═══════════════
edit('sprint 4 read path',
  '  <h2><span class="h2n">§4</span>Terraform: queue, DLQ, and the rule</h2>',
  `  <h2><span class="h2n">§3b</span>Serving documents back</h2>
  <p>Uploads are solved. Reading is a separate problem, and it is not the upload path reversed. Five things differ, and each one changes the design.</p>

  <div class="tw">
  <table>
    <thead><tr><th>Concern</th><th>Upload (PUT)</th><th>Read (GET)</th></tr></thead>
    <tbody>
      <tr><td>What a leaked URL costs you</td><td>One object overwritten inside one tenant's prefix</td><td>The document itself. Content is the asset you are protecting, so read URLs want much shorter lives.</td></tr>
      <tr><td>Browser execution</td><td>Not applicable</td><td>Serving an uploaded SVG or HTML file inline runs it in whatever origin served it. This is stored XSS.</td></tr>
      <tr><td>Auditing</td><td>The API sees the request that authorised it</td><td>If you hand the client a URL, the read never touches your API and cannot be logged.</td></tr>
      <tr><td>Caching</td><td>Irrelevant, each upload is unique</td><td>A signature per request defeats a CDN entirely. Thumbnails at volume need a different mechanism.</td></tr>
      <tr><td>Partial fetches</td><td>Whole object</td><td>A PDF viewer streams byte ranges rather than downloading 40 MB up front.</td></tr>
    </tbody>
  </table>
  </div>

  <h3>The pattern: authorise, audit, then redirect</h3>
  <p>Rather than returning a URL for the client to hold, the API answers with a <code>302</code> to a short-lived signed URL. Authorisation and the audit record stay on your side, and the response works directly in <code>&lt;img src&gt;</code>, <code>&lt;a download&gt;</code> and a PDF viewer without any client code.</p>

  <div class="flow wide">
    <div class="node own"><b>Browser</b><span>GET /content</span></div>
    <span class="arrow">→</span>
    <div class="node own"><b>API</b><span>verify tenant</span></div>
    <span class="arrow">→</span>
    <div class="node aws"><b>RDS</b><span>audit row</span></div>
    <span class="arrow">→</span>
    <div class="node own"><b>302</b><span>60s signed URL</span></div>
    <span class="arrow">→</span>
    <div class="node aws"><b>S3</b><span>bytes</span></div>
  </div>

  <div class="code">
    <div class="code-top"><span>TypeScript</span><span class="path">apps/api/src/routes/documents.ts (read path)</span><button class="copy" type="button">Copy</button></div>
<pre><code>import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Types we are willing to render inside a browser. Everything else is forced
 * to download. An uploaded SVG or HTML file rendered inline executes script
 * in the serving origin, which turns a file upload into stored XSS.
 */
const INLINE_SAFE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif']);

/** Strip anything that could break out of the Content-Disposition header. */
function headerSafeFilename(name: string): string {
  return name.replace(/[\\r\\n"\\\\]/g, '').replace(/[^\\x20-\\x7E]/g, '_').slice(0, 180);
}

app.get('/:id/content', {
  preHandler: app.requireAuth,
  schema: {
    params: z.object({ id: z.string().uuid() }),
    querystring: z.object({
      // Download by default. Inline is opt-in and still gated by the allow-list.
      disposition: z.enum(['attachment', 'inline']).default('attachment'),
      // Longer window for the viewer, which streams ranges over several minutes.
      ttl: z.coerce.number().int().min(30).max(900).default(60),
    }),
  },
}, async (req, reply) =&gt; {
  const { disposition, ttl } = req.query;

  const [doc] = await app.withTenant(req.tenant.id, (tx) =&gt;
    tx.select().from(documents)
      .where(and(eq(documents.id, req.params.id), isNull(documents.deletedAt)))
      .limit(1),
  );
  // Row-level security already hid other tenants' rows, so this is a real 404
  // and it does not confirm whether the id exists elsewhere.
  if (!doc) throw app.httpErrors.notFound('Document not found');

  // Audit BEFORE issuing the URL. Once the client has the URL the read happens
  // against S3 and we never see it, so this is the only chance to record it.
  await app.withTenant(req.tenant.id, (tx) =&gt;
    tx.insert(auditLog).values({
      tenantId: req.tenant.id,
      actor: \`user:\${req.principal.userId}\`,
      action: 'document.content_accessed',
      subjectId: doc.id,
      detail: { disposition, ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 200) },
    }),
  );

  const inline = disposition === 'inline' &amp;&amp; INLINE_SAFE.has(doc.mimeType);
  const filename = headerSafeFilename(doc.filename);

  const url = await getSignedUrl(app.s3, new GetObjectCommand({
    Bucket: doc.s3Bucket,
    Key: doc.s3Key,
    // Pin the version. Without this the URL resolves to "current", which is a
    // different object after a replace, and to nothing after a delete marker.
    VersionId: doc.s3VersionId ?? undefined,

    // S3 applies these to the response it serves, which is how one stored
    // object can be delivered either inline or as a download.
    ResponseContentDisposition: inline
      ? \`inline; filename="\${filename}"\`
      : \`attachment; filename="\${filename}"; filename*=UTF-8''\${encodeURIComponent(doc.filename)}\`,
    ResponseContentType: inline ? doc.mimeType : 'application/octet-stream',
    // Private caching only: the object is tenant data, and the URL is a
    // capability that expires.
    ResponseCacheControl: 'private, max-age=300',
  }), { expiresIn: ttl });

  return reply
    // Never let a proxy or the browser cache the redirect itself: the signature
    // inside it expires, and a cached 302 would serve a dead URL.
    .header('cache-control', 'private, no-store')
    .header('referrer-policy', 'no-referrer')
    .redirect(url, 302);
});</code></pre>
  </div>

  <div class="note warn">
    <span class="tag">The XSS you would otherwise ship</span>
    <p>A user uploads <code>invoice.svg</code> containing a <code>&lt;script&gt;</code> tag. Your viewer opens it inline from the same origin as the app. That script now runs with access to the app's cookies and local storage. Three independent defences: the MIME allow-list above, forcing <code>Content-Disposition: attachment</code> for everything else, and serving content from a <b>separate hostname</b> so an inline render has no access to your app's origin. The upload allow-list in Sprint 04 already rejects SVG, but relying on a single control for this is how it eventually goes wrong.</p>
  </div>

  <h3>Choosing the delivery mechanism</h3>
  <div class="tw">
  <table>
    <thead><tr><th>Approach</th><th>Good</th><th>Bad</th><th>Use for</th></tr></thead>
    <tbody>
      <tr><td><b>302 to a presigned GET</b></td><td>Bytes never touch your compute. Auth and audit stay server-side. Works in <code>img</code>, <code>a</code>, and PDF viewers with no client code.</td><td>One extra round trip. The URL is a bearer capability until it expires.</td><td><b>Chosen</b> for originals</td></tr>
      <tr><td>Stream through the API</td><td>Total control. You can watermark, redact, or transcode on the way out.</td><td>Your containers carry the bandwidth, ALB timeouts apply, and no CDN can help.</td><td>Small previews, or when the bytes must be transformed per-viewer</td></tr>
      <tr><td>CloudFront signed URL or cookie</td><td>Edge caching, and one signed cookie covers every object under a path.</td><td>Key pair to manage and rotate, invalidation needed on delete, per-object authorisation is harder.</td><td>Thumbnails at volume</td></tr>
      <tr><td>Public bucket</td><td>Nothing</td><td>Everything</td><td>Never</td></tr>
    </tbody>
  </table>
  </div>

  <p>The CORS configuration from Sprint 02 needs two additions for range requests to work, because a browser cannot read a response header the server has not exposed:</p>
  <div class="code">
    <div class="code-top"><span>HCL</span><span class="path">infra/modules/storage/main.tf (amended)</span><button class="copy" type="button">Copy</button></div>
<pre><code>resource "aws_s3_bucket_cors_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id
  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.cors_origins
    allowed_headers = ["content-type", "content-md5", "x-amz-server-side-encryption",
                       "x-amz-server-side-encryption-aws-kms-key-id", "x-amz-checksum-sha256",
                       "range", "if-range"]
    # A PDF viewer streams byte ranges. Without Content-Range and Accept-Ranges
    # exposed, the browser fetches the whole file on every seek, or fails.
    expose_headers  = ["ETag", "x-amz-version-id", "Content-Range", "Accept-Ranges", "Content-Length"]
    max_age_seconds = 3000
  }
}</code></pre>
  </div>

  <div class="note">
    <span class="tag">Exfiltration is a metric, not a vibe</span>
    <p>Because every read writes an audit row, "documents read per user per hour" is a queryable number. An account that suddenly downloads four thousand documents is either doing a migration or has been compromised, and either way you want to know within minutes rather than at the next audit. Emit it as a metric alongside the pipeline metrics in Sprint 08 and put anomaly detection on it.</p>
  </div>

  <h2><span class="h2n">§4</span>Terraform: queue, DLQ, and the rule</h2>`);

// DoD additions for sprint 4
edit('sprint 4 dod',
  `    <li><label><input type="checkbox"><span>Runbook written: <code>docs/runbooks/dlq.md</code></span></label></li>`,
  `    <li><label><input type="checkbox"><span>Runbook written: <code>docs/runbooks/dlq.md</code></span></label></li>
    <li><label><input type="checkbox"><span><code>GET /:id/content</code> redirects to a 60-second signed URL and writes an audit row first</span></label></li>
    <li><label><input type="checkbox"><span>Signed GET pins <code>VersionId</code> so a replaced object cannot change what the URL serves</span></label></li>
    <li><label><input type="checkbox"><span>Only allow-listed MIME types render inline; everything else forces download</span></label></li>
    <li><label><input type="checkbox"><span>Bucket CORS exposes <code>Content-Range</code> and <code>Accept-Ranges</code></span></label></li>
    <li><label><input type="checkbox"><span>Another tenant's document id returns 404 on the content route (test proves it)</span></label></li>`);

// ═══════════════ SPRINT 05: thumbnails ═══════════════
edit('sprint 5 thumbnails',
  '  <h2><span class="h2n">§5</span>Testing OCR code without spending money</h2>',
  `  <h2><span class="h2n">§4b</span>Thumbnails and page renditions</h2>
  <p>A document list needs previews, and a viewer wants page images it can show before the full PDF has loaded. Rendering a 40 MB PDF in the browser to produce a 200-pixel thumbnail is slow and happens on every visit, so generate renditions once during processing and store them in the derived bucket.</p>

  <h3>Rendering PDFs in Lambda is the awkward part</h3>
  <p>Node has no built-in PDF rasteriser, and the usual options have real trade-offs:</p>
  <div class="tw">
  <table>
    <thead><tr><th>Option</th><th>How it ships</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td><b>PDFium</b> via a Node binding</td><td>npm dependency with a prebuilt native binary</td><td>The engine in Chrome. Fast and accurate. Needs a container image or a layer built for the right architecture, and ARM64 prebuilds are not always available.</td></tr>
      <tr><td><b>Poppler</b> (<code>pdftoppm</code>)</td><td>System package in a container image</td><td>Reliable and easy to reason about, since you shell out to a binary. Adds around 60 MB to the image.</td></tr>
      <tr><td><b>Ghostscript</b></td><td>System package</td><td>Handles broken PDFs other renderers reject. Slower, and licensing needs a look for commercial use.</td></tr>
      <tr><td>Rasterise in the browser</td><td>No backend work</td><td>Shifts cost to every viewer and cannot produce a list thumbnail before the file is fetched.</td></tr>
    </tbody>
  </table>
  </div>
  <p>This project uses a container-image Lambda with Poppler and <code>sharp</code>. The image is larger than a zip, and cold starts are longer, which matters much less for a background job than it would for the API.</p>

  <div class="code">
    <div class="code-top"><span>Dockerfile</span><span class="path">services/render-worker/Dockerfile</span><button class="copy" type="button">Copy</button></div>
<pre><code># Lambda base image so the runtime interface client is already present.
FROM public.ecr.aws/lambda/nodejs:22-arm64

# poppler-utils gives us pdftoppm; sharp handles resizing and WebP encoding.
RUN dnf install -y poppler-utils &amp;&amp; dnf clean all

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./
CMD [ "handler.handler" ]</code></pre>
  </div>

  <div class="code">
    <div class="code-top"><span>TypeScript</span><span class="path">services/render-worker/src/handler.ts</span><button class="copy" type="button">Copy</button></div>
<pre><code>import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const run = promisify(execFile);
const s3 = new S3Client({});

/** Two sizes: a grid thumbnail and a viewer-sized page image. */
const RENDITIONS = [
  { name: 'thumb', width: 320, quality: 72 },
  { name: 'page',  width: 1400, quality: 82 },
];

export async function renderFirstPages(opts: {
  bucket: string; key: string; tenantId: string; documentId: string; pages: number;
}) {
  // Lambda gives you /tmp, sized by ephemeral_storage. A large PDF plus its
  // rasterised output can exceed the 512 MB default, so the function is
  // provisioned with 2048 MB and cleans up after itself.
  const dir = await mkdtemp(join(tmpdir(), 'render-'));

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key }));
    const src = join(dir, 'in.pdf');
    await writeFile(src, Buffer.from(await obj.Body!.transformToByteArray()));

    // Cap the work: nobody scrolls a thumbnail strip of 300 pages, and
    // rendering them all is how a background job becomes a timeout.
    const pageCount = Math.min(opts.pages || 1, 10);

    // -r 150 is enough resolution for a 1400px wide render of A4.
    // -png because pdftoppm's JPEG output quality is poor.
    await run('pdftoppm', [
      '-png', '-r', '150', '-f', '1', '-l', String(pageCount),
      src, join(dir, 'page'),
    ], { timeout: 90_000, maxBuffer: 1024 * 1024 });

    const written: string[] = [];

    for (let n = 1; n &lt;= pageCount; n++) {
      // pdftoppm zero-pads the page number based on the page count.
      const pad = String(pageCount).length;
      const raw = join(dir, \`page-\${String(n).padStart(pad, '0')}.png\`);
      const png = await readFile(raw).catch(() =&gt; null);
      if (!png) continue;

      for (const r of RENDITIONS) {
        const out = await sharp(png)
          .resize({ width: r.width, withoutEnlargement: true })
          // WebP is roughly 30% smaller than equivalent-quality JPEG and is
          // supported everywhere that matters now.
          .webp({ quality: r.quality })
          .toBuffer();

        const key = \`thumbnails/\${opts.tenantId}/\${opts.documentId}/p\${n}-\${r.name}.webp\`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.DERIVED_BUCKET!,
          Key: key,
          Body: out,
          ContentType: 'image/webp',
          // Renditions are regenerable, so a long browser cache is safe once
          // the URL that serves them is itself access-controlled.
          CacheControl: 'private, max-age=86400',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: process.env.KMS_KEY_ID,
          Metadata: { 'tenant-id': opts.tenantId, 'document-id': opts.documentId },
        }));
        written.push(key);
      }
    }

    return written;
  } finally {
    // /tmp persists between invocations on a warm container. Not cleaning up
    // means the next invocation starts with less space than it expects.
    await rm(dir, { recursive: true, force: true });
  }
}</code></pre>
  </div>

  <div class="note cost">
    <span class="tag">Where this costs money, and where it does not</span>
    <p>Rendering is CPU-bound, and Lambda scales CPU with memory, so 2048 MB is often <em>cheaper</em> than 512 MB for this work: four times the memory price against roughly a quarter of the duration. Measure both. Storage is the part to watch instead. Two renditions across ten pages is twenty objects per document, which is why Sprint 02's derived bucket expires the <code>thumbnails/</code> prefix after 180 days. They regenerate on demand, so expiry costs a little latency rather than data.</p>
  </div>

  <h2><span class="h2n">§5</span>Testing OCR code without spending money</h2>`);

edit('sprint 5 dod',
  `    <li><label><input type="checkbox"><span>ADR written on the cheap-first / expensive-when-needed feature strategy</span></label></li>`,
  `    <li><label><input type="checkbox"><span>Render worker produces thumb and page renditions for the first N pages</span></label></li>
    <li><label><input type="checkbox"><span>Render Lambda has enough ephemeral storage for a large PDF and clears <code>/tmp</code></span></label></li>
    <li><label><input type="checkbox"><span>Page-count cap in place so a 300-page document cannot time out the job</span></label></li>
    <li><label><input type="checkbox"><span>ADR written on the cheap-first / expensive-when-needed feature strategy</span></label></li>`);

// ═══════════════ SPRINT 10: the viewer ═══════════════
edit('sprint 10 viewer',
  '  <h2><span class="h2n">§3</span>Interview questions on this material</h2>\n\n  <details class="qa"><summary>How do you serve a single-page app from S3 and CloudFront?</summary>',
  `  <h2><span class="h2n">§2b</span>The document viewer</h2>
  <p>Two surfaces: a thumbnail in the list, and a full viewer. Both read through the content endpoint from Sprint 04, so authorisation and auditing happen once in one place.</p>

  <h3>Thumbnails</h3>
  <p>A thumbnail is just an image whose source is an authorising redirect. No client-side signing, no URL management, and the browser's own cache does the rest.</p>
  <div class="code">
    <div class="code-top"><span>TSX</span><span class="path">apps/web/src/features/documents/Thumbnail.tsx</span><button class="copy" type="button">Copy</button></div>
<pre><code>export function Thumbnail({ doc }: { doc: DocumentDto }) {
  const [failed, setFailed] = useState(false);

  // The API 302s to a signed URL. Cookies travel because the endpoint is on
  // the same origin through CloudFront, so there is nothing to sign here.
  if (failed || doc.status !== 'ready') {
    return &lt;FileGlyph mimeType={doc.mimeType} status={doc.status} /&gt;;
  }

  return (
    &lt;img
      src={\`/api/v1/documents/\${doc.id}/renditions/p1-thumb.webp\`}
      alt={\`First page of \${doc.filename}\`}
      width={160}
      height={226}
      loading="lazy"          /* a list of 200 documents should not fetch 200 images */
      decoding="async"
      onError={() =&gt; setFailed(true)}   /* renditions expire after 180 days */
    /&gt;
  );
}</code></pre>
  </div>

  <h3>The PDF viewer, and the expiry problem</h3>
  <p>PDF.js does not download the whole file. It reads the trailer, then fetches byte ranges as you scroll, which is what makes a 40 MB document open instantly. That behaviour interacts badly with short-lived URLs, and this is the detail worth knowing:</p>
  <div class="note warn">
    <span class="tag">A 60-second URL breaks a 10-minute read</span>
    <p>The viewer opens, streams the first ranges successfully, and then the reader spends fifteen minutes on the document. The next range request after expiry comes back <code>403</code>, and PDF.js surfaces it as a corrupt-file error, which is a confusing thing to show someone. Two fixes, and you want both: request a longer <code>ttl</code> for the viewer specifically, and catch the failure to re-issue a URL and resume rather than reporting corruption.</p>
  </div>

  <div class="code">
    <div class="code-top"><span>TypeScript</span><span class="path">apps/web/src/features/viewer/usePdf.ts</span><button class="copy" type="button">Copy</button></div>
<pre><code>import * as pdfjs from 'pdfjs-dist';

/**
 * Resolve the redirect ourselves so PDF.js receives a direct S3 URL. Handing
 * it the API route works too, but every range request would then take the
 * extra hop and write an audit row, which floods the log.
 */
async function signedUrlFor(documentId: string, ttlSeconds: number): Promise&lt;string&gt; {
  const res = await fetch(
    \`/api/v1/documents/\${documentId}/content?disposition=inline&amp;ttl=\${ttlSeconds}\`,
    { redirect: 'manual', credentials: 'include' },
  );
  // With redirect: 'manual' a cross-origin 302 is opaque, so the API also
  // returns the target in a header we can read.
  const url = res.headers.get('x-content-url');
  if (!url) throw new Error('could not obtain a document URL');
  return url;
}

export function usePdf(documentId: string) {
  const [doc, setDoc] = useState&lt;pdfjs.PDFDocumentProxy | null&gt;(null);
  const [error, setError] = useState&lt;string | null&gt;(null);

  useEffect(() =&gt; {
    let cancelled = false;
    let attempt = 0;

    async function open() {
      try {
        // 15 minutes: long enough for a normal read, short enough that a URL
        // pasted into a chat is dead before anyone clicks it.
        const url = await signedUrlFor(documentId, 900);

        const loading = pdfjs.getDocument({
          url,
          // Range requests are the whole point. They need Content-Range and
          // Accept-Ranges exposed by the bucket CORS rule.
          disableRange: false,
          disableStream: false,
          rangeChunkSize: 262_144,
        });

        const pdf = await loading.promise;
        if (!cancelled) { setDoc(pdf); }
      } catch (err) {
        // A range request after expiry fails as a fetch error, which PDF.js
        // reports as invalid PDF structure. Re-sign once before believing it.
        if (attempt === 0 &amp;&amp; !cancelled) {
          attempt += 1;
          return open();
        }
        if (!cancelled) {
          setError('This document could not be opened. Try reloading the page.');
        }
      }
    }

    open();
    return () =&gt; { cancelled = true; };
  }, [documentId]);

  return { doc, error };
}</code></pre>
  </div>

  <p>Two supporting decisions. The worker is loaded from your own origin rather than a CDN, because the Content Security Policy in this sprint has no external <code>script-src</code>. And the download button points at the same endpoint without <code>disposition=inline</code>, so one route serves both viewing and downloading and the audit log records which one happened.</p>

  <h2><span class="h2n">§3</span>Interview questions on this material</h2>

  <details class="qa"><summary>How do you serve documents back to a browser securely?</summary>
  <div class="qa-body">
    <p>The API never streams bytes. <code>GET /v1/documents/:id/content</code> verifies the tenant through the usual token claim and row-level security, writes an audit row, then <code>302</code>s to a presigned S3 URL with a 60-second life. Bytes go browser to S3 directly, the same as uploads but in reverse.</p>
    <p>The ordering matters: the audit row is written <em>before</em> the URL is issued, because once the client holds the URL the read happens against S3 and my API never sees it. That is the only opportunity to record who accessed what.</p>
    <p>Three things I set on the signed request. <code>VersionId</code> is pinned, so the URL cannot resolve to different bytes after a replace or to nothing after a delete marker. <code>ResponseContentDisposition</code> is <code>attachment</code> unless the MIME type is on a small inline allow-list, because rendering an uploaded SVG or HTML file inline executes script in the serving origin, which is stored XSS. And the redirect itself carries <code>Cache-Control: no-store</code>, since a cached 302 would hand out an expired signature.</p>
    <p>What I would add for a larger deployment: serve content from a separate hostname so an inline render has no access to the app's origin at all, and move thumbnails to CloudFront signed cookies, because a unique signature per request means a CDN can never cache them.</p>
  </div></details>

  <details class="qa"><summary>Someone pastes a presigned URL into a group chat. What is the exposure?</summary>
  <div class="qa-body">
    <p>Anyone with the link can fetch that one object until the signature expires, with no authentication, because a presigned URL is a bearer capability. So the honest answer is scoped by three properties I control.</p>
    <p><b>Lifetime.</b> Read URLs expire in 60 seconds by default, and 15 minutes for the viewer where range requests need it. That is the actual exposure window, and it is why read URLs are much shorter-lived than the 15-minute upload URLs.</p>
    <p><b>Scope.</b> The signature covers one bucket, one key and one version. It grants nothing else, cannot list the bucket, and cannot reach another tenant's prefix.</p>
    <p><b>Detection.</b> Every issuance wrote an audit row before the URL existed, so I know which user requested it and when. If a link leaks, I can say exactly whose session produced it.</p>
    <p>What I cannot do is revoke an already-issued URL, short of rotating the signing credential or deleting the object. That is inherent to the mechanism, and it is the reason the expiry is measured in seconds rather than hours. If a document class needed stronger control, the answer is to stop handing out URLs and stream through the API instead, accepting the bandwidth cost in exchange for revocability on every request.</p>
  </div></details>

  <details class="qa"><summary>How do you serve a single-page app from S3 and CloudFront?</summary>`);

edit('sprint 10 dod',
  `    <li><label><input type="checkbox"><span>Lighthouse accessibility score above 95; keyboard navigation works throughout</span></label></li>`,
  `    <li><label><input type="checkbox"><span>Thumbnails load lazily and fall back to a glyph when a rendition has expired</span></label></li>
    <li><label><input type="checkbox"><span>PDF viewer streams byte ranges rather than downloading the whole file</span></label></li>
    <li><label><input type="checkbox"><span>A URL expiring mid-read re-signs and resumes instead of reporting a corrupt file</span></label></li>
    <li><label><input type="checkbox"><span>Download and inline view go through the same endpoint and both appear in the audit log</span></label></li>
    <li><label><input type="checkbox"><span>Lighthouse accessibility score above 95; keyboard navigation works throughout</span></label></li>`);

// ═══════════════ reference: debugging rows ═══════════════
edit('debugging index rows',
  `      <tr><td>Bedrock <code>AccessDeniedException</code></td>`,
  `      <tr><td>PDF viewer reports a corrupt file part-way through</td><td>Signed URL expired mid-range-request</td><td>Increase the viewer <code>ttl</code>; re-sign and retry on range failure</td></tr>
      <tr><td>PDF fetches the whole file on every seek</td><td><code>Content-Range</code> not exposed by bucket CORS</td><td>Add it to <code>expose_headers</code></td></tr>
      <tr><td>Signed GET returns 403 immediately</td><td>Object version gone, or clock skew, or wrong KMS grant</td><td><code>head-object</code> with the pinned <code>VersionId</code>; check <code>kms:Decrypt</code> on the API role</td></tr>
      <tr><td>Uploaded file executes script when previewed</td><td>Served inline from the app origin</td><td>Force <code>Content-Disposition: attachment</code>; use a separate content hostname</td></tr>
      <tr><td>Bedrock <code>AccessDeniedException</code></td>`);

writeFileSync(p, h);
console.log(steps.join('\n'));
