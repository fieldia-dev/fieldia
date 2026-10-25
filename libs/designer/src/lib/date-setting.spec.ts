import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { DESIGNER_WORDS, wordsIn } from './designer-words';
import { settingDate, type SettingDateOptions } from './date-setting';
import { findNode } from './page-tree';
import { button, choose, field, mount, openTab, typeAndLeave } from './test-editor';

/**
 * The designer's date box (FIELDIA INPUT RULES): every setting that is a day,
 * a day and time or a time of day is typed into Fieldia's own box, in the
 * page's order, Arabic and Persian digits read — never the browser's date
 * box, which follows the browser's language and reads no Arabic digits.
 */

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}) => {
  const made = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) made.setAttribute(name, value);
  return made;
};

/** Typed a key at a time, as a keyboard does: each key judged before it lands. */
function keys(input: HTMLInputElement, text: string) {
  input.focus();
  for (const key of text) {
    const typing = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: key });
    input.dispatchEvent(typing);
    if (typing.defaultPrevented) continue;
    const at = input.selectionStart ?? input.value.length;
    input.setRangeText(key, at, input.selectionEnd ?? at, 'end');
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: key }));
  }
}
/** Everything in the box chosen, then typed over a key at a time and the box left. */
function retype(input: HTMLInputElement, text: string) {
  input.focus();
  input.select();
  input.setRangeText('', 0, input.value.length, 'end');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  keys(input, text);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}
/** Text pasted over all the box holds, as Ctrl+V does: refused when the paste's own listener says so. */
function paste(input: HTMLInputElement, text: string) {
  input.focus();
  input.select();
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: { getData: () => string } };
  event.clipboardData = { getData: () => text };
  input.dispatchEvent(event);
  if (event.defaultPrevented) return;
  input.setRangeText(text, 0, input.value.length, 'end');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}
const hintOf = (input: HTMLInputElement) => input.parentElement?.querySelector('.fd-refusal-hint') as HTMLElement | null;

