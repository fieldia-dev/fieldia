import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { ar } from './locales/ar';
import { formulaInWords, formulaProblem, problemWords, sampleHolds, sampleResult, wouldCircle } from './rules-formula';
import { answerRuleMust, answerRuleSentence, conditionInWords, pageRules } from './rules-words';
import { branchMap } from './branch-map';
import { mount } from './test-editor';

/** Rules said in Arabic: whole sentences in Arabic word order, counts in its plural forms, the page's own words as written. */

const order: Page = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    name: { type: 'char', label: 'الاسم' },
    price: { type: 'float', label: 'السعر' },
    qty: { type: 'integer', label: 'الكمية' },
    total: { type: 'float', label: 'المجموع', compute: 'price * qty' },
    state: { type: 'selection', label: 'الحالة', options: [{ value: 'draft', label: 'مسودة' }, { value: 'done', label: 'منجز' }] },
    vip: { type: 'boolean', label: 'عميل مميز' },
    tags: { type: 'selection', label: 'الوسوم', multiple: true, options: [{ value: 'a', label: 'أ' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 's',
        title: 'الطلب',
        children: [
          { type: 'field', id: 'f-name', field: 'name', validate: [{ minLength: 2, maxLength: 40 }, { endsWith: '@acme.com', level: 'warning', when: 'vip == True' }] },
          { type: 'field', id: 'f-price', field: 'price', invisible: "state != 'done'" },
          { type: 'field', id: 'f-qty', field: 'qty', required: "state == 'done'" },
          { type: 'field', id: 'f-total', field: 'total' },
          { type: 'field', id: 'f-state', field: 'state' },
          { type: 'field', id: 'f-vip', field: 'vip' },
          { type: 'field', id: 'f-tags', field: 'tags', validate: [{ atLeast: 1, atMost: 2 }] },
        ],
      },
    ],
  },
};

afterEach(() => document.body.replaceChildren());

describe('an answer rule, in Arabic', () => {
  it('says what it asks, counting letters in Arabic’s plural forms', () => {
    const say = (rule: object) => answerRuleSentence(order, rule, ar);
    expect(say({ minLength: 1 })).toBe('حرف واحد على الأقل');
    expect(say({ minLength: 2 })).toBe('حرفان على الأقل');
    expect(say({ minLength: 3 })).toBe('3 أحرف على الأقل');
    expect(say({ maxLength: 11 })).toBe('11 حرفًا على الأكثر');
    expect(say({ maxLength: 100 })).toBe('100 حرف على الأكثر');
    expect(say({ minLength: 2, maxLength: 40 })).toBe('بين 2 و40 حرفًا');
    expect(say({ min: 1, max: 10 })).toBe('بين 1 و10');
    expect(say({ atLeast: 1, atMost: 2 })).toBe('اختيار ما بين 1 و2');
    expect(say({ pattern: '\\d+' })).toBe('أرقام فقط');
    expect(say({ date: 'past' })).toBe('تاريخ في الماضي');
    expect(say({})).toBe('لا يطلب شيئًا بعد');
  });

  it('says when it only warns, and when it is checked, after an em dash, the page’s words as written', () => {
    expect(answerRuleSentence(order, { endsWith: '@acme.com', level: 'warning', when: 'vip == True' }, ar)).toBe('ينتهي بـ ⁦@acme.com⁩ — تنبيه فقط، فقط عندما عميل مميز يساوي نعم');
    expect(answerRuleMust(order, { endsWith: '@acme.com', level: 'warning' }, ar)).toBe('يجب أن ينتهي بـ ⁦@acme.com⁩ (تنبيه فقط)');
    expect(answerRuleMust(order, { minLength: 2, pattern: '[A-Za-z ]+' }, ar)).toBe('يجب أن يتكون من حرفين على الأقل، يجب أن يحتوي على أحرف فقط');
  });
});

