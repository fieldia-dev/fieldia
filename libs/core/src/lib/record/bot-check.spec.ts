import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/** A public sign-up: a name and an email, with a bot check as the test gives it. */
const signup = (botCheck?: Page['botCheck'], more: Partial<Page> = {}): Page => ({
  fieldia: '0.3',
  id: 'signup',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email', widget: 'email' },
      { type: 'slot', id: 's-captcha', name: 'captcha' },
    ],
  },
  ...(botCheck ? { botCheck } : {}),
  ...more,
});

/** A clock the test moves: seconds from the start. */
function clockAt(start = 0) {
  let now = start;
  return { now: () => new Date(Date.UTC(2026, 9, 16) + now * 1000), move: (seconds: number) => (now += seconds) };
}

describe('a public page’s bot check', () => {
  it('sends nothing more without one, as 0.23 did', async () => {
    const ds = createMemoryDataSource();
    const sent: unknown[] = [];
    const form = createForm({ page: signup(), dataSource: ds });
    form.on('send', (event) => sent.push(event));
    form.setValue('name', 'Sara');
    expect(await form.save()).toBe(true);
    expect(ds.responses).toEqual([{ pageId: 'signup', values: { name: 'Sara', email: null } }]);
    expect(sent).toEqual([{ values: { name: 'Sara', email: null } }]);
  });

  it('tells a send made by a person: the box untouched, slower than the least, with the time it took', async () => {
    const ds = createMemoryDataSource();
    const clock = clockAt();
    const form = createForm({ page: signup({}), dataSource: ds, now: clock.now });
    form.setValue('name', 'Sara');
    clock.move(12.34);
    expect(await form.save()).toBe(true);
    expect(ds.responses[0]).toEqual({ pageId: 'signup', values: { name: 'Sara', email: null }, bot: { honeypot: false, tooFast: false, seconds: 12.3 } });
  });

  it('tells a send sooner than the least as too fast, and never refuses it: the app decides', async () => {
    const ds = createMemoryDataSource();
    const clock = clockAt();
    const form = createForm({ page: signup({ minSeconds: 5 }), dataSource: ds, now: clock.now });
    const told: unknown[] = [];
    form.on('send', ({ bot }) => told.push(bot));
    form.setValue('name', 'Bot');
    clock.move(4.95);
    expect(await form.save()).toBe(true);
    expect(ds.responses[0].bot).toEqual({ honeypot: false, tooFast: true, seconds: 5 });
    expect(told).toEqual([{ honeypot: false, tooFast: true, seconds: 5 }]);
  });

  it('takes three seconds as the least unless the page says, and none at 0', async () => {
    const clock = clockAt();
    const ds = createMemoryDataSource();
    const three = createForm({ page: signup({}), dataSource: ds, now: clock.now });
    clock.move(2.9);
    await three.save();
    expect(ds.responses[0].bot?.tooFast).toBe(true);
    const none = createForm({ page: signup({ minSeconds: 0 }), dataSource: ds, now: clock.now });
    await none.save();
    expect(ds.responses[1].bot).toEqual({ honeypot: false, tooFast: false, seconds: 0 });
  });

  it('tells the hidden box filled, and not on a page that turned it off', async () => {
    const clock = clockAt();
    const ds = createMemoryDataSource();
    const form = createForm({ page: signup({}), dataSource: ds, now: clock.now });
    form.botCheck({ honeypot: true });
    clock.move(10);
    await form.save();
    expect(ds.responses[0].bot).toMatchObject({ honeypot: true, tooFast: false });
    const off = createForm({ page: signup({ honeypot: false }), dataSource: ds, now: clock.now });
    off.botCheck({ honeypot: true });
    await off.save();
    expect(ds.responses[1].bot?.honeypot).toBe(false);
  });

  it('carries the captcha’s token with the answers, null when none came, and spends it once sent', async () => {
    const clock = clockAt();
    const ds = createMemoryDataSource();
    const form = createForm({ page: signup({ captcha: 'captcha' }), dataSource: ds, now: clock.now });
    clock.move(8);
    await form.save();
    expect(ds.responses[0].bot).toEqual({ honeypot: false, tooFast: false, seconds: 8, captcha: null });
    form.botCheck({ captcha: 'XXXX.token' });
    await form.save();
    expect(ds.responses[1].bot?.captcha).toBe('XXXX.token');
    await form.save();
    expect(ds.responses[2].bot?.captcha).toBeNull();
  });

  it('keeps the token when the send failed, for the next try', async () => {
    const ds = createMemoryDataSource();
    let fail = true;
    const submit = ds.submit.bind(ds);
    ds.submit = async (request) => {
      if (fail) throw new Error('offline');
      return submit(request);
    };
    const form = createForm({ page: signup({ captcha: 'captcha' }), dataSource: ds });
    form.botCheck({ captcha: 'T1' });
    expect(await form.save()).toBe(false);
    fail = false;
    expect(await form.save()).toBe(true);
    expect(ds.responses[0].bot?.captcha).toBe('T1');
  });

  it('times a response started again from then, the hidden box read afresh', async () => {
    const clock = clockAt();
    const ds = createMemoryDataSource();
    const form = createForm({ page: signup({ minSeconds: 5 }), dataSource: ds, now: clock.now });
    form.botCheck({ honeypot: true });
    clock.move(60);
    await form.save();
    form.reset();
    clock.move(2);
    await form.save();
    expect(ds.responses.map((r) => r.bot)).toEqual([
      { honeypot: true, tooFast: false, seconds: 60 },
      { honeypot: false, tooFast: true, seconds: 2 },
    ]);
  });
});

describe('the page’s checks of a bot check', () => {
  it('passes a public page with its captcha’s slot placed', () => {
    expect(validatePage(signup({ honeypot: true, minSeconds: 4, captcha: 'captcha' })).ok).toBe(true);
    expect(checkPage(signup({ captcha: 'captcha' })).ok).toBe(true);
  });

  it('refuses one on a record’s page, and a captcha with no slot to draw in', () => {
    const record = { ...signup({}), data: { kind: 'record' as const, model: 'res.partner' } };
    for (const check of [validatePage, checkPage]) {
      expect(check(record)).toEqual({ ok: false, issues: [{ path: 'botCheck', message: expect.stringContaining('a bot check is for a page of responses') }] });
      expect(check(signup({ captcha: 'turnstile' }))).toEqual({
        ok: false,
        issues: [{ path: 'botCheck.captcha', message: 'no slot "turnstile" on this page to draw the captcha in: place { "type": "slot", "id": "turnstile", "name": "turnstile" } where it goes' }],
      });
    }
  });

  it('refuses a shape it does not know', () => {
    const issues = (given: unknown) => {
      const checked = validatePage({ ...signup(), botCheck: given });
      return checked.ok ? [] : checked.issues.map((issue) => issue.path);
    };
    expect(issues({ minSeconds: -1 })).toEqual(['botCheck.minSeconds']);
    expect(issues({ captcha: '' })).toEqual(['botCheck.captcha']);
    expect(issues({ honeypot: 'yes' })).toEqual(['botCheck.honeypot']);
    expect(issues({ recaptcha: true })).toEqual(['botCheck']);
  });
});
