import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { pageDialogs } from './related';
import { mountViewer, type ViewerOptions } from './viewer';

/**
 * A host's own tokens (`tokens`): its colours worn by the form, in place of
 * those worn before when it changes them, taken off with null, and worn by
 * every dialog the form opens after, as they are when it opens.
 */
const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const worn = (el: HTMLElement, name: string) => el.style.getPropertyValue(`--fd-${name}`);

beforeEach(() => document.body.replaceChildren());

describe('tokens', () => {
  it('are worn by the form, over its skin, theme and look', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const handle = mountViewer(host, { page: page('signup'), dataSource: createMemoryDataSource(), skin: 'outlined', theme: 'material', tokens: { text: '#e6ede9', surface: '#1b2320', accent: '#40c496' } });
    expect(worn(handle.element, 'text')).toBe('#e6ede9');
    expect(worn(handle.element, 'surface')).toBe('#1b2320');
    expect(worn(handle.element, 'accent')).toBe('#40c496');
  });

  it('are replaced whole by setTokens, and taken off by null; the app’s own options are left as they were', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const options: ViewerOptions = { page: page('signup'), dataSource: createMemoryDataSource(), tokens: { text: '#111111', accent: '#0f766e' } };
    const handle = mountViewer(host, options);
    handle.setTokens({ text: '#eeeeee' });
    expect(worn(handle.element, 'text')).toBe('#eeeeee');
    // Not kept from before: the new set replaces the old one.
    expect(worn(handle.element, 'accent')).toBe('');
    handle.setTokens(null);
    expect(worn(handle.element, 'text')).toBe('');
    expect(options.tokens).toEqual({ text: '#111111', accent: '#0f766e' });
  });

  it('only names Fieldia knows: anything else is not set', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const handle = mountViewer(host, { page: page('signup'), dataSource: createMemoryDataSource(), tokens: { accent: '#0f766e', colour: 'red' } as never });
    expect(worn(handle.element, 'accent')).toBe('#0f766e');
    expect(worn(handle.element, 'colour')).toBe('');
  });

  it('are worn by a dialog the form opens, as they are when it opens', async () => {
    const options: ViewerOptions = { page: page('customer'), dataSource: createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } } }), relatedPages: { partner: page('customer') }, tokens: { accent: '#0f766e' } };
    const dialogs = pageDialogs(options);
    options.tokens = { accent: '#b45309', surface: '#1b2320' };
    void dialogs.openRecord('partner', { title: 'Nile Traders', recordId: 1 });
    await flush();
    const box = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(worn(box, 'accent')).toBe('#b45309');
    expect(worn(box, 'surface')).toBe('#1b2320');
    // And the page inside it.
    expect(worn(box.querySelector('.fd-form') as HTMLElement, 'accent')).toBe('#b45309');
  });
});
