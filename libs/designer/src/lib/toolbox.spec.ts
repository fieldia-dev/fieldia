import { elementFactory } from './chrome';
import { QUESTION_KINDS, SCREEN_KINDS } from './designer';
import { toolbox } from './toolbox';
import { en } from './locales/en';

function make(kinds = [...QUESTION_KINDS, ...SCREEN_KINDS], layout = true) {
  const picked: string[] = [];
  const pressed: string[] = [];
  const box = toolbox({
    el: elementFactory(document),
    doc: document,
    kinds,
    layout,
    words: en,
    onPick: (spec) => picked.push(spec),
    onPress: (spec) => pressed.push(spec),
  });
  document.body.append(box.element);
  const groups = () => [...box.element.querySelectorAll<HTMLElement>('.fd-tool-group')].filter((g) => !g.hidden).map((g) => g.querySelector('.fd-tool-heading-name')?.textContent);
  const tiles = (group?: string) =>
    [...box.element.querySelectorAll<HTMLElement>('.fd-tool-group')]
      .filter((g) => !g.hidden && (!group || g.querySelector('.fd-tool-heading-name')?.textContent === group))
      .flatMap((g) => [...g.querySelectorAll<HTMLElement>('.fd-tool')].filter((t) => !t.hidden && !t.closest('[hidden]')))
      .map((t) => t.dataset['tool']);
  const tile = (spec: string) => box.element.querySelector(`[data-tool="${spec}"]`) as HTMLButtonElement;
  return { box, picked, pressed, groups, tiles, tile };
}

afterEach(() => document.body.replaceChildren());

describe('the toolbox', () => {
  it('shows every kind as an icon and a name, in groups as Quantia’s toolbox does', () => {
    const { box, groups, tiles, tile } = make();
    box.update({ modelFields: [], tabs: false });
    expect(groups()).toEqual(['Text', 'Numbers and dates', 'Choices', 'Records', 'More', 'Layout']);
    expect(tiles('Text')).toEqual(['kind:short-answer', 'kind:paragraph', 'kind:email', 'kind:phone', 'kind:website', 'kind:keywords']);
    expect(tiles('Records')).toEqual(['kind:link', 'kind:links', 'kind:lines']);
    const email = tile('kind:email');
    expect(email.querySelector('svg')).not.toBeNull();
    expect(email.textContent).toBe('Email');
    // The whole name and what it adds, for the pointer resting on it.
    expect(email.title).toBe('Email: add a new field');
  });

  it('offers a survey only what a survey asks, with no layout', () => {
    const { box, groups, tiles } = make([...QUESTION_KINDS], false);
    box.update({ modelFields: [], tabs: false });
    expect(groups()).toEqual(['Text', 'Numbers and dates', 'Choices', 'More']);
    expect(tiles()).not.toContain('kind:link');
    expect(tiles()).not.toContain('kind:amount');
    expect(tiles('More')).toEqual(['kind:file', 'kind:signature', 'kind:address', 'kind:repeating']);
  });

  it('lists the model’s fields first, with how many, each with the icon of its kind', () => {
    const { box, groups, tiles, tile } = make();
    box.update({ modelFields: [{ name: 'email', field: { type: 'char', label: 'Email' } }, { name: 'credit_limit', field: { type: 'monetary', label: 'Credit limit' } }], tabs: false });
    expect(groups()[0]).toBe('From the model');
    expect(box.element.querySelector('.fd-tool-group .fd-tool-count')?.textContent).toBe('2');
    expect(tiles('From the model')).toEqual(['model:email', 'model:credit_limit']);
    expect(tile('model:credit_limit').title).toBe('Credit limit: already in the model, stored as an amount');
    box.update({ modelFields: [], tabs: false });
    expect(groups()[0]).toBe('Text');
  });

  it('adds what is clicked, and hands a press over for dragging', () => {
    const { box, picked, pressed, tile } = make();
    box.update({ modelFields: [{ name: 'email', field: { type: 'char', label: 'Email' } }], tabs: true });
    tile('kind:amount').click();
    tile('model:email').click();
    tile('layout:tabs').click();
    expect(picked).toEqual(['kind:amount', 'model:email', 'layout:tabs']);
    tile('kind:date').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(pressed).toEqual(['kind:date']);
  });

  it('folds a group away and back', () => {
    const { box, tiles } = make();
    box.update({ modelFields: [], tabs: false });
    const heading = box.element.querySelector('[data-group="Text"] .fd-tool-heading') as HTMLButtonElement;
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    heading.click();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(tiles('Text')).toEqual([]);
    // Folding outlives a redraw.
    box.update({ modelFields: [], tabs: false });
    expect(tiles('Text')).toEqual([]);
    heading.click();
    expect(tiles('Text')).toHaveLength(6);
  });

  it('finds a kind by its name, hiding groups with nothing to show, and says when nothing matches', () => {
    const { box, groups, tiles } = make();
    box.update({ modelFields: [{ name: 'phone_2', field: { type: 'char', label: 'Mobile phone' } }], tabs: false });
    const find = box.element.querySelector('input[type="search"]') as HTMLInputElement;
    find.value = 'phone';
    find.dispatchEvent(new Event('input'));
    expect(tiles()).toEqual(['model:phone_2', 'kind:phone']);
    expect(groups()).toEqual(['From the model', 'Text']);
    find.value = 'zzz';
    find.dispatchEvent(new Event('input'));
    expect(tiles()).toEqual([]);
    expect((box.element.querySelector('.fd-tool-none') as HTMLElement).hidden).toBe(false);
    find.value = '';
    find.dispatchEvent(new Event('input'));
    expect((box.element.querySelector('.fd-tool-none') as HTMLElement).hidden).toBe(true);
  });

  it('offers tabs only where tabs can go', () => {
    const { box, tiles } = make();
    box.update({ modelFields: [], tabs: false });
    expect(tiles('Layout')).toEqual(['layout:section']);
    box.update({ modelFields: [], tabs: true });
    expect(tiles('Layout')).toEqual(['layout:section', 'layout:tabs']);
  });
});

describe('the toolbox in Advanced', () => {
  it('offers groups, side by side, tabs and the blocks between fields, each with a picture of its own', () => {
    const { box, tiles, tile, picked, pressed } = make();
    box.update({ modelFields: [], tabs: true, advanced: true });
    expect(tiles('Layout')).toEqual(['block:group', 'block:side', 'block:tabs', 'block:heading', 'block:text', 'block:divider', 'block:spacer', 'block:image', 'block:button']);
    expect(tile('block:side').textContent).toBe('Side by side');
    expect(tile('block:divider').querySelector('svg')?.innerHTML).not.toBe(tile('block:spacer').querySelector('svg')?.innerHTML);
    tile('block:heading').click();
    tile('block:image').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect([picked, pressed]).toEqual([['block:heading'], ['block:image']]);
  });

  it('in Simple, a section and tabs, as before', () => {
    const { box, tiles } = make();
    box.update({ modelFields: [], tabs: true, advanced: false });
    expect(tiles('Layout')).toEqual(['layout:section', 'layout:tabs']);
  });
});
