import { mountChatter, type ChatterHandle } from './chatter';
import { createMemoryChatter } from './memory';
import type { Attachment, ChatterSource, RecordRef } from './source';

/**
 * A message's files on their way to the store: each in the composer with a
 * bar that fills, × to cancel it and Retry once it failed. Send waits for
 * those still going, saying so; it stops, saying why, for one that did not
 * get there. Photos are made smaller first when the chatter is told to.
 */

const me = { id: 1, name: 'Ramy Fathi' };
const order = { model: 'sale.order', id: 7 };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

/** A store the test answers by hand, beside a memory chatter. */
function handStore() {
  const base = createMemoryChatter({ me, people: [me], records: { 'sale.order:7': { messages: [] } } });
  const sent: { file: File; how?: { signal?: AbortSignal; onProgress?: (sent: number, total: number) => void }; end(): void; fail(error: unknown): void }[] = [];
  let ids = 100;
  const upload = (_record: RecordRef, file: File, how?: (typeof sent)[number]['how']) =>
    new Promise<Attachment>((resolve, reject) => {
      how?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      sent.push({ file, how, fail: reject, end: () => resolve({ id: ++ids, name: file.name, type: file.type, size: file.size, url: `https://files.example/${file.name}` }) });
    });
  return { base, sent, source: { ...base, upload } as ChatterSource };
}

let handle: ChatterHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(source: ChatterSource) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountChatter(host, { source, record: order });
  await flush();
  const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name && !b.closest('[hidden]')) as HTMLButtonElement;
  button('Send message').click();
  const choose = (...files: File[]) => {
    const input = host.querySelector('.fd-composer input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const write = (text: string) => {
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { host, button, choose, write, going: () => [...host.querySelectorAll<HTMLElement>('.fd-composer .fd-file-going')] };
}
const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

describe('a message’s files on their way', () => {
  it('shows each with a bar that fills as it goes, then as an attachment', async () => {
    const store = handStore();
    const { host, choose, going } = await mount(store.source);
    choose(pdf('Quote.pdf'));
    await flush();
    const item = going()[0];
    expect(item.querySelector('progress')?.getAttribute('aria-label')).toBe('Uploading Quote.pdf');
    store.sent[0].how?.onProgress?.(4, 8);
    expect((item.querySelector('progress') as HTMLProgressElement).value).toBe(50);
    expect(item.querySelector('.fd-file-state')?.textContent).toBe('50%');
    store.sent[0].end();
    await until(() => host.querySelector('.fd-composer .fd-attachment'));
    expect(going()).toEqual([]);
  });

  it('cancels one with ×, stopping it at the store', async () => {
    const store = handStore();
    const { choose, going } = await mount(store.source);
    choose(pdf('Wrong.pdf'));
    await flush();
    (going()[0].querySelector('.fd-file-cancel') as HTMLButtonElement).click();
    expect(store.sent[0].how?.signal?.aborted).toBe(true);
    expect(going()).toEqual([]);
  });

  it('waits to send while files are going, saying how many, and sends them all once they are in', async () => {
    const store = handStore();
    const { host, button, choose, write } = await mount(store.source);
    choose(pdf('a.pdf'), pdf('b.pdf'));
    await flush();
    write('Both quotes.');
    button('Send').click();
    await flush();
    const waiting = host.querySelector('.fd-chatter-uploading') as HTMLElement;
    expect([waiting.hidden, waiting.textContent, waiting.getAttribute('role')]).toEqual([false, '2 files still uploading. Sending when they are done.', 'status']);
    store.sent[0].end();
    await until(() => waiting.textContent?.startsWith('1 file'));
    expect(waiting.textContent).toBe('1 file still uploading. Sending when it is done.');
    expect(store.base.posted).toEqual([]);
    store.sent[1].end();
    await until(() => store.base.posted.length);
    expect(store.base.posted[0].attachments?.map((a) => a.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(waiting.hidden).toBe(true);
  });

  it('says one did not get there, offers Retry, and will not send until it is in or taken away', async () => {
    const store = handStore();
    const { host, button, choose, write, going } = await mount(store.source);
    choose(pdf('Plan.pdf'));
    await flush();
    store.sent[0].fail(new TypeError('Failed to fetch'));
    await until(() => going()[0]?.dataset['status'] === 'failed');
    expect(host.querySelector('.fd-chatter-problem')?.textContent).toBe('Plan.pdf was not uploaded');
    write('The plan.');
    button('Send').click();
    await flush();
    expect(store.base.posted).toEqual([]);
    expect(host.querySelector('.fd-chatter-problem')?.textContent).toBe('Not sent: Plan.pdf was not uploaded. Retry it, or remove it.');
    (going()[0].querySelector('.fd-file-retry') as HTMLButtonElement).click();
    store.sent[1].end();
    await until(() => host.querySelector('.fd-composer .fd-attachment'));
    button('Send').click();
    await until(() => store.base.posted.length);
    expect(store.base.posted[0].attachments?.map((a) => a.name)).toEqual(['Plan.pdf']);
  });
});
