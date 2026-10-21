import type { FieldNode, FunctionsKnown, Page, SectionNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { ar } from './locales/ar';
import { pageChecks } from './page-checks';
import { formulaAdvice, formulaProblem, problemWords, sampleResult } from './rules-formula';
import { workedOutSetting } from './rules-worked-out';

/**
 * The functions in the designer: every one of Fieldia's offered by what it
 * works on, with its words; the app's own (`functions`) after them, checked
 * as Fieldia's are; a value of a kind a function does not take said in words.
 */

const page = (fields: Page['fields']): Page => ({ fieldia: '0.8', id: 'p', data: { kind: 'record', model: 'patient' }, fields, layout: { type: 'sections', id: 'root', children: [] } });

const patient = page({
  name: { type: 'char', label: 'Name' },
  notes: { type: 'text', label: 'Notes' },
  birth: { type: 'date', label: 'Birth date' },
  amount: { type: 'monetary', label: 'Amount', currency: 'EGP' },
  country: { type: 'char', label: 'Country' },
});

const FUNCTIONS: FunctionsKnown = {
  vatRate: { takes: [1, 1], values: ['text'], gives: 'number', tip: 'The VAT rate of a country, in per cent: vatRate(country)' },
  stock: { takes: [1, 1], asks: true },
};

describe('a formula’s functions, checked', () => {
  it('reads the new functions', () => {
    expect(formulaProblem(patient, 'age(birth) >= 18')).toBeNull();
    expect(formulaProblem(patient, "upper(join(' ', name, country))")).toBeNull();
  });

  it('advises of a value of a kind a function does not take, at what was given — and refuses none: it worked before', () => {
    expect(formulaProblem(patient, 'age(notes)')).toBeNull();
    expect(problemWords(formulaAdvice(patient, 'age(notes)'))).toBe('“age” takes a date: Notes is text at 5–9');
    expect(problemWords(formulaAdvice(patient, 'upper(amount)'))).toBe('“upper” takes text: Amount is a number at 7–12');
    expect(problemWords(formulaAdvice(patient, "addDays(birth, 'two')"))).toBe('“addDays” takes a number: \'two\' is text at 16–20');
    expect(problemWords(formulaAdvice(patient, 'age(notes)', ar), ar)).toBe('«⁨age⁩» تأخذ تاريخًا، و«⁨Notes⁩» من نوع نص عند الموضع ⁦5–9⁩');
    expect(formulaAdvice(patient, 'age(birth)')).toBeNull();
    // What does not read is the problem's to say, not the advice's.
    expect(formulaAdvice(patient, 'age(')).toBeNull();
  });

  it('reads the app’s own where they are given, and checks how many values they take and their kinds', () => {
    expect(problemWords(formulaProblem(patient, 'vatRate(country)'))).toMatch(/^Unknown function “vatRate”/);
    expect(formulaProblem(patient, 'amount * vatRate(country) / 100', undefined, FUNCTIONS)).toBeNull();
    expect(problemWords(formulaProblem(patient, 'vatRate(country, name)', undefined, FUNCTIONS))).toBe('“vatRate” takes 1 value, at 1–7');
    expect(formulaProblem(patient, 'vatRate(amount)', undefined, FUNCTIONS)).toBeNull();
    expect(problemWords(formulaAdvice(patient, 'vatRate(amount)', undefined, FUNCTIONS))).toBe('“vatRate” takes text: Amount is a number at 9–14');
  });

  it('works the app’s own out as nothing on made-up values: none is called as a person types', () => {
    let called = 0;
    const functions: FunctionsKnown = { vatRate: { call: () => (called++, 14) } };
    expect(sampleResult({ ...patient, fields: { ...patient.fields, vat: { type: 'float', label: 'VAT' } } }, 'vat', 'vatRate(country)', undefined, functions)).toBe('With Country “Country”: nothing — it cannot be worked out');
    expect(called).toBe(0);
  });
});

describe('the functions offered in Worked out from', () => {
  function mount(functions?: FunctionsKnown) {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), ...(functions ? { functions } : {}) });
    const id = designer.addQuestion('number') as string;
    const setting = workedOutSetting(elementFactory(document), designer, id);
    document.body.replaceChildren(setting.element);
    setting.update(designer.getPage());
    const groups = [...setting.element.querySelectorAll('.fd-formula-group')].map((group) => [group.getAttribute('aria-label'), [...group.querySelectorAll('button')].map((b) => b.textContent)]);
    const tip = (name: string) => [...setting.element.querySelectorAll('.fd-formula-function')].find((b) => b.textContent === name)?.getAttribute('title');
    return { designer, id, groups, tip };
  }

  it('are every function, by what each works on, each with its words', () => {
    const { groups, tip } = mount();
    expect(groups).toEqual([
      ['Numbers', ['round', 'roundMoney', 'min', 'max', 'abs', 'sum', 'count', 'average']],
      ['Dates', ['today', 'days', 'age', 'years', 'months', 'addDays', 'addMonths', 'addYears']],
      ['Words', ['contains', 'startsWith', 'endsWith', 'upper', 'lower', 'join', 'len']],
      ['Choosing', ['if', 'empty', 'firstOf']],
    ]);
    expect(tip('age')).toBe('Whole years from a birth date to today, or to a date given: age(birth_date) >= 18');
  });

  it('end with the app’s own, its words or the plain ones', () => {
    const { groups, tip } = mount(FUNCTIONS);
    expect(groups[groups.length - 1]).toEqual(['The app’s', ['vatRate', 'stock']]);
    expect(tip('vatRate')).toBe('The VAT rate of a country, in per cent: vatRate(country)');
    expect(tip('stock')).toBe('The app’s own function: stock()');
  });
});

