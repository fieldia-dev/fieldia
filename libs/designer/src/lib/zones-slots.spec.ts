import { validatePage, type Field, type FieldNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField } from './designer';
import { DESIGNER_WORDS } from './designer-words';
import { inputChanges } from './input-changes';
import { findNode } from './page-tree';
import { choose, field, mount } from './test-editor';

/**
 * A page's time zone and a date and time's own, and booking slots, in the
 * designer: offered where their neighbours are — the screen's Content beside
 * its description, a date and time's settings beside its minutes — each an
 * edit undone as one, said in words, in English and Arabic.
 */

const model: Record<string, Field> = {
  car: { type: 'many2one', label: 'Car', relation: 'showroom.car' },
  start: { type: 'datetime', label: 'Test drive' },
  stop: { type: 'datetime', label: 'Back by' },
  name: { type: 'char', label: 'Name' },
};
const screen = (locale?: 'ar') => createDesigner({ page: blankPage('screen', 'Test drive'), model, ...(locale ? { locale } : {}) });
const nodeOf = (designer: ReturnType<typeof screen>, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
/** A box typed in and left, as a person does: its change. */
function typeIn(box: HTMLInputElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
  box.blur();
}

describe('a time zone in the designer', () => {
  it('sets the page’s zone, and a date and time’s own, by their IANA names, each one undo step', () => {
    const designer = screen();
    expect(designer.setTimeZone(null, 'Europe/Berlin')).toBe(true);
    expect(designer.getPage().timeZone).toBe('Europe/Berlin');
    const id = designer.addModelField('start') as string;
    expect(designer.setTimeZone(id, ' Africa/Cairo ')).toBe(true);
    expect((designer.getPage().fields['start'] as { timeZone?: string }).timeZone).toBe('Africa/Cairo');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    designer.undo();
    expect((designer.getPage().fields['start'] as { timeZone?: string }).timeZone).toBeUndefined();
    expect(designer.setTimeZone(null, null)).toBe(true);
    expect(designer.getPage().timeZone).toBeUndefined();
  });

  it('refuses a zone no browser knows, and one on a field that is no date and time, saying why', () => {
    const designer = screen();
    expect(designer.setTimeZone(null, 'Berlin')).toBe(false);
    expect(designer.getState().issues[0]).toBe('“Berlin” is no time zone: name one as the IANA does, such as Africa/Cairo or Europe/Berlin');
    const name = designer.addModelField('name') as string;
    expect(designer.setTimeZone(name, 'Europe/Berlin')).toBe(false);
    expect(designer.getState().issues[0]).toBe('Only a date and time is on a time zone’s clock');
    const ar = screen('ar');
    expect(ar.setTimeZone(null, 'Berlin')).toBe(false);
    expect(ar.getState().issues[0]).toContain('ليست منطقة زمنية');
  });

  it('offers the page’s zone beside its description, and a date and time’s beside its minutes', () => {
    const designer = screen();
    const id = designer.addQuestion('date-time') as string;
    const { host } = mount(designer);
    designer.select(null);
    const page = field(host, 'Time zone') as HTMLInputElement;
    expect(page.placeholder).toBe('The browser’s own');
    expect(page.getAttribute('list')).toBe('fd-designer-zones');
    typeIn(page, 'Europe/Berlin');
    expect(designer.getPage().timeZone).toBe('Europe/Berlin');
    designer.select(id);
    const own = host.querySelector('.fd-canvas-field.fd-editing input[aria-label="Time zone"]') as HTMLInputElement;
    expect(own.placeholder).toBe('The page’s');
    typeIn(own, 'Africa/Cairo');
    expect((designer.getPage().fields[nodeOf(designer, id).field] as { timeZone?: string }).timeZone).toBe('Africa/Cairo');
  });
});

describe('booking slots in the designer', () => {
  it('make a date and time booked from the times free, a kind a new field can be made as', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Test drive') });
    const id = designer.addQuestion('booking-slots') as string;
    const node = nodeOf(designer, id);
    expect(node.widget).toBe('slots');
    expect(designer.getPage().fields[node.field].type).toBe('datetime');
    expect(kindOfField(designer.getPage().fields[node.field], node)).toBe('booking-slots');
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('take a schedule, a booking’s minutes and those kept free, its end and what asks again, for a field of the model too', () => {
    const designer = screen();
    designer.addModelField('car');
    designer.addModelField('stop');
    const id = designer.addModelField('start') as string;
    designer.changeKind(id, 'booking-slots');
    designer.select(id);
    const { host } = mount(designer);
    const editing = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    typeIn(editing.querySelector('input[aria-label="Schedule"]') as HTMLInputElement, 'showroom');
    typeIn(editing.querySelector('input[aria-label="Minutes a booking lasts"]') as HTMLInputElement, '45');
    typeIn(editing.querySelector('input[aria-label="Minutes kept free after one"]') as HTMLInputElement, '15');
    const ends = editing.querySelector('select[aria-label="Its end in"]') as HTMLSelectElement;
    expect([...ends.options].map((o) => o.textContent)).toEqual(['None', 'Back by']);
    choose(ends, 'stop');
    choose(host.querySelector('.fd-canvas-field.fd-editing select[aria-label="Asked again when"]') as HTMLSelectElement, 'car');
    expect(nodeOf(designer, id).options).toEqual({ schedule: 'showroom', length: 45, between: 15, endField: 'stop', dependsOn: ['car'] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('are said in words when they change, in English and Arabic', () => {
    const start = model['start'];
    const was = { field: start, node: { type: 'field', id: 'f', field: 'start', widget: 'slots' } as FieldNode };
    const now = { field: { ...start, timeZone: 'Europe/Berlin' } as Field, node: { ...was.node, options: { schedule: 'showroom', length: 45, between: 15, endField: 'stop', dependsOn: ['car'] } } };
    expect(inputChanges('Test drive', was, now).lines).toEqual([
      '“Test drive”: on the clock of Europe/Berlin',
      '“Test drive”: asks for the free times of “showroom”',
      '“Test drive”: a booking lasts 45 minutes',
      '“Test drive”: 15 minutes kept free after each booking',
      '“Test drive”: its end goes in “stop”',
      '“Test drive”: asked again when “car” changes',
    ]);
    const ar = inputChanges('Test drive', was, now, DESIGNER_WORDS.ar);
    expect(ar.unsaid).toEqual([]);
    expect(ar.lines[2]).toContain('يدوم الحجز 45 دقيقة');
  });
});
