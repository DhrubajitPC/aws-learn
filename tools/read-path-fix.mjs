import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');
const steps = [];
function edit(label, from, to) {
  if (!h.includes(from)) throw new Error(`anchor not found: ${label}`);
  h = h.replace(from, to);
  steps.push(`ok  ${label}`);
}

// 1. Define the two routes the frontend actually calls: a JSON variant for
//    PDF.js and a rendition route for thumbnails.
edit('add content-url + renditions routes',
  `  return reply
    // Never let a proxy or the browser cache the redirect itself: the signature
    // inside it expires, and a cached 302 would serve a dead URL.
    .header('cache-control', 'private, no-store')
    .header('referrer-policy', 'no-referrer')
    .redirect(url, 302);
});</code></pre>
  </div>`,
  `  return reply
    // Never let a proxy or the browser cache the redirect itself: the signature
    // inside it expires, and a cached 302 would serve a dead URL.
    .header('cache-control', 'private, no-store')
    .header('referrer-policy', 'no-referrer')
    .redirect(url, 302);
});</code></pre>
  </div>

  <p>The redirect covers <code>&lt;img&gt;</code> and <code>&lt;a download&gt;</code>. A PDF viewer needs the URL as a value rather than as a redirect, because it hands that URL to its own range-fetching machinery, so there is a second route returning JSON. Both share one helper, so the authorisation and audit logic exists once.</p>

  <div class="code">
    <div class="code-top"><span>TypeScript</span><span class="path">apps/api/src/routes/documents.ts (JSON variant + renditions)</span><button class="copy" type="button">Copy</button></div>
<pre><code>/** Everything both routes need: authorise, audit, sign. */
async function authoriseAndSign(app: FastifyInstance, req: FastifyRequest, opts: {
  documentId: string; disposition: 'inline' | 'attachment'; ttl: number;
}) {
  const [doc] = await app.withTenant(req.tenant.id, (tx) =&gt;
    tx.select().from(documents)
      .where(and(eq(documents.id, opts.documentId), isNull(documents.deletedAt)))
      .limit(1),
  );
  if (!doc) throw app.httpErrors.notFound('Document not found');

  await app.withTenant(req.tenant.id, (tx) =&gt;
    tx.insert(auditLog).values({
      tenantId: req.tenant.id,
      actor: \`user:\${req.principal.userId}\`,
      action: 'document.content_accessed',
      subjectId: doc.id,
      detail: { disposition: opts.disposition, ip: req.ip },
    }),
  );

  const inline = opts.disposition === 'inline' &amp;&amp; INLINE_SAFE.has(doc.mimeType);
  const filename = headerSafeFilename(doc.filename);

  const url = await getSignedUrl(app.s3, new GetObjectCommand({
    Bucket: doc.s3Bucket,
    Key: doc.s3Key,
    VersionId: doc.s3VersionId ?? undefined,
    ResponseContentDisposition: inline
      ? \`inline; filename="\${filename}"\`
      : \`attachment; filename="\${filename}"\`,
    ResponseContentType: inline ? doc.mimeType : 'application/octet-stream',
  }), { expiresIn: opts.ttl });

  return { url, doc, expiresAt: new Date(Date.now() + opts.ttl * 1000).toISOString() };
}

// JSON variant, for clients that need the URL as a value. Same authorisation,
// same audit row. Deliberately not a header on the 302: a redirect can be
// logged by intermediaries, and a signed URL in an access log is a leak.
app.get('/:id/content-url', {
  preHandler: app.requireAuth,
  schema: {
    params: z.object({ id: z.string().uuid() }),
    querystring: z.object({
      disposition: z.enum(['attachment', 'inline']).default('inline'),
      ttl: z.coerce.number().int().min(30).max(900).default(300),
    }),
    response: {
      200: z.object({ url: z.string().url(), expiresAt: z.string().datetime() }),
    },
  },
}, async (req, reply) =&gt; {
  const { url, expiresAt } = await authoriseAndSign(app, req, {
    documentId: req.params.id, ...req.query,
  });
  return reply.header('cache-control', 'private, no-store').send({ url, expiresAt });
});

/**
 * Renditions live in the derived bucket and are regenerable, so they get a
 * longer signature and a real browser cache. The filename is validated against
 * a pattern rather than interpolated, so this cannot be walked into another
 * prefix.
 */
app.get('/:id/renditions/:name', {
  preHandler: app.requireAuth,
  schema: {
    params: z.object({
      id: z.string().uuid(),
      // p1-thumb.webp | p12-page.webp and nothing else.
      name: z.string().regex(/^p\\d{1,3}-(thumb|page)\\.webp$/),
    }),
  },
}, async (req, reply) =&gt; {
  // Confirm the caller may see the parent document. RLS does the real work.
  const [doc] = await app.withTenant(req.tenant.id, (tx) =&gt;
    tx.select({ id: documents.id }).from(documents)
      .where(and(eq(documents.id, req.params.id), isNull(documents.deletedAt)))
      .limit(1),
  );
  if (!doc) throw app.httpErrors.notFound('Document not found');

  // No audit row here. A grid of 50 thumbnails would write 50 rows per page
  // view and drown the log that matters. Viewing the document is the auditable
  // event; seeing its thumbnail in a list is not.
  const url = await getSignedUrl(app.s3, new GetObjectCommand({
    Bucket: config.DERIVED_BUCKET,
    Key: \`thumbnails/\${req.tenant.id}/\${req.params.id}/\${req.params.name}\`,
    ResponseCacheControl: 'private, max-age=86400',
  }), { expiresIn: 3600 });

  return reply
    // Let the browser reuse the redirect for an hour: renditions are immutable
    // for a given name, so this removes most of the API traffic from a grid.
    .header('cache-control', 'private, max-age=3000')
    .redirect(url, 302);
});</code></pre>
  </div>

  <div class="note">
    <span class="tag">Why thumbnails are not audited</span>
    <p>It is tempting to log every read for completeness. A list view showing fifty thumbnails would then write fifty audit rows per page view, and the signal you actually want, which is "who opened this document", disappears into the noise. Auditing the document read and not the thumbnail is a deliberate line: the rendition is a derived preview, and the audit log exists to answer questions about access to content.</p>
  </div>`);

