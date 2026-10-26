import { createMemoryDataSource, type Page } from '@fieldia/core';
import { actionSource } from './element-form';
import { defineFieldiaForm, elementPart, type FieldiaFormElement } from './element';
import { CAMPAIGN_PARAMS, embedFrame } from './embed-frame';

/**
 * `<fieldia-form>` and the self-resizing iframe embed: the element draws its page — given, or fetched from `src` — with
 * its attributes' language and look, tells what happens as events that bubble, draws again as its attributes change and
 * lets its form go off the page; an `action` takes the answers as JSON; fieldia-embed.js places an iframe of the app's
 * form page with what it passes on, and grows it as the form tells its height.
 */

const callBack: Page = {
  fieldia: '0.13',
  id: 'call-back',
  title: 'Ask for a call back',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
};

/** A server's answer, as far as the element reads one. */
const answered = (body: string, status = 200, statusText = 'OK') => ({ ok: status >= 200 && status < 300, status, statusText, text: async () => body, json: async () => JSON.parse(body) });

const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
};

beforeAll(async () => {
  defineFieldiaForm();
  await elementPart.load();
});
afterEach(() => document.body.replaceChildren());

function place(attributes: Record<string, string> = {}, set?: (element: FieldiaFormElement) => void) {
  const element = document.createElement('fieldia-form') as FieldiaFormElement;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  set?.(element);
  const heard: { type: string; detail: unknown }[] = [];
  for (const type of ['ready', 'send', 'error']) document.addEventListener(`fieldia-${type}`, (event) => heard.push({ type, detail: (event as CustomEvent).detail }));
  document.body.append(element);
  return { element, heard };
}

describe('<fieldia-form>', () => {
  it('draws a page given whole, in its language, and tells what happens as events that bubble', async () => {
    const memory = createMemoryDataSource({ submitted: () => ({ id: 'C-7' }) });
    const { element, heard } = place({ locale: 'ar' }, (one) => {
      one.page = callBack;
      one.source = memory;
    });
    await settled();
    expect(element.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
    expect(heard.map((one) => one.type)).toContain('ready');
    element.handle?.form.setValue('name', 'Mona');
    expect(await element.handle?.save()).toBe(true);
    expect(heard.find((one) => one.type === 'send')?.detail).toEqual({ id: 'C-7', values: { name: 'Mona' } });
    // Off the page, its form is let go; back on, drawn again.
    element.remove();
    expect(element.handle).toBeNull();
    document.body.append(element);
    await settled();
    expect(element.querySelector('.fd-form')).not.toBeNull();
  });

  it('fetches its page from src, draws again as an attribute changes, and says a page it cannot read', async () => {
    const fetched: string[] = [];
    const before = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      fetched.push(String(url));
      return Promise.resolve(String(url).endsWith('missing.json') ? answered('no', 404, 'Not Found') : answered(JSON.stringify(callBack)));
    }) as unknown as typeof fetch;
    try {
      const { element, heard } = place({ src: 'call-back.page.json', theme: 'material' }, (one) => (one.source = createMemoryDataSource()));
      await settled();
      expect(fetched).toEqual(['http://localhost/call-back.page.json']);
      expect(element.querySelector('.fd-form')?.getAttribute('data-fd-theme')).toBe('material');
      element.setAttribute('src', 'missing.json');
      await settled();
      expect(element.querySelector('.fd-element-broken')?.textContent).toBe('This form could not be loaded.');
      expect(heard.find((one) => one.type === 'error')?.detail).toEqual({ message: 'missing.json: 404 Not Found' });
    } finally {
      globalThis.fetch = before;
    }
  });

  it('sends its answers to its action as JSON, and says a refusal as the server words it', async () => {
    const posted: { url: string; body: unknown }[] = [];
    let answer = answered(JSON.stringify({ id: 'E-12' }), 201, 'Created');
    const fetcher = ((url: string, init: RequestInit) => {
      posted.push({ url, body: JSON.parse(String(init.body)) });
      return Promise.resolve(answer);
    }) as unknown as typeof fetch;
    const source = actionSource('https://homes.example/api/enquiries', fetcher);
    expect(await source.submit?.({ pageId: 'call-back', values: { name: 'Mona' } })).toEqual({ id: 'E-12' });
    expect(posted[0]).toEqual({ url: 'https://homes.example/api/enquiries', body: { pageId: 'call-back', values: { name: 'Mona' } } });
    answer = answered(JSON.stringify({ message: 'Check your name', fields: { name: 'Too short' } }), 422, 'Unprocessable Content');
    await expect(source.submit?.({ pageId: 'call-back', values: {} })).rejects.toMatchObject({ problem: { kind: 'fields', message: 'Check your name', fields: { name: 'Too short' } } });
    answer = answered('', 503, 'Service Unavailable');
    await expect(source.submit?.({ pageId: 'call-back', values: {} })).rejects.toMatchObject({ problem: { kind: 'other', message: '503 Service Unavailable' } });
  });
});