describe('a designer given the app’s functions', () => {
  it('keeps a formula calling one, and refuses it without them', () => {
    const node = (designer: ReturnType<typeof createDesigner>, id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
    const plain = createDesigner({ page: blankPage('screen', 'Visit') });
    const a = plain.addQuestion('number') as string;
    expect(plain.setCompute(a, 'vatRate(\'EG\')')).toBe(false);
    const given = createDesigner({ page: blankPage('screen', 'Visit'), functions: FUNCTIONS });
    const b = given.addQuestion('number') as string;
    expect(given.setCompute(b, 'vatRate(\'EG\')')).toBe(true);
    expect(given.getPage().fields[node(given, b).field].compute).toBe("vatRate('EG')");
    expect(given.functions()).toBe(FUNCTIONS);
  });

  it('keeps a formula handing a function the wrong kind, and says it in the checks as a fix to make', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const notes = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(notes, { label: 'Notes' });
    const age = designer.addQuestion('number') as string;
    designer.updateQuestion(age, { label: 'Age' });
    const name = (id: string) => ((designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode).field;
    expect(designer.setCompute(age, `age(${name(notes)})`)).toBe(true);
    expect(designer.getState().issues).toEqual([]);
    const said = designer.checks().filter((check) => check.at === age);
    expect(said.map((check) => [check.severity, check.text])).toEqual([['should', `“Age”: in “Worked out from age(Notes)”, “age” takes a date: Notes is text at 5–${4 + name(notes).length} — that part gives nothing.`]]);
    // Anywhere else a formula is — a step's value, a list's row — the page's warning says it, as a fix to make.
    const page = { ...designer.getPage(), on: { open: [{ do: 'set', field: name(age), value: `upper(${name(age)})` }] } } as unknown as Page;
    expect(pageChecks(page).filter((check) => check.severity === 'should' && /upper/.test(check.text)).map((check) => check.text)).toEqual([`on.open[0].value: "upper(${name(age)})": upper takes text as its first value; "${name(age)}" is a number`]);
  });

  it('refuses a name no page may call, as it is made', () => {
    expect(() => createDesigner({ page: blankPage('screen', 'Visit'), functions: { round: () => 1 } })).toThrow(/"round" is Fieldia's own function/);
  });
});
