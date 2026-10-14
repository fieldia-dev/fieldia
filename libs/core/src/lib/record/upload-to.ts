import { saveRefused, type UploadedFile, type UploadFile, type UploadRequest } from './data-source';

/**
 * A data source's `upload` for a plain endpoint, written once: a POST of a
 * form with the file in it, or a PUT of the file itself to an address the
 * app's server signs for it (Azure Blob's SAS, S3's presigned URL). Through
 * XMLHttpRequest in a browser, so its progress is told; through fetch where
 * there is none. Core names no DOM types: the few it uses are read from the
 * host, as far as this file needs them.
 *
 *   upload: uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': token } })
 */

/** Where one file goes, with headers of its own beside the options': a signed address's. */
export interface UploadTarget {
  url: string;
  headers?: Record<string, string>;
}

/** The server's answer, for `link` to read the stored file's address from. */
export interface UploadAnswer {
  status: number;
  /** The address the file was sent to. */
  url: string;
  /** The answer's body, as text. */
  text: string;
  /** The body read as JSON, or undefined when it is not JSON. */
  json: unknown;
  header(name: string): string | null;
}

type Maybe<T> = T | Promise<T>;

export interface UploadToOptions {
  /** Where each file goes: an address, or a function of the file and the request giving one — an address your server signs, say. */
  url: string | ((file: UploadFile, request: UploadRequest) => Maybe<string | UploadTarget>);
  /** POST, the usual, sends a form with the file under `field`; PUT sends the file itself as the body, as a signed address takes it. */
  method?: 'POST' | 'PUT';
  /** The form's field the file goes under, with POST: `file` unless said. */
  field?: string;
  /** Headers for every file: a token, say. Content-Type is the file's own with PUT, and the form's with POST. */
  headers?: Record<string, string> | ((file: UploadFile, request: UploadRequest) => Maybe<Record<string, string>>);
  /** Send the browser's cookies to another origin too. */
  withCredentials?: boolean;
  /**
   * The stored file's address and id, from the answer. Without it: the JSON's
   * `url` (or `location`) and its `fileId` (or `id`), else the Location
   * header, else — for a PUT — the address it was put to, without its query
   * (a signature is not a link to keep).
   */
  link?: (answer: UploadAnswer, file: UploadFile) => Maybe<Partial<UploadedFile>>;
}

/** The statuses that say the store will not keep this file, whatever is tried: its size, its kind, what it holds. */
const REFUSALS = new Set([400, 409, 413, 415, 422]);

interface XhrLike {
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  getResponseHeader(name: string): string | null;
  send(body: unknown): void;
  abort(): void;
  withCredentials: boolean;
  status: number;
  responseText: string;
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}
interface BlobLike {
  readonly size: number;
}
interface Host {
  XMLHttpRequest?: new () => XhrLike;
  fetch?: (url: string, init: Record<string, unknown>) => Promise<{ status: number; text(): Promise<string>; headers: { get(name: string): string | null } }>;
  Blob: new (parts: unknown[], options?: { type?: string }) => BlobLike;
  FormData: new () => { append(name: string, value: unknown, filename?: string): void };
  URL: new (url: string, base?: string) => { href: string };
  location?: { href: string };
}

const stopped = () => Object.assign(new Error('The upload was stopped'), { name: 'AbortError' });

/** An upload to a plain endpoint, for a data source: `{ ...source, upload: uploadTo({ url: '/api/files' }) }`. */
export function uploadTo(options: UploadToOptions): (file: UploadFile, request: UploadRequest) => Promise<UploadedFile> {
  const method = options.method ?? 'POST';
  return async (file, request) => {
    if (request.signal?.aborted) throw stopped();
    const host = globalThis as unknown as Host;
    const given = typeof options.url === 'function' ? await options.url(file, request) : options.url;
    const target: UploadTarget = typeof given === 'string' ? { url: given } : given;
    const own = typeof options.headers === 'function' ? await options.headers(file, request) : (options.headers ?? {});
    const headers: Record<string, string> = { ...own, ...target.headers };
    // A file the browser picked is a Blob already; one held as bytes is made one.
    const blob = file instanceof host.Blob ? file : new host.Blob([await file.arrayBuffer()], { type: file.type });
    let body: unknown = blob;
    if (method === 'PUT') {
      if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) headers['Content-Type'] = file.type || 'application/octet-stream';
    } else {
      const form = new host.FormData();
      form.append(options.field ?? 'file', blob, file.name);
      body = form;
    }
    const answer = await (host.XMLHttpRequest ? viaXhr : viaFetch)(host, { method, url: target.url, headers, body, file, request, withCredentials: options.withCredentials === true });
    if (answer.status < 200 || answer.status >= 300) {
      const said = wordsOf(answer);
      if (REFUSALS.has(answer.status)) throw saveRefused({ kind: 'rule', message: said || `The store did not take ${file.name} (${answer.status})` });
      throw new Error(said ? `${said} (${answer.status})` : `The store answered ${answer.status}`);
    }
    const linked = options.link ? await options.link(answer, file) : linkOf(answer, method, host);
    if (!linked.url) throw new Error(`The store's answer named no address for ${file.name}: give uploadTo a link() that reads it`);
    return { url: linked.url, name: linked.name ?? file.name, size: linked.size ?? file.size, type: linked.type ?? file.type, ...(linked.fileId !== undefined ? { fileId: linked.fileId } : {}) };
  };
}

