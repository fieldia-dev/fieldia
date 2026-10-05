import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { button, field, mount, openTab, type } from './test-editor';

/**
 * Each kind of part's own look, as SurveyJS and Vueform theme each kind of
 * component: on the Look tab (the survey's Look sheet), pick a kind — text
 * boxes, choices, groups, buttons, tables — and set the few things it has;
 * the canvas wears each as it is set, each change is one undo step, and “As
 * the page” gives a kind back to the page's look.
 */

describe('a kind of part’s look, in the model', () => {
  const designer = () => createDesigner({ page: blankPage('screen', 'Visit') });

  it('sets a kind’s settings, each a step of its own; a run of colours tried is one, as typing is', () => {
    const d = designer();
    expect(d.setPartLook('inputs', { background: '#fff7e6' })).toBe(true);
    expect(d.setPartLook('inputs', { background: '#fff0d9' })).toBe(true);
    expect(d.setPartLook('inputs', { corners: 'round' })).toBe(true);
    expect(d.setPartLook('inputs', { corners: 'square' })).toBe(true);
    expect(d.setPartLook('buttons', { accent: '#6941c6', textSize: 'large' })).toBe(true);
    expect(d.getPage().look).toEqual({ parts: { inputs: { background: '#fff0d9', corners: 'square' }, buttons: { accent: '#6941c6', textSize: 'large' } } });
    d.undo();
    expect(d.getPage().look?.parts).toEqual({ inputs: { background: '#fff0d9', corners: 'square' } });
    d.undo();
    expect(d.getPage().look?.parts).toEqual({ inputs: { background: '#fff0d9', corners: 'round' } });
    d.undo();
    d.undo();
    expect(d.getPage().look).toBeUndefined();
  });

  it('takes a setting back with null, and a whole kind back to the page’s look; nothing left, nothing kept', () => {
    const d = createDesigner({ page: { ...blankPage('screen', 'Visit'), look: { accent: '#1f7a4d' } } });
    d.setPartLook('groups', { background: '#fbfaf7', corners: 'round' });
    d.setPartLook('groups', { corners: null });
    expect(d.getPage().look).toEqual({ accent: '#1f7a4d', parts: { groups: { background: '#fbfaf7' } } });
    d.setPartLook('tables', { border: '#cccccc' });
    d.setPartLook('groups', null);
    expect(d.getPage().look).toEqual({ accent: '#1f7a4d', parts: { tables: { border: '#cccccc' } } });
    d.setPartLook('tables', { border: null });
    expect(d.getPage().look).toEqual({ accent: '#1f7a4d' });
  });

  it('refuses what a kind cannot draw, a colour not #rrggbb, and a kind it does not know, saying why', () => {
    const d = designer();
    expect(d.setPartLook('groups', { textSize: 'large' })).toBe(false);
    expect(d.getState().issues).toEqual(['Groups have no text size of their own']);
    expect(d.setPartLook('buttons', { background: '#ffffff' })).toBe(false);
    expect(d.getState().issues).toEqual(['Buttons have no background of their own']);
    expect(d.setPartLook('inputs', { border: 'orange' })).toBe(false);
    expect(d.getState().issues).toEqual(['A colour is written #rrggbb, such as #1f7a4d']);
    expect(d.setPartLook('inputs', { corners: 'pointy' as 'round' })).toBe(false);
    expect(d.setPartLook('labels' as 'inputs', { accent: '#123456' })).toBe(false);
    expect(d.getPage().look).toBeUndefined();
  });
});

function screenEditor() {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  designer.addQuestion('short-answer', { parent: 'section-1' });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  const canvas = host.querySelector('.fd-canvas') as HTMLElement;
  openTab(host, 'Look');
  const shown = () => host.querySelector('.fd-properties [role="tabpanel"]:not([hidden])') as HTMLElement;
  const row = () => shown().querySelector('[data-setting="Each kind of part"]') as HTMLElement;
  // The one on show: each kind has a Corners of its own.
  const group = (name: string) => [...row().querySelectorAll<HTMLElement>(`[role="group"][aria-label="${name}"]`)].find((g) => !g.closest('[hidden]')) as HTMLElement;
  const press = (name: string, words: string) => {
    const found = [...group(name).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words);
    if (!found) throw new Error(`No “${words}” in ${name}`);
    found.click();
  };
  const pressed = (name: string) => [...group(name).querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent);
  return { designer, host, canvas, row, group, press, pressed, parts: () => designer.getPage().look?.parts };
}

