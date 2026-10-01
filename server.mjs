import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const recipients = ['markofino@yahoo.com', 'johnglivezey@gmail.com'];
const services = new Set(['Website', 'Custom software', 'Automation', 'Not sure yet']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }

export function createApp({ apiKey = process.env.RESEND_API_KEY, from = process.env.CONTACT_FROM, siteUrl = process.env.SITE_URL, trustProxy = process.env.TRUST_PROXY === '1', sendFetch = fetch } = {}) {
  const attempts = new Map();
  const windowMs = 10 * 60 * 1000;
  const cleanup = setInterval(() => { for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key); }, windowMs);
  cleanup.unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/contact') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Use POST to submit the form.' }); }
        const allowed = siteUrl ? new URL(siteUrl).origin : null;
        if (req.headers['sec-fetch-site'] === 'cross-site' || (allowed && req.headers.origin && req.headers.origin !== allowed)) return json(res, 403, { error: 'Submit the form from our website.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected JSON.' });
        const forwarded = req.headers['x-forwarded-for'];
        const ip = trustProxy && typeof forwarded === 'string' ? forwarded.split(',').at(-1).trim() : req.socket.remoteAddress;
        const now = Date.now();
        let bucket = attempts.get(ip);
        if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + windowMs }; attempts.set(ip, bucket); }
        if (++bucket.count > 5) { res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000)); return json(res, 429, { error: 'Too many submissions. Please try again in 10 minutes or email us directly.' }); }
        if (Number(req.headers['content-length']) > 16000) return json(res, 413, { error: 'Message is too long.' });
        let bytes = 0; const chunks = [];
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 16000) { json(res, 413, { error: 'Message is too long.' }); req.resume(); return; } chunks.push(chunk); }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { return json(res, 400, { error: 'Invalid submission.' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'Invalid submission.' });
        if (typeof data.website === 'string' && data.website.trim()) return json(res, 200, { ok: true }); // Honeypot: discard bots.
        const { name, email, service, message } = data;
        if (typeof name !== 'string' || name.trim().length < 1 || name.length > 100 || /[\r\n]/.test(name) || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !services.has(service) || typeof message !== 'string' || !message.trim() || message.length > 5000) return json(res, 400, { error: 'Enter a valid name, email, service, and message (up to 5,000 characters).' });
        if (!apiKey || !from) return json(res, 503, { error: 'The contact form is temporarily unavailable. Please email us directly.' });
        try {
          const result = await sendFetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: recipients, reply_to: email.trim(), subject: `Greenlit inquiry: ${service}`, text: `New inquiry from the Greenlit Software website\n\nName: ${name.trim()}\nEmail: ${email.trim()}\nService: ${service}\n\n${message.trim()}` }),
            signal: AbortSignal.timeout(15000)
          });
          const receipt = await result.json();
          if (!result.ok || !receipt.id) { console.error('Email provider rejected contact submission:', result.status); return json(res, 502, { error: 'Your message could not be sent. Please try again or email us directly.' }); }
          return json(res, 200, { ok: true });
        } catch { console.error('Email provider unavailable'); return json(res, 502, { error: 'We could not confirm your submission. Please email us directly before retrying.' }); }
      }
      if (url.pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true });
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
      let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid path.' }); }
      let target = resolve(root, '.' + pathname);
      if (target !== root && !target.startsWith(root + sep)) return json(res, 403, { error: 'Forbidden.' });
      try { if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html'); } catch { return json(res, 404, { error: 'Page not found.' }); }
      const content = await readFile(target);
      res.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Please try again.' }); else res.end(); }
  });
  server.on('close', () => clearInterval(cleanup));
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Greenlit Software listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
}