interface Sending {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  file: UploadFile;
  request: UploadRequest;
  withCredentials: boolean;
}

function viaXhr(host: Host, sending: Sending): Promise<UploadAnswer> {
  const { request } = sending;
  return new Promise((resolve, reject) => {
    const xhr = new (host.XMLHttpRequest as NonNullable<Host['XMLHttpRequest']>)();
    const stop = () => xhr.abort();
    const done = () => request.signal?.removeEventListener('abort', stop);
    xhr.open(sending.method, sending.url);
    for (const [name, value] of Object.entries(sending.headers)) xhr.setRequestHeader(name, value);
    if (sending.withCredentials) xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => request.onProgress?.(event.loaded, event.lengthComputable ? event.total : sending.file.size);
    xhr.onload = () => (done(), resolve(answered(sending.url, xhr.status, xhr.responseText, (name) => xhr.getResponseHeader(name))));
    // What fetch throws when the network fails: read as the network's problem.
    xhr.onerror = () => (done(), reject(new TypeError('Failed to fetch: the network failed during the upload')));
    xhr.onabort = () => (done(), reject(stopped()));
    request.signal?.addEventListener('abort', stop);
    xhr.send(sending.body);
  });
}

async function viaFetch(host: Host, sending: Sending): Promise<UploadAnswer> {
  if (!host.fetch) throw new Error('uploadTo needs XMLHttpRequest or fetch');
  const response = await host.fetch(sending.url, {
    method: sending.method,
    headers: sending.headers,
    body: sending.body,
    ...(sending.request.signal ? { signal: sending.request.signal } : {}),
    ...(sending.withCredentials ? { credentials: 'include' } : {}),
  });
  const text = await response.text();
  // No progress on the way: the whole of it, once it is there.
  sending.request.onProgress?.(sending.file.size, sending.file.size);
  return answered(sending.url, response.status, text, (name) => response.headers.get(name));
}

function answered(url: string, status: number, text: string, header: (name: string) => string | null): UploadAnswer {
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status, url, text, json, header };
}

/** What a refusing server says, for the person: its JSON's message, or a short text. */
function wordsOf(answer: UploadAnswer): string {
  const json = answer.json as { message?: unknown; error?: unknown } | undefined;
  const said = json?.message ?? (typeof json?.error === 'object' ? (json.error as { message?: unknown } | null)?.message : json?.error);
  if (typeof said === 'string' && said.trim()) return said.trim();
  const text = answer.text.trim();
  return text && text.length <= 200 && !/^\s*</.test(text) && answer.json === undefined ? text : '';
}

/** The stored file's address as the answer gives it: JSON, Location, or where a PUT put it. */
function linkOf(answer: UploadAnswer, method: string, host: Host): Partial<UploadedFile> {
  const json = (answer.json && typeof answer.json === 'object' ? answer.json : {}) as Record<string, unknown>;
  const id = json['fileId'] ?? json['id'];
  const fileId = typeof id === 'string' || typeof id === 'number' ? id : undefined;
  const said = json['url'] ?? json['location'];
  const location = answer.header('location');
  const url = typeof said === 'string' ? said : location ? against(location, answer.url, host) : method === 'PUT' ? answer.url.split('?')[0] : undefined;
  return { ...(url ? { url } : {}), ...(fileId !== undefined ? { fileId } : {}) };
}

/** A Location read against the address the file was sent to. */
function against(location: string, sentTo: string, host: Host): string {
  try {
    return new host.URL(location, new host.URL(sentTo, host.location?.href).href).href;
  } catch {
    return location;
  }
}