describe('the Look tab’s “Each kind of part”', () => {
  it('comes last among the page’s look, in Advanced; Simple keeps the look as it is', () => {
    const { host, row } = screenEditor();
    const names = [...host.querySelectorAll('.fd-properties [role="tabpanel"]:not([hidden]) [data-setting]')].map((r) => r.getAttribute('data-setting'));
    expect(names).toEqual(['Look presets', 'Accent colour', 'Font', 'Spacing', 'Corners', 'Labels', 'Label width', 'Colours', 'Each kind of part']);
    expect(row().hidden).toBe(false);
  });

  it('picks a kind, text boxes first, and shows only the settings it has', () => {
    const { row, group, press, pressed } = screenEditor();
    expect([...group('Kind of part').querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Text boxes', 'Choices', 'Groups', 'Buttons', 'Tables']);
    expect(pressed('Kind of part')).toEqual(['Text boxes']);
    const settings = () => [...row().querySelectorAll('[data-part-setting]')].filter((s) => !s.closest('[hidden]')).map((s) => s.getAttribute('data-part-setting'));
    expect(settings()).toEqual(['Background', 'Border', 'Corners', 'Text size', 'Accent']);
    press('Kind of part', 'Buttons');
    expect(pressed('Kind of part')).toEqual(['Buttons']);
    expect(settings()).toEqual(['Colour', 'Corners', 'Text size']);
    press('Kind of part', 'Tables');
    expect(settings()).toEqual(['Heading row', 'Lines', 'Text size']);
    press('Kind of part', 'Groups');
    expect(settings()).toEqual(['Background', 'Border', 'Corners']);
  });

  it('sets text boxes’ background, border and corners, and the canvas wears each as it is set', () => {
    const { row, canvas, press, pressed, parts } = screenEditor();
    type(field(row(), 'Background'), '#fff7e6');
    expect(parts()).toEqual({ inputs: { background: '#fff7e6' } });
    expect(canvas.getAttribute('data-inputs')).toBe('bg');
    expect(canvas.style.getPropertyValue('--fd-inputs-bg')).toBe('#fff7e6');
    type(field(row(), 'Border'), '#c4320a');
    press('Corners', 'Round');
    expect(pressed('Corners')).toEqual(['Round']);
    expect(parts()).toEqual({ inputs: { background: '#fff7e6', border: '#c4320a', corners: 'round' } });
    expect(canvas.getAttribute('data-inputs')).toBe('bg border radius');
    expect(canvas.style.getPropertyValue('--fd-inputs-radius')).toBe('12px');
    // Pressed again, a choice goes back to the page's.
    press('Corners', 'Round');
    expect(parts()?.inputs?.corners).toBeUndefined();
    expect(canvas.style.getPropertyValue('--fd-inputs-radius')).toBe('');
  });

  it('sets the buttons’ colour; each change is one undo step, and the panel follows', () => {
    const { designer, row, canvas, press, pressed, parts } = screenEditor();
    press('Corners', 'Round');
    press('Kind of part', 'Buttons');
    type(field(row(), 'Colour'), '#6941c6');
    type(field(row(), 'Colour'), '#5b34b0');
    expect(parts()).toEqual({ inputs: { corners: 'round' }, buttons: { accent: '#5b34b0' } });
    expect(canvas.getAttribute('data-buttons')).toBe('accent');
    designer.undo();
    expect(parts()).toEqual({ inputs: { corners: 'round' } });
    expect(canvas.hasAttribute('data-buttons')).toBe(false);
    expect(canvas.style.getPropertyValue('--fd-buttons-accent')).toBe('');
    press('Kind of part', 'Text boxes');
    expect(pressed('Corners')).toEqual(['Round']);
    designer.undo();
    expect(parts()).toBeUndefined();
    expect(pressed('Corners')).toEqual([]);
    expect(canvas.hasAttribute('data-inputs')).toBe(false);
  });

  it('marks the kinds that have a look of their own, and gives one back to the page with “As the page”', () => {
    const { row, group, press, parts } = screenEditor();
    const asPage = () => button(row(), 'Text boxes as the page');
    expect(asPage()).toBeUndefined();
    type(field(row(), 'Background'), '#fff7e6');
    press('Text size', 'Large');
    press('Kind of part', 'Choices');
    type(field(row(), 'Accent'), '#1f7a4d');
    const own = () => [...group('Kind of part').querySelectorAll('button[data-own]')].map((b) => b.textContent);
    expect(own()).toEqual(['Text boxes', 'Choices']);
    press('Kind of part', 'Text boxes');
    asPage()?.click();
    expect(parts()).toEqual({ choices: { accent: '#1f7a4d' } });
    expect(own()).toEqual(['Choices']);
    expect(asPage()).toBeUndefined();
  });

  it('takes one colour back to the page’s by its own button, leaving the rest', () => {
    const { row, parts } = screenEditor();
    type(field(row(), 'Background'), '#fff7e6');
    type(field(row(), 'Border'), '#c4320a');
    button(row(), 'Background as the page')?.click();
    expect(parts()).toEqual({ inputs: { border: '#c4320a' } });
    expect(button(row(), 'Background as the page')).toBeUndefined();
  });
});

describe('the survey’s Look sheet', () => {
  let handle: SurveyEditorHandle | null = null;
  afterEach(() => {
    handle?.destroy();
    handle = null;
    document.body.replaceChildren();
  });

  it('has each kind of part too, and the cards wear what is set', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    designer.addQuestion('multiple-choice');
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountSurveyEditor(host, { designer });
    (host.querySelector('.fd-designer-bar button[aria-label="Look"]') as HTMLButtonElement).click();
    const sheet = host.querySelector('[role="dialog"][aria-label="Look"]') as HTMLElement;
    const row = sheet.querySelector('[data-setting="Each kind of part"]') as HTMLElement;
    (row.querySelector('[role="group"][aria-label="Kind of part"] [data-choice="choices"]') as HTMLButtonElement).click();
    type(field(row, 'Accent'), '#1f7a4d');
    const cards = host.querySelector('.fd-survey-canvas') as HTMLElement;
    expect(designer.getPage().look?.parts).toEqual({ choices: { accent: '#1f7a4d' } });
    expect(cards.getAttribute('data-choices')).toBe('accent');
    expect(cards.style.getPropertyValue('--fd-choices-accent')).toBe('#1f7a4d');
  });
});
