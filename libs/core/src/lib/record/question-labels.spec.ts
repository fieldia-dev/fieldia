import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { checkValue } from './check';
import { createForm } from './form';
import { fillMessage, MESSAGES } from './messages';
import { isQuestion, labelAt, quotedLabel } from './record-words';

/**
 * A label that is a question, in a sentence that names its field. The owner's walk of 0.27: "How was your visit to
 * Riverside? is required". A question — a label ending with a question mark, or with an ellipsis the answer completes
 * ("May we tell you about…") — is quoted wherever a sentence names it, in the language's own quotation marks, and its
 * required message asks for the answer: "Please answer “How was your visit to Riverside?”". A label that is a name
 * reads as before: "Your name is required".
 */

const field = (label: string, more: Record<string, unknown> = {}) => ({ type: 'integer', label, ...more }) as Field;

describe('a label that is a question', () => {
  it('is a question by its mark: a question mark in any script, or an ellipsis; a name is none', () => {
    for (const label of ['How was your visit to Riverside?', 'Which treatments did you have? ', 'كيف كانت زيارتك؟', 'May we tell you about…', 'Anything else...']) expect(isQuestion(label)).toBe(true);
    for (const label of ['Your name', 'Rate (1–5)', 'Email:', '', '“How was it?”']) expect(isQuestion(label)).toBe(false);
  });

  it('is quoted in the language’s own marks', () => {
    expect(quotedLabel('How was it?', 'en')).toBe('“How was it?”');
    expect(quotedLabel('Wie war es?', 'de')).toBe('„Wie war es?“');
    expect(quotedLabel('Comment était-ce ?', 'fr')).toBe('« Comment était-ce ? »');
    expect(quotedLabel('كيف كانت؟', 'ar')).toBe('«كيف كانت؟»');
    expect(quotedLabel('Your name', 'en')).toBe('Your name');
  });

  it('is asked for by its required message, English and every language', () => {
    expect(checkValue(field('How was your visit to Riverside?'), null, true)).toBe('Please answer “How was your visit to Riverside?”');
    expect(checkValue(field('May we tell you about…'), null, true)).toBe('Please answer “May we tell you about…”');
    expect(checkValue(field('Your name'), null, true)).toBe('Your name is required');
    expect(checkValue(field('Wie war Ihr Besuch?'), null, true, MESSAGES.de)).toBe('Bitte beantworten Sie „Wie war Ihr Besuch?“');
    expect(checkValue(field('Comment était votre visite ?'), null, true, MESSAGES.fr)).toBe('Veuillez répondre à « Comment était votre visite ? »');
    expect(checkValue(field('كيف كانت زيارتك؟'), null, true, MESSAGES.ar)).toBe('يُرجى الإجابة عن «كيف كانت زيارتك؟»');
  });

  it('is quoted in every message that names its field: a least, a most, a choice to make', () => {
    expect(checkValue(field('How many days a week will you come in?', { min: 0, max: 5 }), 6, false)).toBe('“How many days a week will you come in?” must be at most 5');
    expect(fillMessage(MESSAGES.en, MESSAGES.en.atLeast, { label: 'Which treatments did you have?', min: 2 })).toBe('Choose at least 2 for “Which treatments did you have?”');
    // Small inside a sentence where the page asks (`lowerLabels`) — never a question, which is quoted as written.
    expect(fillMessage({ ...MESSAGES.en, lowerLabels: true }, MESSAGES.en.atLeast, { label: 'Which treatments did you have?', min: 2 })).toBe('Choose at least 2 for “Which treatments did you have?”');
    expect(fillMessage({ ...MESSAGES.en, lowerLabels: true }, MESSAGES.en.atLeast, { label: 'Interests', min: 2 })).toBe('Choose at least 2 for interests');
    expect(labelAt('Fix {field} to see {own}', 'field', false, 'en')('How was your visit?')).toBe('“How was your visit?”');
    expect(labelAt('Fix {field} to see {own}', 'field', true, 'en')('Unit price')).toBe('unit price');
  });

  it('the form says it so, the question as the page shows it: {branch} filled in', () => {
    const page = {
      fieldia: '0.9',
      id: 'feedback',
      data: { kind: 'responses' },
      fields: {
        branch: { type: 'selection', label: 'Which branch did you visit?', required: true, options: [{ value: 'riverside', label: 'Riverside' }] },
        overall: { type: 'integer', label: 'How was your visit to {branch|us}?', required: true },
        name: { type: 'char', label: 'Your name', required: true },
      },
      layout: { type: 'sections', id: 'root', children: ['branch', 'overall', 'name'].map((name) => ({ type: 'field', id: `f-${name}`, field: name })) },
    } as Page;
    const form = createForm({ page });
    form.setValue('branch', 'riverside');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ overall: 'Please answer “How was your visit to Riverside?”', name: 'Your name is required' });
  });
});
