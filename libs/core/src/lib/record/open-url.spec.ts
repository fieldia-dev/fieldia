import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import type { Page } from '../format/page';
import { createForm } from './form';
import { MESSAGES } from './messages';
import { orderPage, recordingHost } from './test-steps';

/** The audit's supplier page: a website field, and a button that opens it in this tab (S-H2, R-H2). */
const supplier = (url = 'website'): Page => ({
  fieldia: '0.11',
  id: 'supplier',
  title: 'Supplier',
  data: { kind: 'record', model: 'res.partner' },
  fields: { name: { type: 'char', label: 'Name' }, website: { type: 'char', label: 'Website' } },
  layout: {
    type: 'sheet',
    id: 'root',
    children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'w', field: 'website', widget: 'url' }, { type: 'button', id: 'b', label: 'Open website', steps: [{ do: 'openUrl', url, newTab: false }] }] }],
  },
});

describe('an openUrl step opens a web, mail or phone address, or a path of this site — never a script', () => {
  it('refuses a value that would run, whoever typed it, and says so; the host is never asked (the audit’s proof)', async () => {
    for (const website of ['javascript:alert(document.cookie)', 'java\tscript:alert(1)', '\x01javascript:alert(document.domain)', 'JaVa\rScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)']) {
      const host = recordingHost();
      const form = createForm({ page: supplier(), values: { name: 'Acme', website }, host });
      expect(await form.run([{ do: 'openUrl', url: 'website', newTab: false }])).toMatchObject({ done: false, reason: 'cannot', message: MESSAGES.en.addressRefused });
      expect(host.calls.filter(([what]) => what === 'openUrl')).toEqual([]);
    }
  });

  it('refuses an address put together from words that read as a script only once joined: checked whole as it runs', async () => {
    const host = recordingHost();
    const form = createForm({ page: supplier("'java' + 'script:alert(1)'"), values: {}, host });
    expect(await form.run([{ do: 'openUrl', url: "'java' + 'script:alert(1)'" }])).toMatchObject({ reason: 'cannot', message: MESSAGES.en.addressRefused });
    expect(host.calls).toEqual([]);
  });

  it('says why in the page’s language', async () => {
    const form = createForm({ page: supplier(), values: { website: 'javascript:alert(1)' }, host: recordingHost(), messages: MESSAGES.ar });
    expect(await form.run([{ do: 'openUrl', url: 'website' }])).toMatchObject({ reason: 'cannot', message: MESSAGES.ar.addressRefused });
  });

  it('opens a web, mail or phone address and a path of this site, as before', async () => {
    const host = recordingHost();
    for (const website of ['https://acme.example/about', 'mailto:sales@acme.example', 'tel:+201001234567', '/suppliers/7']) {
      const form = createForm({ page: supplier(), values: { website }, host });
      expect((await form.run([{ do: 'openUrl', url: 'website' }])).done).toBe(true);
    }
    expect(host.calls.map(([, url]) => url)).toEqual(['https://acme.example/about', 'mailto:sales@acme.example', 'tel:+201001234567', '/suppliers/7']);
  });

  it('checkPage and validatePage refuse an address the page writes that is none (an AI-written page), and keep the rest', () => {
    for (const url of ["'javascript:alert(document.domain)'", "'JavaScript:' + name", "'java\tscript:alert(1)'", "'data:text/html,<b>x</b>'", "' vbscript:x'", '"\x01javascript:alert(1)"']) {
      for (const check of [checkPage, validatePage]) {
        const result = check(supplier(url));
        expect(result.ok).toBe(false);
        expect(!result.ok && result.issues.map((issue) => issue.path)).toEqual(['layout.children[0].children[2].steps[0].url']);
      }
    }
    for (const url of ['website', "'https://acme.example/' + name", "'/suppliers/' + name", "'mailto:' + website", "'tel:+20100'", "'orders/' + name", "'?page=2'"]) {
      expect(checkPage(supplier(url)).ok).toBe(true);
      expect(validatePage(supplier(url)).ok).toBe(true);
    }
  });

  it('refuses the reliability audit’s literal in a real page, which its own portal link passes (R-H2 proofs)', () => {
    const raw = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages', 'real-invoice.page.json'), 'utf8');
    expect(validatePage(JSON.parse(raw)).ok).toBe(true);
    const page = JSON.parse(raw.replace(`"'/my/invoices/' + id"`, `"'javascript:alert(document.domain)'"`));
    expect(validatePage(page).ok).toBe(false);
    const go = (url: string) => orderPage({ buttons: [{ type: 'button', id: 'go', label: 'Go', steps: [{ do: 'openUrl', url, newTab: false }] }] });
    expect(validatePage(go("'/my/orders/' + name")).ok).toBe(true);
    // The order page is checked as it is made: it is refused there.
    expect(() => go("'javascript:alert(1)'")).toThrow(/an address a page opens is a web, mail or phone address/);
  });
});
