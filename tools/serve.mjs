/**
 * A static file server for the built demos, so the browser gates need nothing
 * installed beyond Node. usage: node tools/serve.mjs <dir> <port>
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { strictPolicy } from './csp-policy.mjs';

const root = resolve(process.argv[2] ?? 'dist/demos');
const port = Number(process.argv[3] ?? 4321);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

/**
 * A store for the browser tests of files sent to a real endpoint (uploadTo), so the browser's own network — slowed as
 * a phone's is — carries them: a POST to /api/… of a form keeps its `file` part, a PUT keeps its body, each in memory;
 * the answer gives its address (and, for a POST, its id), and a GET of that address gives it back. A static host has
 * none of this: the demos' own store is the memory source.
 */
const kept = new Map();

/**
 * What every file is answered with as fieldia.dev's host answers it (GitHub Pages: `access-control-allow-origin: *` on
 * every file; most CDNs send the same): a page of this site shown in an embed field runs in an opaque origin — framed
 * without allow-same-origin — so its module scripts are fetched from origin "null" and need it, as a person's browser
 * fetches them from fieldia.dev. Nothing here relies on its absence: parts are asked for from the page's own origin.
 */
const AS_THE_HOST = { 'access-control-allow-origin': '*' };
let keptIds = 0;
function store(request, response, url) {
  if (request.method === 'GET') {
    const file = kept.get(url.pathname);
    if (!file) return response.writeHead(404, { 'content-type': 'text/plain' }).end(`Not stored: ${url.pathname}`);
    return response.writeHead(200, { 'content-type': file.type, 'cache-control': 'no-store' }).end(file.bytes);
  }
  if (request.method !== 'POST' && request.method !== 'PUT') return response.writeHead(405).end();
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const body = Buffer.concat(chunks);
    if (request.method === 'PUT') {
      kept.set(url.pathname, { bytes: body, type: request.headers['content-type'] ?? 'application/octet-stream' });
      return response.writeHead(201).end();
    }
    // The form's `file` part: its name, its kind and its bytes, between the boundaries.
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers['content-type'] ?? '');
    const marker = Buffer.from(`--${boundary?.[1] ?? boundary?.[2]}`);
    let at = body.indexOf(marker);
    while (at >= 0) {
      const next = body.indexOf(marker, at + marker.length);
      const part = body.subarray(at + marker.length, next < 0 ? body.length : next);
      const split = part.indexOf('\r\n\r\n');
      const head = part.subarray(0, split).toString('utf8');
      const name = /filename="([^"]*)"/.exec(head)?.[1];
      if (split >= 0 && /name="file"/.test(head) && name !== undefined) {
        const id = ++keptIds;
        const path = `${url.pathname}/${id}/${encodeURIComponent(name)}`;
        kept.set(path, { bytes: part.subarray(split + 4, part.length - 2), type: /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? 'application/octet-stream' });
        return response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ url: path, id }));
      }
      at = next;
    }
    response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ message: 'No file in the form' }));
  });
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/api/')) return store(request, response, url);
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    response.writeHead(404, { 'content-type': 'text/plain', ...AS_THE_HOST }).end(`Not found: ${url.pathname}`);
    return;
  }
  // The pages under /csp/ are served as a bank's or a government's site serves its own: under a strict
  // Content-Security-Policy (tools/csp-policy.mjs) — scripts and styles only with this response's nonce, no
  // 'unsafe-inline', no 'unsafe-eval', nothing from elsewhere — the nonce new for each response, written where the page
  // says __CSP_NONCE__ (e2e/csp.spec.ts).
  if (url.pathname.startsWith('/csp/') && extname(path) === '.html') {
    const nonce = randomBytes(18).toString('base64');
    const html = readFileSync(path, 'utf8').replaceAll('__CSP_NONCE__', nonce);
    response.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store', 'content-security-policy': strictPolicy(nonce), ...AS_THE_HOST });
    return response.end(html);
  }
  const type = types[extname(path)] ?? 'application/octet-stream';
  // A part of the file where the browser asks for one, as a real host answers it: Safari plays a film or a sound only
  // from a host that answers a range — and seeks to a film's frame with one.
  const size = statSync(path).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return response.writeHead(416, { 'content-range': `bytes */${size}`, ...AS_THE_HOST }).end();
    response.writeHead(206, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1, ...AS_THE_HOST });
    return createReadStream(path, { start, end }).pipe(response);
  }
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'content-length': size, ...AS_THE_HOST });
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
