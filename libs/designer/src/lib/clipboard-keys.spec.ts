import { blankPage, createDesigner, type Designer } from './designer';
import { clipboardKeys } from './clipboard-keys';
import { FIELDIA_MIME } from './clipboard-ops';
import { mountScreenEditor } from './screen-editor';
import { mountSurveyEditor } from './survey-editor';
import { employeeDesigner } from './test-layout';

/**
 * ⌘C, ⌘X and ⌘V on the parts picked, through the system clipboard: the
 * parts as Fieldia's own type and as plain JSON; what is typed in a box
 * copied and pasted as ever; words that are not Fieldia's pasted as nothing,
 * said so.
 */

/** The clipboard a browser hands a copy, a cut or a paste. */
function clipboard(start: Record<string, string> = {}) {
  const data = new Map(Object.entries(start));
  return { data, setData: (type: string, text: string) => void data.set(type, text), getData: (type: string) => data.get(type) ?? '' };
}
function fire(type: 'copy' | 'cut' | 'paste', target: EventTarget, data = clipboard()) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  target.dispatchEvent(event);
  return { event, data };
}

let root: HTMLElement;
let stop: () => void;
function mount(designer: Designer) {
  root = document.createElement('div');
  document.body.append(root);
  stop = clipboardKeys({ root, designer, active: () => true }).destroy;
  return root;
}
afterEach(() => {
  stop?.();
  document.body.replaceChildren();
});
const said = () => root.querySelector('.fd-clipboard-said')?.textContent;

describe('copy, cut and paste of parts', () => {
  it('⌘C copies the parts picked: Fieldia’s own type, and the same JSON as plain text', () => {
    const d = employeeDesigner();
    mount(d);
    d.pickMany(['f-city', 'f-postcode']);
    const { event, data } = fire('copy', document.body);
    expect(event.defaultPrevented).toBe(true);
    expect(JSON.parse(data.data.get(FIELDIA_MIME) as string).parts.map((p: { id: string }) => p.id)).toEqual(['f-city', 'f-postcode']);
    expect(data.data.get('text/plain')).toBe(data.data.get(FIELDIA_MIME));
    expect(said()).toBe('Copied 2 parts');
  });

  it('⌘V pastes them after the part picked, as one edit', () => {
    const d = employeeDesigner();
    mount(d);
    d.select('f-city');
    const { data } = fire('copy', document.body);
    d.select('f-country');
    const { event } = fire('paste', document.body, clipboard({ 'text/plain': data.data.get('text/plain') as string }));
    expect(event.defaultPrevented).toBe(true);
    expect(d.getState().picked).toHaveLength(1);
    expect(d.getPage().fields['city_2']).toBeDefined();
    expect(said()).toBe('Pasted “City”');
    d.undo();
    expect(d.getPage().fields['city_2']).toBeUndefined();
  });

  it('⌘X copies them and takes them off the page', () => {
    const d = employeeDesigner();
    mount(d);
    d.select('f-city');
    const { data } = fire('cut', document.body);
    expect(data.data.get(FIELDIA_MIME)).toContain('"f-city"');
    expect(JSON.stringify(d.getPage().layout)).not.toContain('"f-city"');
    expect(said()).toBe('Cut “City”');
  });

  it('pastes into another designer, through the clipboard', () => {
    const from = employeeDesigner();
    mount(from);
    from.pickMany(['f-first_name', 'f-email']);
    const { data } = fire('copy', document.body);
    stop();
    const to = createDesigner({ page: blankPage('screen', 'Other') });
    mount(to);
    to.select('section-1');
    fire('paste', document.body, clipboard({ [FIELDIA_MIME]: data.data.get(FIELDIA_MIME) as string, 'text/plain': 'ignored' }));
    expect(Object.keys(to.getPage().fields)).toEqual(['first_name', 'email']);
    expect(said()).toBe('Pasted 2 parts');
  });

  it('says how many rules were left off, for reading a field the page has not got', () => {
    const from = employeeDesigner();
    from.setCondition('f-end_date', { field: 'contract', equals: 'fixed_term' });
    const text = from.copyParts(['f-end_date']) as string;
    const to = createDesigner({ page: blankPage('screen', 'Other') });
    mount(to);
    fire('paste', document.body, clipboard({ 'text/plain': text }));
    expect(said()).toBe('Pasted “Contract ends”; 1 rule left off: it read a field this page has not got');
  });

  it('words that are not Fieldia’s paste nothing, and it says so', () => {
    const d = employeeDesigner();
    mount(d);
    const before = d.getPage();
    fire('paste', document.body, clipboard({ 'text/plain': 'Hello there' }));
    expect(d.getPage()).toBe(before);
    expect(said()).toBe('There are no Fieldia parts to paste: copy parts in a Fieldia designer first');
  });

  it('leaves copy and paste alone while typing in a box, and while words are chosen on the page', () => {
    const d = employeeDesigner();
    mount(d);
    d.select('f-city');
    const box = document.createElement('input');
    root.append(box);
    expect(fire('copy', box).event.defaultPrevented).toBe(false);
    expect(fire('paste', box, clipboard({ 'text/plain': d.copyParts(['f-city']) as string })).event.defaultPrevented).toBe(false);
    const words = document.createElement('p');
    words.textContent = 'Some words';
    root.append(words);
    document.getSelection()?.selectAllChildren(words);
    expect(fire('copy', document.body).event.defaultPrevented).toBe(false);
    document.getSelection()?.removeAllRanges();
  });

  it('leaves alone what happens outside the editor, and copies nothing when nothing is picked', () => {
    const d = employeeDesigner();
    mount(d);
    const outside = document.createElement('div');
    document.body.append(outside);
    d.select('f-city');
    expect(fire('copy', outside).event.defaultPrevented).toBe(false);
    d.select(null);
    expect(fire('copy', document.body).event.defaultPrevented).toBe(false);
  });
});

describe('in both editors', () => {
  it('the screen editor copies and pastes the parts picked', () => {
    const d = employeeDesigner();
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountScreenEditor(host, { designer: d });
    d.select('f-city');
    const { data } = fire('copy', document.body);
    fire('paste', document.body, data);
    expect(d.getPage().fields['city_2']).toBeDefined();
    expect(host.querySelector('.fd-clipboard-said')?.textContent).toBe('Pasted “City”');
    handle.destroy();
    expect(host.querySelector('.fd-clipboard-said')).toBeNull();
  });

  it('the survey editor copies a question onto another page', () => {
    const d = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = d.addQuestion('short-answer') as string;
    const two = d.addContainer('Page 2') as string;
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountSurveyEditor(host, { designer: d });
    d.select(q);
    const { data } = fire('copy', document.body);
    d.select(two);
    fire('paste', document.body, data);
    expect(JSON.stringify(d.getPage().layout)).toContain('"q_2"');
    handle.destroy();
  });
});
