import type { Page } from '@fieldia/core';
import { pageChanges, type Designer } from './designer';
import { employeeDesigner } from './test-layout';

/**
 * Every setting the panel sets says what it did in the Publish dialog's
 * list of changes, in a person's words — never only "Other changes".
 */

/** The lines one edit makes, from the page before it. */
function linesOf(edit: (designer: Designer) => unknown): string[] {
  const designer = employeeDesigner();
  const before: Page = JSON.parse(JSON.stringify(designer.getPage()));
  edit(designer);
  expect(designer.getState().issues).toEqual([]);
  return pageChanges(before, designer.getPage());
}

describe('what each setting of the panel says it changed', () => {
  it('a field’s words: its placeholder, and its help', () => {
    expect(linesOf((d) => d.updateQuestion('f-email', { placeholder: 'name@company.com' }))).toEqual(['“Work email”: its placeholder changed']);
    expect(linesOf((d) => d.updateQuestion('f-email', { help: 'The one IT gave you' }))).toEqual(['“Work email”: its help changed']);
  });

  it('the page’s description, and its look, setting by setting', () => {
    expect(linesOf((d) => d.setPageInfo({ description: 'For HR' }))).toEqual(['The description changed']);
    expect(linesOf((d) => d.setLook({ accent: '#1f7a4d' }))).toEqual(['The accent colour: #1677ff → #1f7a4d']);
    expect(linesOf((d) => d.setLook({ font: 'serif', density: 'compact', corners: 'round' }))).toEqual(['The font: the system’s → serif', 'The spacing: comfortable → compact', 'The corners: soft → round']);
    expect(linesOf((d) => d.setLook({ labels: 'beside', labelWidth: 180 }))).toEqual(['Where labels sit: above their boxes → beside their boxes', 'Labels set beside: 140 px wide → 180 px wide']);
    expect(linesOf((d) => d.setLook({ scheme: 'auto' }))).toEqual(['The colours: as the skin has them → as the reader’s system has them']);
  });

  it('a group’s columns on each screen, its labels, their width, its style and its width', () => {
    expect(linesOf((d) => d.setColumns('address', { wide: 2, medium: 2, narrow: 1 }))).toEqual(['“Home address”: 2 columns on a desktop, 2 on a tablet, 1 on a phone']);
    expect(linesOf((d) => d.setSectionLook('address', { labels: 'beside', labelWidth: 200 }))).toEqual(['“Home address”: labels beside their boxes', '“Home address”: labels 200 px wide']);
    expect(linesOf((d) => d.setSectionLook('address', { style: 'framed' }))).toEqual(['“Home address”: drawn in a frame, its title on it']);
    expect(linesOf((d) => d.setColspan('address', 2))).toEqual(['“Home address”: 2 columns wide']);
  });

  it('when a group shows', () => {
    const lines = linesOf((d) => d.setCondition('bank', { field: 'contract', equals: 'permanent' }));
    expect(lines).toEqual(['“Bank account” now shows only for some records']);
  });

  it('a field’s width and where its label sits', () => {
    expect(linesOf((d) => d.setColspan('f-city', 2))).toEqual(['“City”: 2 columns wide']);
    expect(linesOf((d) => d.setFieldLabels('f-city', 'hidden'))).toEqual(['“City”: its label inside its box']);
  });

  it('several parts at once: a line for each', () => {
    expect(linesOf((d) => d.setEach(['f-city', 'f-postcode'], { span: 2 }))).toEqual(['“City”: 2 columns wide', '“Postcode”: 2 columns wide']);
    expect(linesOf((d) => d.setEach(['f-city', 'address'], { labels: 'above' }))).toEqual(['“Home address”: labels above their boxes', '“City”: its label above its box']);
  });
});
