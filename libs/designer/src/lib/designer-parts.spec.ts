import type { Page } from '@fieldia/core';
import { listPart } from '@fieldia/viewer';
import { datePart, filesPart, relationsPart } from '@fieldia/widgets';
import { createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';
import { mountSurveyEditor } from './survey-editor';

/**
 * An editor opening a page asks for every part its canvas draws the page from at once (the performance audit's M2):
 * never kind by kind as its canvas reaches each — 0.32 asked in three waves, 0.4 s on 4G before the canvas was whole —
 * and none it never draws from (a file's, loaded by an upload).
 */

const page = {
  fieldia: '0.11',
  id: 'visit',
  title: 'Visit',
  data: { kind: 'record', model: 'visit' },
  fields: { day: { type: 'date', label: 'Day' }, customer_id: { type: 'many2one', label: 'Customer', relation: 'partner' }, photo: { type: 'image', label: 'Photo' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-day', field: 'day' }, { type: 'field', id: 'f-customer', field: 'customer_id' }, { type: 'field', id: 'f-photo', field: 'photo' }] }] },
} as unknown as Page;

afterEach(() => {
  jest.restoreAllMocks();
  document.body.replaceChildren();
});

it.each([
  ['screen editor', (host: HTMLElement) => mountScreenEditor(host, { designer: createDesigner({ page }) })],
  ['survey editor', (host: HTMLElement) => mountSurveyEditor(host, { designer: createDesigner({ page: { ...page, layout: { type: 'wizard', id: 'root', children: [{ type: 'step', id: 'p1', title: 'One', children: page.layout.type === 'sections' ? (page.layout.children[0] as { children: unknown[] }).children : [] }] } } as unknown as Page }) })],
])('the %s asks for every part its page draws from as it opens', (_, mount) => {
  const asked = [datePart, relationsPart, listPart, filesPart].map((part) => jest.spyOn(part, 'load'));
  const host = document.createElement('div');
  document.body.append(host);
  const editor = mount(host);
  // At once, as it opens: the date box's part and the link's; never the list's, which the page has none of, nor the
  // files part, which an inert photo box never draws from (an upload loads it).
  expect(asked.map((spy) => spy.mock.calls.length > 0)).toEqual([true, true, false, false]);
  editor.destroy();
});
