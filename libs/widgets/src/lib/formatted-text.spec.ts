import { mountKind, press } from './test-kinds';
import { RICH_TOOLS } from './text-tools';
import { sanitizeHtml } from './sanitize';

/**
 * A formatted text drawn as a work item draws one: the rich editor with its
 * toolbar only while it is worked in, at its foot, the tools a page names;
 * the Markdown editor at rest as the text reads, its card while edited; a
 * switch between them that asks before losing formatting; people and records
 * linked in place as they are typed after their key.
 */

const references = [
  { key: '#', model: 'work.item', label: 'Work item', icon: 'hash' },
  { key: '!', model: 'pull.request', label: 'Pull request', icon: 'pull-request' },
];
const rich = (more: Record<string, unknown> = {}) =>
  mountKind({ type: 'html', label: 'System Info' }, { placeholder: 'Click to add System Info.', options: { editor: 'rich', toolbar: 'focus', toolbarAt: 'bottom', switchEditor: true, tools: [...RICH_TOOLS], references, mention: { model: 'res.users' }, ...more } });
const markdown = (more: Record<string, unknown> = {}) =>
  mountKind({ type: 'html', label: 'Repro Steps' }, { options: { editor: 'markdown', toolbar: 'focus', tools: ['mention', 'reference', 'attach', 'highlight', 'heading', 'bold', 'italic', 'code', 'link', 'bulletList', 'numberList', 'taskList'], references, mention: { model: 'res.users' }, ...more } });
const names = (el: Element, selector = '[role="toolbar"]') => [...(el.querySelector(selector) as HTMLElement).querySelectorAll('.fd-text-tool:not([hidden])')].map((b) => b.getAttribute('aria-label'));
const typeRich = (area: HTMLElement, html: string) => {
  area.innerHTML = html;
  area.dispatchEvent(new Event('input', { bubbles: true }));
};

let commands: [string, string | undefined][] = [];
beforeEach(() => {
  commands = [];
  (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, value?: string) => {
    commands.push([command, value]);
    return true;
  };
});

