import type { DataSource, Page } from '@fieldia/core';
import { installZonePromises } from '../../../../testing/zone-promises';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * An upload that fails — refused at once, thrown at once, or refused later over the network — leaves no promise
 * rejection unhandled: an Angular app's `NgZone.onError` (and its ErrorHandler, and its specs) sees nothing, and the
 * field says "Not uploaded" with its Retry, as it does for a refusal over the network. Every promise an upload makes is
 * handled where it is made. Promises here are kept as Angular's zone keeps them (testing/zone-promises.ts): a refusal
 * with no handler by the next microtask is said — the engine's own (Node's) is said too, and fails the test.
 */

// NexiBI's reproduction (amlak-64, FU1 evidence: repro-upload-failure-unhandled.spec.ts), its page as it was sent.
const page = {
  fieldia: '0.1',
  id: 'up',
  title: 'Up',
  data: { kind: 'responses' },
  fields: { drawing: { type: 'binary', label: 'Drawing' } },
  layout: { type: 'sections', id: 'all', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-drawing', field: 'drawing' }] }] },
} as unknown as Page;

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));

let handle: ViewerHandle | null = null;
let zone: ReturnType<typeof installZonePromises>;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => {
  zone.restore();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const said = () => zone.said.map((reason) => (reason as Error)?.message ?? String(reason));

describe('the zone’s promises, as the gate keeps them', () => {
  it('say a refusal at once that a native await adopts a microtask late', async () => {
    const refused = Promise.reject(new Error('at once'));
    await (async () => {
      try {
        await refused;
      } catch {
        // Handled, but late.
      }
    })();
    await wait(5);
    expect(said()).toEqual(['at once']);
  });

  it('say nothing of a refusal handled where it is made, or of one that comes later', async () => {
    const atOnce = Promise.reject(new Error('at once'));
    atOnce.catch(() => undefined);
    const later = new Promise((_, reject) => setTimeout(() => reject(new Error('later')), 5));
    await (async () => {
      try {
        await later;
      } catch {
        // Handled before it came.
      }
    })();
    await wait(5);
    expect(said()).toEqual([]);
  });
});

async function pickWith(upload: DataSource['upload']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  handle = mountViewer(host, { page, dataSource: { submit: async () => ({}), upload } as DataSource });
  await handle.drawn;
  for (let i = 0; i < 50 && !host.querySelector('input[type=file]'); i++) await wait(10);
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new File(['abc'], 'a.pdf', { type: 'application/pdf' })] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return host;
}
/** Long enough for any rejection left unhandled to be said: past the turns a refusal later takes. */
async function settled(host: HTMLElement) {
  for (let i = 0; i < 20 && !host.textContent?.includes('Not uploaded'); i++) await wait(5);
  for (let i = 0; i < 10; i++) await wait(5);
}

describe('an upload that fails leaves no rejection unhandled', () => {
  it.each([
    // The app's promises are the zone's, as an Angular app's are.
    ['refused at once (NexiBI’s)', () => Promise.reject(new Error('plain refusal'))],
    ['thrown at once, before any promise', () => {
      throw new Error('thrown refusal');
    }],
    ['refused later, over the network', () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('late refusal')), 20))],
  ] as [string, NonNullable<DataSource['upload']>][])('%s: the field says Not uploaded, with Retry', async (_, upload) => {
    const host = await pickWith(upload);
    await settled(host);
    expect(host.textContent).toContain('Not uploaded');
    expect([...host.querySelectorAll('button')].some((button) => /Retry/.test(button.textContent ?? ''))).toBe(true);
    expect(said()).toEqual([]);
  });
});