describe('the designer’s date box', () => {
  function box(options: Partial<SettingDateOptions> & { order?: 'mdy' } = {}, locale: 'en' | 'ar' = 'en') {
    let saved: string | null = options.saved ? (options.saved() ?? null) : '2026-03-02';
    const commits: (string | null)[] = [];
    const page = { ...blankPage('screen', 'Visit'), ...(options.order ? { look: { dateOrder: options.order } } : {}) } as Page;
    const made = settingDate(el, { words: wordsIn(locale), locale, getPage: () => page }, {
      kind: 'date',
      label: locale === 'ar' ? 'أول يوم' : 'Earliest day',
      ...options,
      saved: () => saved,
      commit(value) {
        commits.push(value);
        saved = value;
      },
    });
    const holder = document.createElement('div');
    holder.append(made.input);
    document.body.replaceChildren(holder);
    made.refresh();
    return { input: made.input, commits };
  }

  it('is a text box, never the browser’s date box, its placeholder the page’s order, and shows the day in words at rest', () => {
    const { input } = box();
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('dd/mm/yyyy');
    expect(input.value).toBe('2 Mar 2026');
    input.focus();
    expect(input.value).toBe('02/03/2026');
    input.blur();
    expect(input.value).toBe('2 Mar 2026');
  });

  it.each([
    ['15/10/2026'],
    ['15.10.2026'],
    ['١٥/١٠/٢٠٢٦'],
    ['۱۵/۱۰/۲۰۲۶'],
    ['2026-10-15'],
    ['15 Oct 2026'],
  ])('reads %s, typed day first, as 15 October and keeps it as the box is left', (typed) => {
    const { input, commits } = box();
    retype(input, typed);
    expect(commits).toEqual(['2026-10-15']);
    expect(input.value).toBe('15 Oct 2026');
    expect(hintOf(input)?.hidden).toBe(true);
  });

  it('types a page’s dates month first where its look says so', () => {
    const { input, commits } = box({ order: 'mdy' });
    expect(input.placeholder).toBe('mm/dd/yyyy');
    retype(input, '10/15/2026');
    expect(commits).toEqual(['2026-10-15']);
  });

  it('refuses a letter as it is typed, and a paste that is no date, with words under the box', () => {
    const { input, commits } = box();
    keys(input, '1x');
    expect(input.value).toBe('1');
    expect(hintOf(input)?.textContent).toMatch(/^Earliest day: “⁨1x⁩” is not a whole date yet; write it like 31\/12\/\d{4}$/);
    expect(input.getAttribute('aria-describedby')).toContain(hintOf(input)?.id);
    paste(input, 'next week');
    expect(hintOf(input)?.textContent).toBe('“⁨next week⁩” is not a date, so it was not pasted');
    paste(input, '١٥/١٠/٢٠٢٦');
    expect(input.value).toBe('15/10/2026');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(commits).toEqual(['2026-10-15']);
  });

  it('keeps the setting when what is left does not read, the box showing it again, and says why', () => {
    const { input, commits } = box();
    retype(input, '31/02/2026');
    expect(commits).toEqual([]);
    expect(input.value).toBe('2 Mar 2026');
    const hint = hintOf(input) as HTMLElement;
    expect(hint.textContent).toBe('Earliest day: February 2026 has 28 days. It stays 2 Mar 2026.');
    expect(hint.hidden).toBe(false);
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    // A year of two digits is never given a century in silence.
    retype(input, '15/10/26');
    expect(commits).toEqual([]);
    expect(hint.textContent).toMatch(/1926.*2026|2026.*1926/);
  });

  it('never keeps a day made of the keys around a refused one: left so, the setting stays, and why is said', () => {
    const { input, commits } = box();
    keys(input, '1x5/10/2026');
    expect(input.value).toBe('1');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    expect(commits).toEqual([]);
    expect(input.value).toBe('2 Mar 2026');
    expect(hintOf(input)?.textContent).toMatch(/^Earliest day: “⁨1x5\/10\/2026⁩” is not a whole date yet; write it like 31\/12\/\d{4}\. It stays 2 Mar 2026\.$/);
  });

  it('takes the setting away when emptied', () => {
    const { input, commits } = box();
    retype(input, '');
    expect(commits).toEqual([null]);
    expect(input.value).toBe('');
  });

  it('says a day the designer refuses because of another setting at the box', () => {
    const saved = '2026-03-02';
    const page = blankPage('screen', 'Visit');
    const made = settingDate(el, { words: DESIGNER_WORDS.en, locale: 'en', getPage: () => page, getState: () => ({ issues: ['The earliest day is after the latest'] }) }, { kind: 'date', label: 'Earliest day', saved: () => saved, commit: () => false });
    document.body.replaceChildren(made.input);
    made.refresh();
    retype(made.input, '20/03/2026');
    expect(saved).toBe('2026-03-02');
    expect(hintOf(made.input)?.textContent).toBe('The earliest day is after the latest. It stays 2 Mar 2026.');
  });

  it('a day and time is kept as the page keeps one, to the minute; a time of day in 24 hours or with am and pm', () => {
    const moment = box({ kind: 'datetime', saved: () => null });
    expect(moment.input.placeholder).toBe('dd/mm/yyyy hh:mm');
    retype(moment.input, '15/10/2026 14:30');
    expect(moment.commits).toEqual(['2026-10-15T14:30']);
    expect(moment.input.value).toBe('15 Oct 2026, 14:30');
    for (const [typed, expected] of [
      ['9 am', '09:00'],
      ['٥:٣٠ م', '17:30'],
      ['14h30', '14:30'],
    ] as const) {
      const time = box({ kind: 'time', label: 'Earliest time', saved: () => null });
      retype(time.input, typed);
      expect([typed, time.commits]).toEqual([typed, [expected]]);
    }
    const time = box({ kind: 'time', label: 'Earliest time', saved: () => '09:00' });
    retype(time.input, '25:00');
    expect(time.commits).toEqual([]);
    expect(hintOf(time.input)?.textContent).toBe('Earliest time: “⁨25:00⁩” is not a time; write it like 14:30. It stays 09:00.');
  });

  it('speaks Arabic on an Arabic designer', () => {
    const { input } = box({}, 'ar');
    expect(input.placeholder).toBe('يوم/شهر/سنة');
    retype(input, '٣١/٠٢/٢٠٢٦');
    expect(hintOf(input)?.textContent).toMatch(/^أول يوم: في فبراير 2026 28 يومًا\. تبقى القيمة /);
  });
});

