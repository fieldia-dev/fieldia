import { mountKind } from './test-kinds';

/**
 * Found by the 0.23 input-rules check (JSON). The JSON box (extras.ts `jsonWidget`) takes text that jsonProblem passes
 * through JSON.parse, which rounds a number past 15-17 significant digits and turns one past the largest double into
 * Infinity — which JSON.stringify (a save, a redraw) then writes as null. Nothing is said: the field holds another
 * number (or null) than the one typed, a save sends it, and the box shows it at the next redraw. A number box refuses
 * the same text ("at most 15 digits"); the rule is "never change a value silently". (The code editors, @fieldia/code and
 * @fieldia/monaco, read JSON with JSON.parse the same way.)
 */

/** Typed into the JSON box, the box left, then drawn again as the viewer draws it after any change. */
function typedAndLeft(text: string) {
  const { form, el, refresh } = mountKind({ type: 'json', label: 'Data' });
  const area = el.querySelector('textarea') as HTMLTextAreaElement;
  area.focus();
  area.value = text;
  area.dispatchEvent(new Event('input', { bubbles: true }));
  area.blur();
  refresh();
  return { kept: JSON.stringify(form.getState().values['x']), shown: area.value.replace(/\s+/g, ' '), said: !!form.getState().unread?.['x'] };
}

describe('JSON: a number JSON.parse cannot keep as typed', () => {
  it('a 20-digit id is kept as typed, or the box says why — never kept, saved and shown as another number', () => {
    const { kept, shown, said } = typedAndLeft('{"order": 12345678901234567890}');
    expect(said ? 'said why' : `kept ${kept}, shown ${shown}`).toMatch(/said why|kept \{"order":12345678901234567890\}/);
  });

  it('1e400 is kept as typed, or the box says why — never kept as Infinity, saved and shown as null', () => {
    const { kept, shown, said } = typedAndLeft('{"limit": 1e400}');
    expect(said ? 'said why' : `kept ${kept}, shown ${shown}`).toMatch(/said why|1e400/);
  });
});
