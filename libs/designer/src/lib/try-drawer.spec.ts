import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { tryIt, type TryIt } from './try-it';

let handle: TryIt | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** A survey of two pages: Name (required) and Email on the first, Comments (required) on the second. */
function setup() {
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  const name = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(name, { label: 'Name', required: true });
  const email = designer.addQuestion('email') as string;
  designer.updateQuestion(email, { label: 'Email' });
  designer.addContainer('Page 2');
  const comments = designer.addQuestion('paragraph', { parent: 'step-2' }) as string;
  designer.updateQuestion(comments, { label: 'Comments', required: true });
  handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
  document.body.append(handle.toggle, handle.element);
  (handle.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
  const drawer = () => handle?.element.querySelector('.fd-try-drawer') as HTMLElement;
  const tab = (words: string) => [...drawer().querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent?.startsWith(words)) as HTMLButtonElement;
  const data = () => JSON.parse(drawer().querySelector('.fd-try-data')?.textContent ?? 'null');
  const problems = () => [...drawer().querySelectorAll('.fd-try-problem')].map((p) => p.textContent);
  const fieldOf = (label: string) => {
    const wrapper = [...(handle?.element.querySelectorAll('.fd-field') ?? [])].find((f) => f.querySelector('.fd-label')?.textContent?.startsWith(label)) as HTMLElement;
    return wrapper?.querySelector('input, textarea') as HTMLInputElement;
  };
  const fill = (label: string, text: string) => {
    const input = fieldOf(label);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { designer, drawer, tab, data, problems, fill, fieldOf };
}

describe('Try it’s drawer of data and problems', () => {
  it('sits under the page tried, showing the answers as JSON as they are typed', () => {
    const { drawer, tab, data, fill } = setup();
    expect(drawer().previousElementSibling?.classList.contains('fd-try-frame')).toBe(true);
    expect(tab('Data').getAttribute('aria-selected')).toBe('true');
    expect(Object.values(data())).toEqual([null, null, null]);
    fill('Name', 'Mona');
    expect(Object.values(data())).toContain('Mona');
  });

  it('lists the problems the answers have now, by question, and a click goes to the question', () => {
    const { tab, problems, fill, fieldOf, drawer } = setup();
    expect(tab('Problems').textContent).toBe('Problems2');
    tab('Problems').click();
    expect(tab('Problems').getAttribute('aria-selected')).toBe('true');
    expect(drawer().querySelector('.fd-try-data')?.closest('[hidden]')).not.toBeNull();
    expect(problems()).toEqual(['NameName is required', 'CommentsComments is required']);
    fill('Email', 'not an address');
    fill('Name', 'Mona');
    expect(problems()).toEqual(['EmailEmail is not in the expected format', 'CommentsComments is required']);
    (drawer().querySelector('.fd-try-problem') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(fieldOf('Email'));
  });

  it('goes to a question on another page of a survey when its problem is picked', () => {
    const { tab, drawer, fill, fieldOf } = setup();
    fill('Name', 'Mona');
    tab('Problems').click();
    (drawer().querySelector('.fd-try-problem') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(fieldOf('Comments'));
  });

  it('says when nothing stands in the way', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Customer' });
    handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
    document.body.append(handle.toggle, handle.element);
    (handle.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    const drawer = handle.element.querySelector('.fd-try-drawer') as HTMLElement;
    expect(drawer.querySelector('[role="tab"]:last-child')?.textContent).toBe('Problems');
    expect(drawer.querySelector('.fd-try-none')?.textContent).toBe('Nothing stands in the way of sending this.');
  });

  it('is not there for a list, which holds no answers of its own', () => {
    const designer = createDesigner({ page: blankPage('list', 'Customers') });
    handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
    document.body.append(handle.toggle, handle.element);
    (handle.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    expect(handle.element.querySelector('.fd-try-drawer')).toBeNull();
  });

  it('copies the data, or selects it for the person to copy', async () => {
    const { drawer, data } = setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const copy = [...drawer().querySelectorAll('button')].find((b) => b.textContent === 'Copy data') as HTMLButtonElement;
    copy.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(data());
    expect(drawer().querySelector('.fd-try-said')?.textContent).toBe('Copied.');
    Object.assign(navigator, { clipboard: undefined });
    copy.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(document.getSelection()?.toString()).toBe(drawer().querySelector('.fd-try-data')?.textContent);
  });
});
