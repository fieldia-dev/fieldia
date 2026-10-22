/**
 * @jest-environment node
 */
import type { Page } from '@fieldia/core';
import { firstPaint, firstPaintStyles } from './server';

/**
 * A form's first paint on a server — in Node, no DOM: its title, sections and fields with their labels and values, in
 * Fieldia's classes and its own stylesheet, the page's own rules run (what is hidden, required, worked out), and no
 * style attribute, so a strict Content-Security-Policy needs only its nonce.
 */

const page: Page = {
  fieldia: '0.7',
  id: 'enquiry',
  title: 'Property enquiry',
  description: 'Tell us <what> you need',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: {
    name: { type: 'char', label: 'Client', required: true },
    kind: { type: 'selection', label: 'Looking for', options: [{ value: 'villa', label: 'Villa' }, { value: 'office', label: 'Office' }] },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
    rooms: { type: 'integer', label: 'Rooms', compute: 'bedrooms + 2' },
    garden: { type: 'boolean', label: 'Needs a garden' },
    notes: { type: 'text', label: 'Notes', help: 'Anything else' },
    terms: { type: 'html', label: 'Terms' },
    agent: { type: 'many2one', label: 'Agent', relation: 'res.users' },
  },
  layout: {
    type: 'sections',
    id: 'sections',
    children: [
      {
        type: 'section',
        id: 'what',
        title: 'What they need',
        columns: 2,
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-kind', field: 'kind' },
          { type: 'field', id: 'f-bedrooms', field: 'bedrooms', invisible: "kind == 'office'" },
          { type: 'field', id: 'f-rooms', field: 'rooms' },
          { type: 'field', id: 'f-garden', field: 'garden', widget: 'toggle' },
          { type: 'field', id: 'f-notes', field: 'notes', colspan: 2 },
          { type: 'field', id: 'f-terms', field: 'terms' },
          { type: 'field', id: 'f-agent', field: 'agent' },
          { type: 'button', id: 'b-call', label: 'Call back', action: 'call' },
        ],
      },
    ],
  },
};

describe('a first paint on a server', () => {
  it('needs no DOM', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });

  it('draws the form with its values, in Fieldia’s classes, the page’s rules run', () => {
    const html = firstPaint(page, { values: { name: 'Nile & Sons', kind: 'villa', bedrooms: 4, garden: true, notes: 'Near <a> school', terms: '<p>First <b>line</b></p><p>Second</p>', agent: [7, 'Mona Adel'] }, styles: false });
    expect(html).toMatch(/^<div data-fd-first-paint><form class="fd-form" novalidate data-fd-skin="underline">/);
    expect(html).toContain('<h1 class="fd-page-title">Property enquiry</h1><p class="fd-page-description">Tell us &lt;what&gt; you need</p>');
    expect(html).toContain('<fieldset class="fd-section" data-node="what" data-style="card" data-on-page><legend class="fd-section-title"><bdi>What they need</bdi></legend><div class="fd-grid" data-columns="2">');
    expect(html).toContain('<div class="fd-field fd-required" data-node="f-name" data-field="name" data-path="name" data-type="char"><label class="fd-label" for="fd-first-1-f-name">Client</label><input id="fd-first-1-f-name" name="name" type="text" class="fd-input" value="Nile &amp; Sons"></div>');
    expect(html).toContain('<option value="villa" selected>Villa</option>');
    expect(html).toContain('name="bedrooms" type="text" class="fd-input" value="4"');
    // Worked out as the form works it out, and read-only as it is there.
    expect(html).toContain('name="rooms" readonly aria-readonly="true" type="text" class="fd-input" value="6"');
    expect(html).toContain('<input id="fd-first-5-f-garden" name="garden" type="checkbox" class="fd-switch" checked>');
    expect(html).toContain('<textarea id="fd-first-6-f-notes" name="notes" class="fd-input" rows="3">Near &lt;a&gt; school</textarea><div class="fd-help">Anything else</div>');
    expect(html).toContain('data-span="2"');
    expect(html).toContain('<div id="fd-first-7-f-terms" class="fd-input fd-first-text">First line\nSecond</div>');
    expect(html).toContain('value="Mona Adel"');
    // A button is the live form's to draw.
    expect(html).not.toContain('Call back');
    expect(html).not.toMatch(/\sstyle=/);
  });

  it('leaves out what the page hides', () => {
    const html = firstPaint(page, { values: { kind: 'office' }, styles: false });
    expect(html).not.toContain('Bedrooms');
    expect(html).toContain('Looking for');
  });

  it('brings Fieldia’s stylesheet with its nonce — the sheets the viewer keeps — unless told not to', () => {
    const html = firstPaint(page, { nonce: 'r4nd0m' });
    expect(html.indexOf('<div data-fd-first-paint>')).toBeGreaterThan(0);
    const styles = html.slice(0, html.indexOf('<div data-fd-first-paint>'));
    expect(styles).toBe(firstPaintStyles('r4nd0m'));
    expect([...styles.matchAll(/<style id="([^"]+)" nonce="r4nd0m">/g)].map((m) => m[1])).toEqual(['fieldia-styles', 'fieldia-styles-looks', 'fieldia-first-paint']);
  });

  it('writes in the page’s language, right to left where it runs so', () => {
    const html = firstPaint({ ...page, translations: { ar: { Client: 'العميل' } } }, { locale: 'ar', styles: false });
    expect(html).toContain('dir="rtl" lang="ar"');
    expect(html).toContain('>العميل</label>');
  });
});