// 2. Viewer now calls the JSON route rather than reading an invented header.
edit('viewer uses content-url',
  `/**
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
}`,
  `/**
 * Ask for the URL as a value rather than following a redirect. PDF.js needs to
 * hold the URL so it can issue its own range requests against it; pointing it
 * at the API route instead would send every range through our compute and
 * write an audit row per chunk.
 */
async function signedUrlFor(documentId: string, ttlSeconds: number) {
  const res = await fetch(
    \`/api/v1/documents/\${documentId}/content-url?disposition=inline&amp;ttl=\${ttlSeconds}\`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(\`could not obtain a document URL (\${res.status})\`);
  return (await res.json()) as { url: string; expiresAt: string };
}`);

edit('viewer open() uses the object',
  `        // 15 minutes: long enough for a normal read, short enough that a URL
        // pasted into a chat is dead before anyone clicks it.
        const url = await signedUrlFor(documentId, 900);`,
  `        // 15 minutes: long enough for a normal read, short enough that a URL
        // pasted into a chat is dead before anyone clicks it.
        const { url } = await signedUrlFor(documentId, 900);`);

// 3. Interview answer referenced only the 302; mention both routes.
edit('interview answer covers both routes',
  `<p>The API never streams bytes. <code>GET /v1/documents/:id/content</code> verifies the tenant through the usual token claim and row-level security, writes an audit row, then <code>302</code>s to a presigned S3 URL with a 60-second life. Bytes go browser to S3 directly, the same as uploads but in reverse.</p>`,
  `<p>The API never streams bytes. <code>GET /v1/documents/:id/content</code> verifies the tenant through the usual token claim and row-level security, writes an audit row, then <code>302</code>s to a presigned S3 URL with a 60-second life. Bytes go browser to S3 directly, the same as uploads but in reverse. There is a JSON sibling, <code>/content-url</code>, for the PDF viewer, which needs the URL as a value so it can issue its own range requests; both share one helper so the authorisation and audit logic exists once.</p>`);

writeFileSync(p, h);
console.log(steps.join('\n'));
