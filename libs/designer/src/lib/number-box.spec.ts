import { validatePage, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { DESIGNER_WORDS } from './designer-words';
import { trackProblem, tracksFrom } from './head-commands';
import { plainNumber, settingNumber, type SettingNumberOptions } from './number-box';
import { findNode } from './page-tree';
import { readPage } from './page-json';
import { settingRefusal } from './setting-refusals';
import { mount } from './test-editor';
import type { Refusal } from './refusal';
import { checkWorkLook } from './work-text';

/**
 * The designer's number box (FIELDIA INPUT RULES, 9): every number setting is
 * typed into it, never the browser's number box. Arabic-Indic and Persian
 * digits, ٫ and a decimal comma read; letters are refused as they are typed,
 * in words under the box; what is typed is kept as the box is left, and what
 * does not read or fit keeps the setting as it was, saying what fits.
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
/** Everything in the box chosen, then typed over and the box left. */
function retype(input: HTMLInputElement, text: string) {
  input.focus();
  input.select();
  input.setRangeText('', 0, input.value.length, 'end');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  keys(input, text);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}
const hintOf = (input: HTMLInputElement) => input.parentElement?.querySelector('.fd-refusal-hint') as HTMLElement | null;

describe('the designer’s number box', () => {
  function box(options: Partial<SettingNumberOptions> = {}, locale: 'en' | 'ar' = 'en') {
    let saved: number | null = options.saved?.() ?? 600;
    const commits: (number | null)[] = [];
    const made = settingNumber(el, { words: DESIGNER_WORDS[locale], locale }, {
      label: locale === 'ar' ? 'الارتفاع' : 'Height',
      integer: true,
      min: 120,
      ...options,
      saved: () => saved,
      commit(n) {
        commits.push(n);
        saved = n;
      },
    });
    const holder = document.createElement('div');
    holder.append(made.input);
    document.body.replaceChildren(holder);
    made.refresh();
    return { input: made.input, commits, saved: () => saved };
  }

  it('is a text box, never the browser’s number box, with a keyboard for numbers', () => {
    const { input } = box();
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('numeric');
    expect(input.value).toBe('600');
    // A minus is the full keyboard's: a number pad has none.
    expect(box({ min: undefined, integer: false }).input.inputMode).toBe('text');
  });

  it.each([
    ['٣٠٠', 300],
    ['۳۰۰', 300],
    ['1,500', 1500],
    ['٢٥٠', 250],
  ])('reads %s as %s and keeps it as the box is left', (typed, value) => {
    const { input, commits } = box();
    retype(input, typed);
    expect(commits).toEqual([value]);
    expect(input.value).toBe(String(value));
  });

  it('reads a decimal comma and the Arabic decimal separator as a decimal mark, never ten times larger', () => {
    for (const typed of ['1,5', '1٫5']) {
      const { input, commits } = box({ integer: false, min: undefined });
      retype(input, typed);
      expect(commits).toEqual([1.5]);
    }
  });

  it('refuses letters, a second decimal mark and a fraction of a whole number as they are typed, said to a screen reader', () => {
    const { input, commits } = box();
    keys(input, 'abc');
    expect(input.value).toBe('600');
    const hint = hintOf(input) as HTMLElement;
    expect(hint.textContent).toBe('Height: numbers only');
    expect(hint.getAttribute('role')).toBe('status');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    keys(input, '.');
    expect(hint.textContent).toBe('Height must be a whole number');
    // The second point never lands (typed after the 600 the box held).
    const decimal = box({ integer: false, min: undefined });
    keys(decimal.input, '1.2.');
    expect(hintOf(decimal.input)?.textContent).toBe('A number has only one decimal mark');
    expect(decimal.input.value).toBe('6001.2');
    expect(commits).toEqual([]);
  });

  it('keeps the setting when what is left in the box does not fit, says the range, and shows what it keeps', () => {
    const { input, commits } = box({ max: 4000 });
    retype(input, '50');
    expect(commits).toEqual([]);
    expect(input.value).toBe('600');
    expect(hintOf(input)?.textContent).toBe('Height is a whole number from 120 to 4000. It stays 600.');
    retype(input, '99999999');
    expect(commits).toEqual([]);
    const least = box();
    retype(least.input, '100');
    expect(hintOf(least.input)?.textContent).toBe('Height is a whole number, 120 or more. It stays 600.');
  });

  it('takes an optional setting away when emptied, and puts back one that must have a number, saying so', () => {
    const optional = box({ optional: true });
    retype(optional.input, '');
    expect(optional.commits).toEqual([null]);
    const required = box();
    retype(required.input, '');
    expect(required.commits).toEqual([]);
    expect(required.input.value).toBe('600');
    expect(hintOf(required.input)?.textContent).toBe('Height needs a number. It stays 600.');
  });

  it('a live box keeps what reads and fits as it is typed, and goes back to what it had when a refused number passed by one that fit', () => {
    const { input, commits, saved } = box({ min: 60, max: 320, live: true, saved: () => 200 });
    retype(input, '600');
    // 60 fit on the way to 600: taken back as 600 is refused.
    expect(commits).toEqual([60, 200]);
    expect(saved()).toBe(200);
    expect(input.value).toBe('200');
    expect(hintOf(input)?.textContent).toBe('Height is a whole number from 60 to 320. It stays 200.');
  });

  it('says a value more than a least, and one that a check refuses', () => {
    const most = box({ min: undefined, above: 0, integer: false, label: 'Most' } as Partial<SettingNumberOptions>);
    retype(most.input, '0');
    expect(hintOf(most.input)?.textContent).toBe('Most is more than 0. It stays 600.');
    const top = box({ min: 1, max: undefined, check: (n) => (n < 3 ? null : 'Rank only the top is fewer than the 3 options') });
    retype(top.input, '3');
    expect(top.commits).toEqual([]);
  });

  it('steps with ↑ and ↓, and says its range at the end of it', () => {
    const { input } = box({ max: 601 });
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(input.value).toBe('601');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(input.value).toBe('601');
    expect(hintOf(input)?.textContent).toBe('Height is a whole number from 120 to 601');
  });

  it('speaks Arabic on an Arabic designer, and writes numbers plainly', () => {
    const { input } = box({ max: 4000 }, 'ar');
    keys(input, 'x');
    expect(hintOf(input)?.textContent).toBe('الارتفاع: أرقام فقط');
    retype(input, '٥٠');
    expect(hintOf(input)?.textContent).toBe('الارتفاع: عدد صحيح من 120 إلى 4000. تبقى القيمة 600.');
    expect(plainNumber(1e21)).toBe('1000000000000000000000');
    expect(plainNumber(0.5, 'ar')).toBe('0.5');
  });
});

describe('the number settings of a field', () => {
  const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
  const fieldOf = (designer: Designer, id: string) => designer.getPage().fields[nodeOf(designer, id).field] as Record<string, unknown>;
  const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
  function screenWith(kind: string, locale?: 'ar') {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), ...(locale ? { locale } : {}) });
    const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    const { host } = mount(designer);
    return { designer, id, host };
  }

  it('a number’s From takes Arabic and Persian digits, and a letter never removes it', () => {
    const { designer, id, host } = screenWith('number');
    retype(inline(host, 'From'), '٥');
    expect(fieldOf(designer, id)['min']).toBe(5);
    keys(inline(host, 'From'), 'abc');
    inline(host, 'From').blur();
    expect(fieldOf(designer, id)['min']).toBe(5);
    retype(inline(host, 'To'), '۱۰');
    expect(fieldOf(designer, id)['max']).toBe(10);
    retype(inline(host, 'From'), '1,5');
    expect(fieldOf(designer, id)['min']).toBe(1.5);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('on an Arabic designer, ٣٠ in Most characters is 30, and words are Arabic', () => {
    const { designer, id, host } = screenWith('short-answer', 'ar');
    const most = host.querySelector('.fd-canvas-field.fd-editing .fd-inline-number') as HTMLInputElement;
    retype(most, '٣٠');
    expect(fieldOf(designer, id)['size']).toBe(30);
    keys(most, 'a');
    expect(hintOf(most)?.textContent).toMatch(/أرقام فقط$/);
  });

  it('Days after today reads ٣٠, keeps today+7 for what does not read, and refuses 0 there', () => {
    const { designer, id, host } = screenWith('date');
    (inline(host, 'Earliest') as HTMLSelectElement).value = 'after';
    inline(host, 'Earliest').dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOf(designer, id)['min']).toBe('today+1');
    const days = inline(host, 'Days after today, earliest');
    retype(days, '7');
    expect(fieldOf(designer, id)['min']).toBe('today+7');
    retype(days, '');
    expect(fieldOf(designer, id)['min']).toBe('today+7');
    expect(hintOf(days)?.textContent).toBe('Days after today, earliest needs a number. It stays 7.');
    retype(days, '0');
    expect(fieldOf(designer, id)['min']).toBe('today+7');
    expect(hintOf(days)?.textContent).toBe('Days after today, earliest is a whole number, 1 or more. It stays 7.');
    retype(days, '٣٠');
    expect(fieldOf(designer, id)['min']).toBe('today+30');
    // Picked again, the mode starts from the last good count, never a 0 left in a hidden box.
    (inline(host, 'Earliest') as HTMLSelectElement).value = 'today';
    inline(host, 'Earliest').dispatchEvent(new Event('change', { bubbles: true }));
    (inline(host, 'Earliest') as HTMLSelectElement).value = 'after';
    inline(host, 'Earliest').dispatchEvent(new Event('change', { bubbles: true }));
    expect(fieldOf(designer, id)['min']).toBe('today+30');
  });

  it('a progress bar’s Most is more than 0, said in its own name', () => {
    const { designer, id, host } = screenWith('progress');
    const most = inline(host, 'Most');
    retype(most, '0');
    expect(hintOf(most)?.textContent).toBe('Most is more than 0. It stays 100.');
    expect(designer.getState().issues).toEqual([]);
    expect(fieldOf(designer, id)['max']).toBe(100);
  });

  it('a frame’s height is 120 to 4000 whole pixels, never rounded in silence', () => {
    const { designer, id, host } = screenWith('pdf');
    const height = inline(host, 'Height (px)');
    retype(height, '600');
    expect(nodeOf(designer, id).options?.['height']).toBe(600);
    retype(height, '50');
    keys(height, '.');
    retype(height, '99999999');
    expect(nodeOf(designer, id).options?.['height']).toBe(600);
  });

  it('keywords’ At most refuses 0 in words and keeps the count', () => {
    const { designer, id, host } = screenWith('keywords');
    retype(inline(host, 'At most'), '4');
    retype(inline(host, 'At most'), '0');
    expect(nodeOf(designer, id).options?.['max']).toBe(4);
    expect(hintOf(inline(host, 'At most'))?.textContent).toBe('At most is a whole number, 1 or more. It stays 4.');
  });
});