describe('<fieldia-form> whose part cannot come', () => {
  it('says in its place that its form could not be loaded — never an empty box — and tells fieldia-error; with one script tag, Retry draws it once it can come', async () => {
    await jest.isolateModulesAsync(async () => {
      const offline = { now: true };
      jest.doMock('./element-part', () => {
        if (offline.now) throw new Error('offline');
        return jest.requireActual('./element-part');
      });
      const { defineFieldiaForm: define } = await import('./element');
      define('fieldia-form-offline');
      const element = document.createElement('fieldia-form-offline') as FieldiaFormElement;
      element.page = callBack;
      element.source = createMemoryDataSource();
      const heard: unknown[] = [];
      element.addEventListener('fieldia-error', (event) => heard.push((event as CustomEvent).detail));
      document.body.append(element);
      await settled();
      const said = element.querySelector('.fd-element-broken') as HTMLElement;
      expect(said.textContent).toBe('This form could not be loaded.');
      expect(said.getAttribute('role')).toBe('alert');
      // An app's modules, kept failed by the browser for the page's life: no Retry that could not bring it.
      expect(said.querySelector('button')).toBeNull();
      expect(heard).toEqual([{ message: expect.any(String) }]);
      element.remove();
      // With one script tag, asked anew: Retry, the part come by then, draws the form in its place.
      (await import('@fieldia/core')).partsComeByScriptTag();
      document.body.append(element);
      await settled();
      const retry = element.querySelector('.fd-element-broken button') as HTMLButtonElement;
      expect(retry.textContent).toBe('Retry');
      offline.now = false;
      retry.click();
      for (let i = 0; i < 20 && !element.querySelector('.fd-form'); i++) await settled();
      expect(element.querySelector('.fd-form [data-node="f-name"]')).not.toBeNull();
      expect(element.querySelector('.fd-element-broken')).toBeNull();
      jest.dontMock('./element-part');
    });
  });
});

describe('fieldia-embed.js', () => {
  it('places an iframe of the form page with what the tag and the link pass on, and grows it as the form tells', () => {
    window.history.replaceState(null, '', '/listing?utm_source=newsletter&agent=mona&token=secret');
    const script = document.createElement('script');
    script.dataset['src'] = 'https://forms.example/enquiry?page=unit';
    script.dataset['locale'] = 'ar';
    script.dataset['title'] = 'Ask about this unit';
    document.body.append(script);
    const frame = embedFrame(script) as HTMLIFrameElement;
    script.after(frame);
    const at = new URL(frame.src);
    expect(at.origin).toBe('https://forms.example');
    expect(Object.fromEntries(at.searchParams)).toEqual({ page: 'unit', 'fieldia-frame': expect.any(String), 'fieldia-origin': 'http://localhost', locale: 'ar', utm_source: 'newsletter' });
    expect(CAMPAIGN_PARAMS).toContain('utm_campaign');
    expect(frame.title).toBe('Ask about this unit');
    expect(frame.style.height).toBe('600px');
    const id = at.searchParams.get('fieldia-frame');
    const sent: unknown[] = [];
    frame.addEventListener('fieldia-send', (event) => sent.push((event as CustomEvent).detail));
    const tell = (data: unknown, origin = 'https://forms.example', source: unknown = frame.contentWindow) => window.dispatchEvent(new MessageEvent('message', { data, origin, source: source as Window }));
    tell({ fieldia: 'height', frame: id, height: 812.4 });
    expect(frame.style.height).toBe('813px');
    // Another origin, another frame, another window: not heard.
    tell({ fieldia: 'height', frame: id, height: 90 }, 'https://evil.example');
    tell({ fieldia: 'height', frame: 'other', height: 90 });
    tell({ fieldia: 'height', frame: id, height: 90 }, 'https://forms.example', window);
    expect(frame.style.height).toBe('813px');
    tell({ fieldia: 'send', frame: id, id: 'R-1201' });
    expect(sent).toEqual([{ id: 'R-1201' }]);
    // The tag naming the parameters it passes on: those, and no others.
    const named = document.createElement('script');
    named.dataset['src'] = '/form.html';
    named.dataset['params'] = 'agent token';
    const second = new URL((embedFrame(named) as HTMLIFrameElement).src);
    expect(second.searchParams.get('agent')).toBe('mona');
    expect(second.searchParams.get('token')).toBe('secret');
    expect(second.searchParams.has('utm_source')).toBe(false);
    window.history.replaceState(null, '', '/');
  });
});