describe('the rich editor', () => {
  it('names its twenty tools in order, a tooltip on each, at the foot of its box', () => {
    const { el } = rich();
    expect(names(el)).toEqual([
      'Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Highlight', 'Text colour', 'Emoji', 'Decrease indent', 'Increase indent',
      'Strikethrough', 'Text size', 'Code', 'Mention someone', 'Link work item', 'Link pull request', 'Clear formatting', 'Insert image', 'Link', 'Remove link',
    ]);
    // Each tool's tooltip its name; Remove link's says too why it is idle, with no link where the caret is.
    for (const tool of el.querySelectorAll('.fd-text-tool:not([data-tool="unlink"])')) expect(tool.getAttribute('title')).toBe(tool.getAttribute('aria-label'));
    expect(el.querySelector('[data-tool="unlink"]')?.getAttribute('title')).toBe('Remove link — Put the cursor in a link first.');
    const box = el.querySelector('.fd-text-box') as HTMLElement;
    expect([...box.children].map((c) => c.classList[0])).toEqual(['fd-text-area', 'fd-link-row', 'fd-text-bar']);
    expect(el.getAttribute('data-toolbar')).toBe('focus');
    // One stop on Tab: the first tool.
    expect([...el.querySelectorAll('.fd-text-tool')].map((b) => (b as HTMLElement).tabIndex).filter((t) => t === 0)).toHaveLength(1);
    // The colours, sizes and emoji open their choices: a menu each.
    for (const tool of ['highlight', 'colour', 'size', 'emoji']) expect(el.querySelector(`[data-tool="${tool}"]`)?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('shows its placeholder while empty, and hands on what is typed as clean HTML', () => {
    const { el, value } = rich();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    expect(area.getAttribute('role')).toBe('textbox');
    expect(area.id).toBe('fd-x');
    expect(area.getAttribute('aria-labelledby')).toBe('fd-x-label');
    expect(area.getAttribute('data-placeholder')).toBe('Click to add System Info.');
    expect(area.classList.contains('fd-blank')).toBe(true);
    typeRich(area, '<p onclick="x()">Chrome <b>118</b><script>alert(1)</script></p>');
    expect(value()).toBe('<p>Chrome <b>118</b></p>');
    expect(area.classList.contains('fd-blank')).toBe(false);
    typeRich(area, '<p><br></p>');
    expect(value()).toBeNull();
  });

  it('runs each tool on what is selected', () => {
    const { el } = rich();
    const tool = (name: string) => (el.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement).click();
    for (const name of ['Bold', 'Underline', 'Strikethrough', 'Numbered list', 'Increase indent', 'Clear formatting']) tool(name);
    expect(commands).toEqual([['bold', undefined], ['underline', undefined], ['strikeThrough', undefined], ['insertOrderedList', undefined], ['indent', undefined], ['removeFormat', undefined]]);
  });

  it('offers colours and sizes in a menu, each named, and gives the one chosen', () => {
    const { el } = rich();
    const highlight = el.querySelector('[data-tool="highlight"]') as HTMLButtonElement;
    highlight.click();
    const menu = document.getElementById(highlight.getAttribute('aria-controls') as string) as HTMLElement;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(highlight.getAttribute('aria-expanded')).toBe('true');
    const items = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.map((i) => i.textContent)).toEqual(['Yellow', 'Green', 'Cyan', 'Raspberry', 'Orange', 'No colour']);
    expect(document.activeElement).toBe(items[0]);
    press(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    press(items[1], 'End');
    expect(document.activeElement).toBe(items[5]);
    items[0].click();
    expect(commands).toContainEqual(['hiliteColor', '#ffff00']);
    expect(highlight.getAttribute('aria-expanded')).toBe('false');
    const size = el.querySelector('[data-tool="size"]') as HTMLButtonElement;
    size.click();
    const sizes = document.getElementById(size.getAttribute('aria-controls') as string) as HTMLElement;
    expect([...sizes.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent)).toEqual(['12px', '14px', '16px', '20px', '28px']);
    press(sizes.querySelector('[role="menuitem"]') as HTMLElement, 'Escape');
    expect(sizes.hidden).toBe(true);
    expect(document.activeElement).toBe(size);
  });

  it('keeps a colour the browser puts on bold words on a span inside them, where a stored text keeps it', () => {
    const { el, value } = rich();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    typeRich(area, '<p><b>scanner</b></p>');
    (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, colour?: string) => {
      commands.push([command, colour]);
      if (command === 'hiliteColor') (area.querySelector('b') as HTMLElement).style.backgroundColor = colour as string;
      return true;
    };
    const highlight = el.querySelector('[data-tool="highlight"]') as HTMLButtonElement;
    highlight.click();
    (document.getElementById(highlight.getAttribute('aria-controls') as string)?.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    expect(value()).toBe('<p><b><span style="background-color: rgb(255, 255, 0);">scanner</span></b></p>');
  });

  it('says why Remove link does nothing where there is no link, and removes one under the cursor', () => {
    const { el } = rich();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    const unlink = el.querySelector('[aria-label="Remove link"]') as HTMLButtonElement;
    expect(unlink.disabled).toBe(false);
    // No link where the caret is: drawn idle, its tooltip saying why, still a button.
    expect([unlink.hasAttribute('data-idle'), unlink.hasAttribute('aria-disabled'), unlink.title]).toEqual([true, false, 'Remove link — Put the cursor in a link first.']);
    unlink.click();
    expect(el.querySelector('.fd-text-say')?.textContent).toBe('Put the cursor in a link first.');
    expect(el.querySelector('.fd-text-say')?.getAttribute('role')).toBe('status');
    expect(commands).toEqual([]);
    typeRich(area, '<p>See <a href="https://shop.example">the shop</a></p>');
    const range = document.createRange();
    range.setStart((area.querySelector('a') as HTMLElement).firstChild as Text, 2);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect([unlink.hasAttribute('data-idle'), unlink.title]).toEqual([false, 'Remove link']);
    unlink.click();
    expect(commands).toEqual([['unlink', undefined]]);
  });

  it('asks a link’s address in place, and takes only a web or mail address', () => {
    const { el } = rich();
    (el.querySelector('[aria-label="Link"]') as HTMLButtonElement).click();
    const address = el.querySelector('input[aria-label="Link address"]') as HTMLInputElement;
    expect((el.querySelector('.fd-link-row') as HTMLElement).hidden).toBe(false);
    address.value = 'javascript:alert(1)';
    (el.querySelector('.fd-link-apply') as HTMLButtonElement).click();
    expect(address.getAttribute('aria-invalid')).toBe('true');
    expect(commands).toEqual([]);
  });

  it('moves along its toolbar with the arrows, Home and End', () => {
    const { el } = rich();
    const tools = [...el.querySelectorAll('.fd-text-tool:not([hidden])')] as HTMLButtonElement[];
    tools[0].focus();
    press(tools[0], 'ArrowRight');
    expect(document.activeElement).toBe(tools[1]);
    expect(tools[1].tabIndex).toBe(0);
    expect(tools[0].tabIndex).toBe(-1);
    press(tools[1], 'End');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove link');
    press(document.activeElement as HTMLElement, 'ArrowRight');
    expect(document.activeElement).toBe(tools[0]);
  });

  it('switches to Markdown, asking first when formatting would be lost', () => {
    const { el, value } = rich();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    const switcher = el.querySelector('.fd-text-switch') as HTMLButtonElement;
    expect(switcher.textContent).toBe('switch to Markdown editor');
    typeRich(area, '<p><u>under</u> and <b>bold</b></p>');
    switcher.click();
    const ask = el.querySelector('.fd-text-ask') as HTMLElement;
    expect(ask.hidden).toBe(false);
    expect(ask.textContent).toContain('Some formatting cannot be written in Markdown and will be lost. Switch anyway?');
    (ask.querySelector('button:last-child') as HTMLButtonElement).click();
    expect(el.getAttribute('data-editor')).toBe('rich');
    switcher.click();
    (ask.querySelector('button') as HTMLButtonElement).click();
    expect(el.getAttribute('data-editor')).toBe('markdown');
    expect((el.querySelector('.fd-md-input') as HTMLTextAreaElement).value).toBe('under and **bold**');
    // Switching changes how it is edited, not what it holds.
    expect(value()).toBe('<p><u>under</u> and <b>bold</b></p>');
    expect(switcher.textContent).toBe('switch to rich text editor');
  });

  it('finds people after @ and records after their key, and links the one picked in place', async () => {
    const { el, form, value } = rich();
    const asked: [string, string, string | undefined][] = [];
    form.search = async (field, query, _limit, options) => {
      asked.push([field, query, options?.model]);
      return options?.model === 'res.users' ? [{ id: 2, label: 'Karim Fathy' }] : [{ id: 4130, label: 'Invoice total off by one' }];
    };
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    area.focus();
    area.innerHTML = '<p>ask @ka</p>';
    const text = (area.querySelector('p') as HTMLElement).firstChild as Text;
    const range = document.createRange();
    range.setStart(text, text.length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(asked).toEqual([['x', 'ka', 'res.users']]);
    const list = el.querySelector('.fd-text-suggest') as HTMLElement;
    expect(list.hidden).toBe(false);
    expect(list.getAttribute('role')).toBe('listbox');
    expect(list.textContent).toBe('Karim Fathy');
    expect(area.getAttribute('aria-activedescendant')).toBe(list.firstElementChild?.id);
    press(area, 'Enter');
    expect(list.hidden).toBe(true);
    expect(value()).toBe('<p>ask <span data-mention="2">@Karim Fathy</span>&nbsp;</p>');
  });

  it('has no tools and no switch while read-only', () => {
    const { el, refresh } = rich();
    refresh({ readonly: true });
    expect((el.querySelector('.fd-text-bar') as HTMLElement).hidden).toBe(true);
    expect((el.querySelector('.fd-text-under') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-text-area')?.getAttribute('contenteditable')).toBe('false');
  });
});

describe('the Markdown editor', () => {
  it('shows the text as it reads at rest, its links opening in a tab of their own with an icon', () => {
    const { el, form } = markdown();
    form.setValue('x', '<p><a href="https://shop.example/orders/SO-2088">https://shop.example/orders/SO-2088</a></p>');
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    expect(view.getAttribute('role')).toBe('textbox');
    expect(view.tabIndex).toBe(0);
    const link = view.querySelector('a') as HTMLAnchorElement;
    expect([link.target, link.rel]).toEqual(['_blank', 'noopener noreferrer']);
    expect(link.nextElementSibling?.getAttribute('data-icon')).toBe('external');
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(true);
    // What is stored keeps none of the drawing.
    expect(form.getState().values['x']).toBe('<p><a href="https://shop.example/orders/SO-2088">https://shop.example/orders/SO-2088</a></p>');
  });

  it('gives Edit and Done as its own tools, for its group’s heading', () => {
    const { widget, el } = markdown();
    expect(widget.tools?.map((t) => [t.getAttribute('aria-label'), t.hidden])).toEqual([['Edit Repro Steps', false], ['Done', true]]);
    expect(widget.tools?.every((t) => el.contains(t))).toBe(true);
  });

  it('opens its card on Enter: the box, the hint, thirteen tools and Preview; Done keeps what was typed as clean HTML', () => {
    const { el, form, widget } = markdown();
    form.setValue('x', '<p>old</p>');
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    press(view, 'Enter');
    const card = el.querySelector('.fd-md-card') as HTMLElement;
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(false);
    expect(view.hidden).toBe(true);
    const box = card.querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    expect(box.value).toBe('old');
    expect(card.querySelector('.fd-md-hint')?.textContent).toBe('Markdown supported. Paste or select files to insert.');
    expect(names(card)).toEqual(['Mention someone', 'Link work item', 'Link pull request', 'Attach a file', 'Highlight', 'Heading', 'Bold', 'Italic', 'Code', 'Link', 'Bulleted list', 'Numbered list', 'Checklist']);
    const preview = card.querySelector('[role="switch"]') as HTMLButtonElement;
    expect([preview.textContent, preview.getAttribute('aria-checked')]).toEqual(['Preview', 'false']);
    expect(widget.tools?.map((t) => t.hidden)).toEqual([true, false]);
    box.value = '**Steps**\n\n1. open SO-2088\n2. release 3 of 15 <b>items</b>';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['x']).toBe('<p><strong>Steps</strong></p><ol><li>open SO-2088</li><li>release 3 of 15 &lt;b&gt;items&lt;/b&gt;</li></ol>');
    expect(sanitizeHtml(form.getState().values['x'] as string)).toBe(form.getState().values['x']);
    preview.click();
    expect(preview.getAttribute('aria-checked')).toBe('true');
    expect(card.querySelector('.fd-md-preview strong')?.textContent).toBe('Steps');
    expect(box.hidden).toBe(true);
    (widget.tools?.[1] as HTMLButtonElement).click();
    expect(view.hidden).toBe(false);
    expect(view.querySelector('ol li')?.textContent).toBe('open SO-2088');
    expect(widget.tools?.map((t) => t.hidden)).toEqual([false, true]);
  });

  it('puts back what it held on Escape', () => {
    const { el, form, widget } = markdown();
    form.setValue('x', '<p>kept</p>');
    (widget.tools?.[0] as HTMLButtonElement).click();
    const box = el.querySelector('.fd-md-input') as HTMLTextAreaElement;
    box.value = 'changed';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getState().values['x']).toBe('<p>changed</p>');
    press(box, 'Escape');
    expect(form.getState().values['x']).toBe('<p>kept</p>');
    expect((el.querySelector('.fd-md-view') as HTMLElement).textContent).toBe('kept');
  });

  it('writes marks round the selection and lists at the lines’ start', () => {
    const { el, widget, form } = markdown();
    (widget.tools?.[0] as HTMLButtonElement).click();
    const box = el.querySelector('.fd-md-input') as HTMLTextAreaElement;
    box.value = 'count\nscan';
    box.setSelectionRange(0, 5);
    (el.querySelector('[aria-label="Bold"]') as HTMLButtonElement).click();
    expect(box.value).toBe('**count**\nscan');
    box.setSelectionRange(0, box.value.length);
    (el.querySelector('[aria-label="Checklist"]') as HTMLButtonElement).click();
    expect(box.value).toBe('- [ ] **count**\n- [ ] scan');
    expect(form.getState().values['x']).toBe('<ul><li data-task="open"><strong>count</strong></li><li data-task="open">scan</li></ul>');
  });

  it('shows the page’s words while empty, and nothing to edit when read-only', () => {
    const { el, widget, refresh } = mountKind({ type: 'html' }, { placeholder: 'Click to add Repro Steps.', options: { editor: 'markdown' } });
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    expect(view.getAttribute('data-placeholder')).toBe('Click to add Repro Steps.');
    expect(view.classList.contains('fd-blank')).toBe(true);
    refresh({ readonly: true });
    expect(widget.tools?.[0].hidden).toBe(true);
    view.click();
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(true);
  });
});

describe('the rich editor read first, edited from its Edit (edit: "button")', () => {
  const description = (more: Record<string, unknown> = {}, node: Record<string, unknown> = {}) =>
    mountKind({ type: 'html', label: 'Description' }, { placeholder: 'Click to add Description.', options: { editor: 'rich', edit: 'button', toolbar: 'focus', toolbarAt: 'top', tools: ['bold', 'italic', 'link', 'image'], mention: { model: 'res.users' }, ...more }, ...node });
  const STORED = '<p>Pay with <a href="https://shop.example/pay">the new page</a></p><p><img src="https://shop.example/cart.png" alt="The cart"></p>';
  /** The field holding what the record was loaded with: no change to save. */
  const loaded = (form: ReturnType<typeof description>['form'], html: string | null) => form.setValues({ x: html }, { stored: true });

  it('shows its text formatted at rest — links that open, pictures in place — and Edit and Done as its tools', () => {
    const { el, form, widget } = description();
    loaded(form, STORED);
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    expect([view.hidden, (el.querySelector('.fd-text') as HTMLElement).hidden]).toEqual([false, true]);
    expect([view.getAttribute('role'), view.tabIndex]).toEqual(['textbox', 0]);
    const link = view.querySelector('a') as HTMLAnchorElement;
    expect([link.textContent, link.target, link.rel]).toEqual(['the new page', '_blank', 'noopener noreferrer']);
    expect(view.querySelector('img')?.getAttribute('alt')).toBe('The cart');
    // Edit named for the field, for its group's heading; Done only while it is edited.
    expect(widget.tools?.map((t) => [t.getAttribute('aria-label'), t.hidden])).toEqual([['Edit Description', false], ['Done', true]]);
    // A press on a link opens the link, not the editor.
    link.click();
    expect(view.hidden).toBe(false);
  });

  it('opens on Edit with its toolbar on top and the focus in it; Done keeps what was typed', () => {
    const { el, form, widget } = description();
    loaded(form, '<p>old</p>');
    (widget.tools?.[0] as HTMLButtonElement).click();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    expect([(el.querySelector('.fd-md-view') as HTMLElement).hidden, (el.querySelector('.fd-text') as HTMLElement).hidden]).toEqual([true, false]);
    expect(document.activeElement).toBe(area);
    expect(area.innerHTML).toBe('<p>old</p>');
    expect(el.querySelector('.fd-text')?.getAttribute('data-bar-at')).toBe('top');
    expect(el.querySelector('.fd-text-box')?.firstElementChild?.getAttribute('role')).toBe('toolbar');
    expect(widget.tools?.map((t) => t.hidden)).toEqual([true, false]);
    typeRich(area, '<p>new <strong>words</strong></p>');
    expect(form.getState().dirty).toEqual(['x']);
    (widget.tools?.[1] as HTMLButtonElement).click();
    expect(form.getState().values['x']).toBe('<p>new <strong>words</strong></p>');
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    expect([view.hidden, view.querySelector('strong')?.textContent]).toEqual([false, 'words']);
    expect(document.activeElement).toBe(view);
    expect(widget.tools?.map((t) => t.hidden)).toEqual([false, true]);
  });

  it('opens on Enter on its words; Escape puts back what it held, the form unchanged', () => {
    const { el, form } = description();
    loaded(form, '<p>kept</p>');
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    press(view, 'Enter');
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    expect(document.activeElement).toBe(area);
    typeRich(area, '<p>changed</p>');
    expect(form.getState().dirty).toEqual(['x']);
    press(area, 'Escape');
    expect([form.getState().values['x'], form.getState().dirty]).toEqual(['<p>kept</p>', []]);
    expect([view.hidden, view.textContent]).toEqual([false, 'kept']);
    expect(document.activeElement).toBe(view);
  });

  it('keeps what was typed on a press outside it, and the form is changed only where the text is', () => {
    const { el, form, widget } = description();
    loaded(form, '<p>same</p>');
    const outside = document.createElement('button');
    document.body.append(outside);
    (widget.tools?.[0] as HTMLButtonElement).click();
    // Done with nothing typed: nothing changed.
    (widget.tools?.[1] as HTMLButtonElement).click();
    expect(form.getState().dirty).toEqual([]);
    (widget.tools?.[0] as HTMLButtonElement).click();
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    typeRich(area, '<p>other</p>');
    typeRich(area, '<p>same</p>');
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect([form.getState().values['x'], form.getState().dirty]).toEqual(['<p>same</p>', []]);
    expect((el.querySelector('.fd-md-view') as HTMLElement).hidden).toBe(false);
    // Typed and left by the keys for somewhere else: kept, the focus left where it went.
    (widget.tools?.[0] as HTMLButtonElement).click();
    typeRich(area, '<p>moved on</p>');
    outside.focus();
    expect([form.getState().values['x'], (el.querySelector('.fd-md-view') as HTMLElement).hidden, document.activeElement]).toEqual(['<p>moved on</p>', false, outside]);
  });

  it('stays open as its own tools — Done, its group’s ⤢ — are pressed, and its toolbar’s menus are used', () => {
    const { el, form, widget } = description();
    loaded(form, '<p>text</p>');
    const tools = document.createElement('span');
    const maximise = document.createElement('button');
    tools.append(...(widget.tools as HTMLElement[]), maximise);
    document.body.append(tools);
    (widget.tools?.[0] as HTMLButtonElement).click();
    maximise.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    maximise.focus();
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(false);
    (el.querySelector('.fd-text-area') as HTMLElement).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(false);
  });

  it('is its editor at rest while empty, its placeholder saying what to add; typed in and left, it reads as text', () => {
    const { el, form, widget } = description();
    loaded(form, null);
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    const area = el.querySelector('.fd-text-area') as HTMLElement;
    expect([view.hidden, (el.querySelector('.fd-text') as HTMLElement).hidden]).toEqual([true, false]);
    expect(area.getAttribute('data-placeholder')).toBe('Click to add Description.');
    expect(widget.tools?.map((t) => t.hidden)).toEqual([true, true]);
    area.focus();
    typeRich(area, '<p>Steps</p>');
    expect(widget.tools?.map((t) => t.hidden)).toEqual([true, false]);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect([view.hidden, view.textContent, widget.tools?.[0].hidden]).toEqual([false, 'Steps', false]);
    // Emptied again from Edit and kept: its editor at rest once more.
    (widget.tools?.[0] as HTMLButtonElement).click();
    typeRich(area, '');
    (widget.tools?.[1] as HTMLButtonElement).click();
    expect([form.getState().values['x'], view.hidden, (el.querySelector('.fd-text') as HTMLElement).hidden]).toEqual([null, true, false]);
  });

  it('read-only, reads as text with no Edit, empty or not', () => {
    const { el, form, widget, refresh } = description();
    loaded(form, '<p>locked</p>');
    refresh({ readonly: true });
    const view = el.querySelector('.fd-md-view') as HTMLElement;
    expect([view.hidden, view.getAttribute('aria-readonly'), view.tabIndex, widget.tools?.[0].hidden]).toEqual([false, 'true', -1, true]);
    view.click();
    press(view, 'Enter');
    expect((el.querySelector('.fd-text') as HTMLElement).hidden).toBe(true);
    loaded(form, null);
    expect([view.hidden, view.getAttribute('data-placeholder'), (el.querySelector('.fd-text') as HTMLElement).hidden]).toEqual([false, null, true]);
    // Made read-only while it is edited: what was typed is kept, read as text.
    refresh({ readonly: false });
    loaded(form, '<p>open</p>');
    (widget.tools?.[0] as HTMLButtonElement).click();
    typeRich(el.querySelector('.fd-text-area') as HTMLElement, '<p>typed</p>');
    refresh({ readonly: true });
    expect([form.getState().values['x'], view.hidden]).toEqual(['<p>typed</p>', false]);
  });

  it('leaves a rich text without edit: "button" as it was, its editor always there', () => {
    const { el, widget } = rich();
    expect(el.querySelector('.fd-md-view')).toBeNull();
    expect(widget.tools).toBeUndefined();
    expect((el.querySelector('.fd-text-area') as HTMLElement).id).toBe('fd-x');
  });
});

describe('a page that asks for nothing new', () => {
  it('keeps the classic toolbar on top, its text style and alignment', () => {
    const { el } = mountKind({ type: 'html' });
    expect(el.classList.contains('fd-richtext-box')).toBe(true);
    expect(el.querySelector('select[aria-label="Text style"]')).not.toBeNull();
    expect(mountKind({ type: 'html' }, { options: { toolbar: 'never' } }).el.querySelector('[role="toolbar"]')).toBeNull();
    expect(mountKind({ type: 'html' }, { options: { toolbar: 'always' } }).el.querySelector('select[aria-label="Text style"]')).not.toBeNull();
  });
});