describe('a date’s settings in the designer', () => {
  const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
  const fieldOf = (designer: Designer, id: string) => designer.getPage().fields[nodeOf(designer, id).field] as Record<string, unknown>;
  const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
  function screenWith(kind: string, locale?: 'ar') {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), ...(locale ? { locale } : {}) });
    const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    const { host } = mount(designer);
    return { designer, id, host };
  }

  it('an earliest day is typed day first, in Arabic digits too, and one after the latest is said at its box', () => {
    const { designer, id, host } = screenWith('date');
    choose(inline(host, 'Earliest'), 'day');
    const day = inline(host, 'Earliest day');
    expect(day.type).toBe('text');
    retype(day, '2/3/2026');
    expect(fieldOf(designer, id)['min']).toBe('2026-03-02');
    expect(day.value).toBe('2 Mar 2026');
    retype(day, '٥/٣/٢٠٢٦');
    expect(fieldOf(designer, id)['min']).toBe('2026-03-05');
    choose(inline(host, 'Latest'), 'day');
    retype(inline(host, 'Latest day'), '10/03/2026');
    expect(fieldOf(designer, id)['max']).toBe('2026-03-10');
    retype(day, '20/03/2026');
    expect(fieldOf(designer, id)['min']).toBe('2026-03-05');
    expect(hintOf(day)?.textContent).toBe('The earliest day is after the latest. It stays 5 Mar 2026.');
  });

  it('a time’s earliest and latest are typed in 24 hours or with am and pm, Arabic digits too', () => {
    const { designer, id, host } = screenWith('time');
    const earliest = inline(host, 'Earliest time');
    expect(earliest.type).toBe('text');
    retype(earliest, '9 am');
    retype(inline(host, 'Latest time'), '٥:٣٠ م');
    expect(nodeOf(designer, id).options).toEqual({ min: '09:00', max: '17:30' });
    retype(earliest, '');
    expect(nodeOf(designer, id).options).toEqual({ max: '17:30' });
  });
});

describe('set when, on a date', () => {
  const fields: Record<string, Field> = {
    qty: { type: 'integer', label: 'Quantity' },
    due: { type: 'date', label: 'Due' },
    meeting: { type: 'datetime', label: 'Meeting' },
  };
  function screen(pick: string) {
    const page = blankPage('screen', 'Order');
    const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
    section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
    page.fields = JSON.parse(JSON.stringify(fields));
    const designer = createDesigner({ page });
    designer.select(`f-${pick}`);
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    const panel = () => host.querySelector('.fd-properties') as HTMLElement;
    return { panel, def: (name: string) => designer.getPage().fields[name] };
  }

  it('takes a day typed day first in the designer’s date box, Arabic digits too; one that does not read is said, never kept', () => {
    const { panel, def } = screen('due');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    const to = field(panel(), 'Set to') as HTMLInputElement;
    expect(to.type).toBe('text');
    expect(to.placeholder).toBe('dd/mm/yyyy');
    retype(to, '15/10/2026');
    typeAndLeave(field(panel(), 'When'), 'qty > 10');
    expect(def('due').setWhen).toEqual([{ when: 'qty > 10', value: "'2026-10-15'" }]);
    expect((field(panel(), 'Set to') as HTMLInputElement).value).toBe('15 Oct 2026');
    retype(field(panel(), 'Set to') as HTMLInputElement, '١/١١/٢٠٢٦');
    expect(def('due').setWhen?.[0]?.value).toBe("'2026-11-01'");
    const again = field(panel(), 'Set to') as HTMLInputElement;
    retype(again, '31/02/2026');
    expect(def('due').setWhen?.[0]?.value).toBe("'2026-11-01'");
    expect(hintOf(again)?.textContent).toBe('Set to: February 2026 has 28 days. It stays 1 Nov 2026.');
  });

  it('takes a day and time as the page keeps one, to the minute', () => {
    const { panel, def } = screen('meeting');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    retype(field(panel(), 'Set to') as HTMLInputElement, '15/10/2026 14:30');
    typeAndLeave(field(panel(), 'When'), 'qty > 10');
    expect(def('meeting').setWhen).toEqual([{ when: 'qty > 10', value: "'2026-10-15T14:30'" }]);
    expect((field(panel(), 'Set to') as HTMLInputElement).value).toBe('15 Oct 2026, 14:30');
  });
});

describe('a date the designer does not take', () => {
  it.each(['en', 'ar'] as const)('%s: is never refused in silence, even when the designer names no reason', (locale) => {
    const page = blankPage('screen', 'Visit');
    const label = locale === 'ar' ? 'أول يوم' : 'Earliest day';
    const made = settingDate(el, { words: wordsIn(locale), locale, getPage: () => page, getState: () => ({ issues: [] }) }, {
      kind: 'date',
      label,
      saved: () => null,
      commit: () => false,
    });
    const holder = document.createElement('div');
    holder.append(made.input);
    document.body.replaceChildren(holder);
    retype(made.input, '15/10/2026');
    expect(made.input.value).toBe('');
    expect(hintOf(made.input)?.textContent).toBe(wordsIn(locale).inputs.settingDateRefused(label));
  });
});
