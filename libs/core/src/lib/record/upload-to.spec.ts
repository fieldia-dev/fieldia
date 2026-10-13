import { saveProblemOf, uploadTo, type UploadRequest } from '../../index';

/**
 * uploadTo: an upload for a data source, for a plain endpoint — a POST of a
 * form with the file in it, or a PUT of the file itself to an address the
 * app's server signs (Azure Blob's SAS, S3's presigned URL). It tells the
 * bytes sent as they go, stops when told to, and reads the stored file's link
 * from the answer. A store that refuses the file (its size, its kind) is a
 * refusal, said as it is; anything else is a failure Retry may mend.
 */

/** XMLHttpRequest as the browser has it, as far as uploadTo uses it: each request kept, answered by the test. */
class FakeXhr {
  static made: FakeXhr[] = [];
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  withCredentials = false;
  status = 0;
  responseText = '';
  answerHeaders: Record<string, string> = {};
  aborted = false;
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.made.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  getResponseHeader(name: string) {
    return this.answerHeaders[name.toLowerCase()] ?? null;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  answer(status: number, text = '', headers: Record<string, string> = {}) {
    this.status = status;
    this.responseText = text;
    this.answerHeaders = headers;
    this.onload?.();
  }
}

const request: UploadRequest = { model: 'listing', field: 'photos', recordId: 7 };
const photo = () => new File([new Uint8Array([1, 2, 3, 4])], 'Front door.jpg', { type: 'image/jpeg' });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const host = globalThis as unknown as { XMLHttpRequest?: unknown; fetch: typeof fetch };

describe('uploadTo — through XMLHttpRequest, for its progress', () => {
  beforeEach(() => {
    FakeXhr.made = [];
    host.XMLHttpRequest = FakeXhr;
  });
  afterEach(() => delete host.XMLHttpRequest);

  it('POSTs a form with the file under `file`, the headers given, and keeps the link and id the server answers', async () => {
    const upload = uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': 'abc' } });
    const stored = upload(photo(), request);
    await tick();
    const xhr = FakeXhr.made[0];
    expect([xhr.method, xhr.url, xhr.headers]).toEqual(['POST', '/api/files', { 'X-CSRF-Token': 'abc' }]);
    const form = xhr.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const sent = form.get('file') as File;
    expect([sent.name, sent.size, sent.type]).toEqual(['Front door.jpg', 4, 'image/jpeg']);
    xhr.answer(201, JSON.stringify({ url: 'https://files.example/a1/Front%20door.jpg', id: 31 }), { 'content-type': 'application/json' });
    await expect(stored).resolves.toEqual({ url: 'https://files.example/a1/Front%20door.jpg', name: 'Front door.jpg', size: 4, type: 'image/jpeg', fileId: 31 });
  });

  it('takes the field’s name for the form, and cookies to another origin when asked', async () => {
    const stored = uploadTo({ url: 'https://files.example/upload', field: 'attachment', withCredentials: true })(photo(), request);
    await tick();
    const xhr = FakeXhr.made[0];
    expect((xhr.body as FormData).get('attachment')).toBeInstanceOf(File);
    expect(xhr.withCredentials).toBe(true);
    xhr.answer(200, '', { location: '/files/9' });
    // No JSON: the answer's Location, read against where it was sent.
    await expect(stored).resolves.toMatchObject({ url: 'https://files.example/files/9' });
  });

  it('tells the bytes sent as they go', async () => {
    const seen: [number, number][] = [];
    const stored = uploadTo({ url: '/api/files' })(photo(), { ...request, onProgress: (sent, total) => seen.push([sent, total]) });
    await tick();
    const xhr = FakeXhr.made[0];
    xhr.upload.onprogress?.({ loaded: 2, total: 4, lengthComputable: true });
    xhr.upload.onprogress?.({ loaded: 4, total: 4, lengthComputable: true });
    xhr.answer(200, '{"url":"/files/1.jpg"}');
    await stored;
    expect(seen).toEqual([[2, 4], [4, 4]]);
  });

  it('PUTs the file itself to an address the app’s server signs — Azure Blob with a SAS — keeping its address without the signature', async () => {
    const signed = 'https://acme.blob.core.windows.net/listings/7/Front%20door.jpg?sv=2024-11-04&se=2026-10-13T12%3A00Z&sp=cw&sig=abc';
    const asked: [string, unknown][] = [];
    const upload = uploadTo({
      method: 'PUT',
      url: async (file, req) => (asked.push([file.name, req.recordId]), { url: signed, headers: { 'x-ms-blob-type': 'BlockBlob' } }),
    });
    const stored = upload(photo(), request);
    await tick();
    await tick();
    const xhr = FakeXhr.made[0];
    expect([xhr.method, xhr.url]).toEqual(['PUT', signed]);
    expect(xhr.headers).toEqual({ 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'image/jpeg' });
    expect(xhr.body).toBeInstanceOf(Blob);
    xhr.answer(201);
    await expect(stored).resolves.toEqual({ url: 'https://acme.blob.core.windows.net/listings/7/Front%20door.jpg', name: 'Front door.jpg', size: 4, type: 'image/jpeg' });
    expect(asked).toEqual([['Front door.jpg', 7]]);
  });

  it('reads the link its own way when told how', async () => {
    const stored = uploadTo({ url: '/api/files', link: (answer) => ({ url: `/files/${(answer.json as { key: string }).key}`, fileId: answer.status }) })(photo(), request);
    await tick();
    FakeXhr.made[0].answer(200, '{"key":"k-9"}');
    await expect(stored).resolves.toMatchObject({ url: '/files/k-9', fileId: 200 });
  });

  it('stops when told to, with an AbortError the field drops the file for', async () => {
    const stop = new AbortController();
    const stored = uploadTo({ url: '/api/files' })(photo(), { ...request, signal: stop.signal });
    await tick();
    stop.abort();
    expect(FakeXhr.made[0].aborted).toBe(true);
    await expect(stored).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fails, for Retry, when the network or the server fails; refuses, said as the server says, what it will not keep', async () => {
    const upload = uploadTo({ url: '/api/files' });
    const lost = upload(photo(), request);
    await tick();
    FakeXhr.made[0].onerror?.();
    await expect(lost.catch(saveProblemOf)).resolves.toMatchObject({ kind: 'network' });

    const broken = upload(photo(), request);
    await tick();
    FakeXhr.made[1].answer(503, 'Service Unavailable');
    await expect(broken.catch(saveProblemOf)).resolves.toMatchObject({ kind: 'other' });

    const large = upload(photo(), request);
    await tick();
    FakeXhr.made[2].answer(413, JSON.stringify({ message: 'Files up to 20 MB only' }));
    await expect(large.catch(saveProblemOf)).resolves.toEqual({ kind: 'rule', message: 'Files up to 20 MB only' });

    const kind = upload(photo(), request);
    await tick();
    FakeXhr.made[3].answer(415, '');
    await expect(kind.catch(saveProblemOf)).resolves.toEqual({ kind: 'rule', message: 'The store did not take Front door.jpg (415)' });

    // A POST whose answer names no address for the file is the app's to mend: said, not guessed.
    const unnamed = upload(photo(), request);
    await tick();
    FakeXhr.made[4].answer(200, '{"ok":true}');
    await expect(unnamed).rejects.toThrow(/named no address/);
  });
});

describe('uploadTo — through fetch, where there is no XMLHttpRequest', () => {
  const real = host.fetch;
  afterEach(() => (host.fetch = real));

  it('sends the same, with no progress to tell', async () => {
    const calls: [string, RequestInit][] = [];
    host.fetch = (async (url: string, init: RequestInit) => (calls.push([url, init]), new Response('{"url":"/files/5.jpg","fileId":5}', { status: 201, headers: { 'content-type': 'application/json' } }))) as typeof fetch;
    const stop = new AbortController();
    const stored = await uploadTo({ url: '/api/files', headers: { Authorization: 'Bearer t' } })(photo(), { ...request, signal: stop.signal });
    expect(stored).toEqual({ url: '/files/5.jpg', name: 'Front door.jpg', size: 4, type: 'image/jpeg', fileId: 5 });
    expect(calls[0][0]).toBe('/api/files');
    expect(calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer t' }, signal: stop.signal });
    expect((calls[0][1].body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('sends a file held as bytes alone, as a store’s save of a signature gives it', async () => {
    const bodies: unknown[] = [];
    host.fetch = (async (_url: string, init: RequestInit) => (bodies.push(init.body), new Response('', { status: 201 }))) as typeof fetch;
    const bytes = { name: 'signature.png', size: 3, type: 'image/png', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    await uploadTo({ method: 'PUT', url: 'https://acme.blob.core.windows.net/s/signature.png?sig=x' })(bytes, request);
    expect(bodies[0]).toBeInstanceOf(Blob);
    expect((bodies[0] as Blob).size).toBe(3);
  });
});
