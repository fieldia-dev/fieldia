import { WIDGET_LABELS } from './labels';
import { fillIn } from './kind-parts';

/**
 * A widget's words that name a field by its label quote a label that is a question (@fieldia/core's `quotedLabel`), in
 * the marks the sentence quotes typed words in — as the form's own messages do: never "How many days?: numbers only".
 */
describe('a widget’s words naming a question', () => {
  it('quote it, a name as written', () => {
    expect(fillIn(WIDGET_LABELS.en.numbersOnly, { label: 'How many days a week will you come in?' })).toBe('“How many days a week will you come in?”: numbers only');
    expect(fillIn(WIDGET_LABELS.en.numbersOnly, { label: 'Days a week' })).toBe('Days a week: numbers only');
    expect(fillIn(WIDGET_LABELS.en.dateUnfinished, { label: 'When did you visit?', text: 'yesterday', example: '31/12/2026' })).toBe('“When did you visit?”: “yesterday” is not a whole date yet; write it like 31/12/2026');
  });

  it('in the marks each language quotes in', () => {
    expect(fillIn(WIDGET_LABELS.de.notANumber, { label: 'Wie viele Tage?', text: 'abc' })).toBe('„Wie viele Tage?“: „abc“ ist keine Zahl');
    expect(fillIn(WIDGET_LABELS.fr.notANumber, { label: 'Combien de jours ?', text: 'abc' })).toBe('« Combien de jours ? » : « abc » n’est pas un nombre');
    expect(fillIn(WIDGET_LABELS.ar.notANumber, { label: 'كم يومًا؟', text: 'abc' })).toBe('«كم يومًا؟»: «abc» ليس رقمًا');
  });

  it('never twice: a label quoted already by its sentence’s rule stays as it is', () => {
    expect(fillIn('Fix {field} first', { field: '“How was it?”' })).toBe('Fix “How was it?” first');
  });
});
