/**
 * A static file server for the built demos, so the browser gates need nothing
 * installed beyond Node. usage: node tools/serve.mjs <dir> <port>
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

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
};

/**
 * A store for the browser tests of files sent to a real endpoint (uploadTo), so the browser's own network — slowed as
 * a phone's is — carries them: a POST to /api/… of a form keeps its `file` part, a PUT keeps its body, each in memory;
 * the answer gives its address (and, for a POST, its id), and a GET of that address gives it back. A static host has
 * none of this: the demos' own store is the memory source.
 */
const kept = new Map();
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
    response.writeHead(404, { 'content-type': 'text/plain' }).end(`Not found: ${url.pathname}`);
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