describe('a formula, in Arabic', () => {
  it('reads with the fields by their labels, its signs, and its own words in Arabic', () => {
    expect(formulaInWords(order, 'price * qty', ar)).toBe('السعر × الكمية');
    expect(formulaInWords(order, "state == 'done' and qty > 10", ar)).toBe('الحالة يساوي منجز و الكمية > 10');
    expect(formulaInWords(order, "state != 'draft' or not vip", ar)).toBe('الحالة لا يساوي مسودة أو ليس عميل مميز');
    expect(conditionInWords(order, { join: 'all', rules: [{ field: 'vip', op: 'is', value: true }, { field: 'state', op: 'is not', value: 'draft' }] }, ar)).toBe('عميل مميز يساوي نعم والحالة لا يساوي مسودة');
  });

  it('says what is wrong with it, and where, the place kept left to right', () => {
    expect(problemWords(formulaProblem(order, 'prise * qty', ar), ar)).toBe('حقل غير معروف «⁨prise⁩» عند الموضع ⁦1–5⁩');
    expect(problemWords(formulaProblem(order, 'price + round(1, 2, 3)', ar), ar)).toBe('«⁨round⁩» يأخذ 1 أو 2 من القيم، عند الموضع ⁦9–13⁩');
    expect(problemWords(formulaProblem(order, 'price *', ar), ar)).toBe('ينقص شيء بعد «⁨*⁩» عند الموضع ⁦7⁩');
    expect(problemWords(formulaProblem(order, '  ', ar), ar)).toBe('اكتب صيغة');
    expect(wouldCircle(order, 'total', 'total + 1', ar)).toBe('لا يمكن حساب «⁨المجموع⁩» من نفسه');
  });

  it('says what it gives on made-up values', () => {
    expect(sampleResult(order, 'total', 'price * qty', ar)).toBe('مع السعر 120 والكمية 3: 360');
    expect(sampleHolds(order, 'price > qty', ar)).toBe('مع السعر 120 والكمية 3: يتحقق');
    expect(sampleHolds(order, 'False', ar)).toBe('لا يتحقق أبدًا');
  });
});

describe('every rule on the page, in Arabic', () => {
  it('says each as a sentence the Rules view lists', () => {
    expect(pageRules(order, ar).map((r) => `${r.name}: ${r.sentence}`)).toEqual([
      'الاسم: بين 2 و40 حرفًا',
      'الاسم: ينتهي بـ ⁦@acme.com⁩ — تنبيه فقط، فقط عندما عميل مميز يساوي نعم',
      'السعر: يظهر عندما الحالة يساوي منجز',
      'الكمية: مطلوب عندما الحالة يساوي منجز',
      'المجموع: محسوب من السعر × الكمية',
      'الوسوم: اختيار ما بين 1 و2',
    ]);
  });

  it('draws the Rules view in Arabic', () => {
    const designer = createDesigner({ page: order, locale: 'ar' });
    const { host } = mount(designer);
    (host.querySelector('[data-mode="rules"]') as HTMLButtonElement).click();
    const view = host.querySelector('.fd-rules-view') as HTMLElement;
    expect(view.getAttribute('aria-label')).toBe('القواعد');
    expect(view.querySelector('.fd-rules-note')?.textContent).toBe('6 قواعد في هذه الصفحة.');
    expect([...view.querySelectorAll('.fd-rules-group-title')].map((t) => t.textContent)).toEqual(['يظهر عندما', 'مطلوب عندما', 'محسوب من', 'قواعد الإجابة']);
    expect((view.querySelector('.fd-rules-filter-box') as HTMLInputElement).placeholder).toBe('صفِّ بالكلمات: حقل، قيمة…');
  });

  it('marks a part on the canvas with its rules in Arabic', () => {
    const { host } = mount(createDesigner({ page: order, locale: 'ar' }));
    const marks = [...host.querySelectorAll('.fd-canvas-field[data-node="f-name"] .fd-rule-mark-words')].map((m) => m.textContent);
    expect(marks).toEqual(['قاعدتان']);
    expect(host.querySelector('.fd-canvas-field[data-node="f-price"] .fd-rule-mark-words')?.textContent).toBe('أحيانًا فقط');
  });
});

describe('where answers lead, in Arabic', () => {
  it('names each page off the line by the answers it is for', () => {
    const designer = createDesigner({ page: blankPage('survey', 'استبيان', { locale: 'ar' }), locale: 'ar' });
    const asked = designer.addQuestion('yes-no', { parent: 'step-1' }) as string;
    designer.updateQuestion(asked, { label: 'هل تستخدمه؟' });
    const second = designer.addContainer('الصفحة 2') as string;
    const [field] = Object.keys(designer.getPage().fields);
    designer.setCondition(second, { field, equals: true });
    const map = branchMap(designer.getPage(), ar);
    expect(map.nodes[1]).toMatchObject({ lane: 1, when: 'هل تستخدمه؟ يساوي نعم', answer: 'نعم' });
  });
});