describe('a refusal of the page’s format for a number setting', () => {
  it('is said in the setting’s own words, in the designer’s language, never a raw path', () => {
    expect(settingRefusal('layout.children[0].children[4].layers[0].live.staleAfter', DESIGNER_WORDS.en)).toBe('Seconds before it says when it was last seen is a whole number from 5 to 86400');
    expect(settingRefusal('layout.children[0].layers[2].reachable.minutes', DESIGNER_WORDS.ar)).toMatch(/: عدد صحيح من 1 إلى 120$/);
    expect(settingRefusal('layout.pageSize', DESIGNER_WORDS.en)).toBe('Rows on a page is a whole number from 1 to 500');
    expect(settingRefusal('layout.children[0].label', DESIGNER_WORDS.en)).toBeNull();
  });

  it('is said so in the JSON tab too', () => {
    const page = blankPage('screen', 'Visit') as unknown as { look?: Record<string, unknown> };
    page.look = { labelWidth: 5000 };
    const read = readPage(JSON.stringify(page), DESIGNER_WORDS.en);
    expect(read.problems.map((p) => p.message)).toEqual(['Label width is a whole number from 60 to 320']);
  });
});

describe('a column’s widths', () => {
  it('are read in Arabic or Persian digits, apart by spaces or commas, in the band and a group alike', () => {
    expect(tracksFrom('١fr ١fr')).toEqual(['1fr', '1fr']);
    expect(tracksFrom('٥٠% 1fr')).toEqual(['50%', '1fr']);
    expect(tracksFrom('274px, 1fr')).toEqual(['274px', '1fr']);
    expect(tracksFrom('274px، 1fr')).toEqual(['274px', '1fr']);
    expect(tracksFrom('  ')).toBeNull();
  });

  it('refuses a width no column can be, in words', () => {
    const group = { type: 'section', id: 'g', columns: 2, children: [] } as unknown as SectionNode;
    const refused = (tracks: string[]) => {
      try {
        checkWorkLook(group, { tracks });
        return null;
      } catch (error) {
        return (error as Refusal).in(DESIGNER_WORDS.en);
      }
    };
    expect(refused(tracksFrom('274px, 1fr') as string[])).toBeNull();
    expect(refused(['0px', '1fr'])).toBe('“0px”: a column is 1 to 4000 px wide');
    expect(refused(['99999px', '1fr'])).toBe('“99999px”: a column is 1 to 4000 px wide');
    expect(refused(['150%', '1fr'])).toMatch(/^“150%” is no width/);
    expect(['0px', '1px', '4000px', '4001px', '0%', '100%', '0fr', '1fr'].map(trackProblem)).toEqual(['range', null, null, 'range', 'range', null, 'range', null]);
  });
});
