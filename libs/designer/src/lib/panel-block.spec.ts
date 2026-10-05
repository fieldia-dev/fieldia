import type { ButtonNode, ImageNode, Page, TextNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { locate } from './layout-tree';
import { mount, openTab, type } from './test-editor';

/**
 * A block picked on the canvas, in the panel's Content tab: a picture's
 * address and its words for those who cannot see it, how words read (a
 * heading, words, or a note), and a button's words.
 */

afterEach(() => document.body.replaceChildren());

function picked(kind: 'image' | 'text' | 'heading' | 'button') {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  const id = designer.addBlock(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer);
  designer.pick(id);
  openTab(host, 'Content');
  const box = (name: string) => host.querySelector(`.fd-properties [aria-label="${name}"]`) as HTMLInputElement | null;
  const node = <T>() => locate(designer.getPage() as Page, id)?.node as T;
  return { designer, host, id, box, node };
}

describe('a block’s own settings', () => {
  it('sets a picture’s address and its description, saying why the description matters', () => {
    const { box, node, host } = picked('image');
    type(box('Picture address') as HTMLInputElement, 'https://example.com/logo.png');
    type(box('Description') as HTMLInputElement, 'Acme’s logo');
    expect(node<ImageNode>()).toMatchObject({ src: 'https://example.com/logo.png', alt: 'Acme’s logo' });
    expect(host.querySelector('.fd-properties')?.textContent).toMatch(/Read out to those who cannot see it/);
  });

  it('keeps the picture as it was when its address is emptied, and says so', () => {
    const { box, node, designer } = picked('image');
    const before = node<ImageNode>().src;
    type(box('Picture address') as HTMLInputElement, '');
    expect(node<ImageNode>().src).toBe(before);
    expect(designer.getState().issues).toEqual(['A picture needs its address']);
  });

  it('makes words a heading, words or a note', () => {
    const { host, node } = picked('text');
    const choice = (words: string) => [...host.querySelectorAll<HTMLButtonElement>('.fd-properties button')].find((b) => b.textContent === words) as HTMLButtonElement;
    choice('Note').click();
    expect(node<TextNode>().style).toBe('note');
    choice('Heading').click();
    expect(node<TextNode>().style).toBe('heading');
    expect(choice('Heading').getAttribute('aria-pressed')).toBe('true');
  });

  it('sets a button’s words', () => {
    const { box, node } = picked('button');
    type(box('Button words') as HTMLInputElement, 'Save and finish later');
    expect(node<ButtonNode>().label).toBe('Save and finish later');
  });
});

describe('a picture’s width, place, link and caption, in its panel', () => {
  const choice = (host: Element, group: string, words: string) => host.querySelector(`.fd-properties [aria-label="${group}"] [data-choice="${words}"]`) as HTMLButtonElement;

  it('sets its width by name or in pixels, and where it sits in its row', () => {
    const { host, node, box } = picked('image');
    choice(host, 'Width', 'medium').click();
    expect(node<ImageNode>().width).toBe('medium');
    expect(choice(host, 'Width', 'medium').getAttribute('aria-pressed')).toBe('true');
    const pixels = box('Width in pixels') as HTMLInputElement;
    pixels.value = '240';
    pixels.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node<ImageNode>().width).toBe(240);
    expect(choice(host, 'Width', 'medium').getAttribute('aria-pressed')).toBe('false');
    choice(host, 'Place', 'center').click();
    expect(node<ImageNode>().align).toBe('center');
    // Its own width again, and the start of its row.
    choice(host, 'Width', 'auto').click();
    choice(host, 'Place', 'start').click();
    expect(node<ImageNode>()).not.toHaveProperty('width');
    expect(node<ImageNode>()).not.toHaveProperty('align');
  });

  it('opens a link in a new tab, refusing one that is no web or mail address, and has a caption', () => {
    const { node, box, designer } = picked('image');
    const link = (text: string) => {
      const input = box('Link') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    link('javascript:alert(1)');
    expect(node<ImageNode>()).not.toHaveProperty('href');
    expect(designer.getState().issues).toEqual(['A link is a web address, https://…, or a mail address, mailto:…']);
    link('https://example.com/venue');
    type(box('Caption') as HTMLInputElement, 'The hall is on the first floor');
    expect(node<ImageNode>()).toMatchObject({ href: 'https://example.com/venue', caption: 'The hall is on the first floor' });
    link('');
    expect(node<ImageNode>()).not.toHaveProperty('href');
  });

  it('asks for its description when it has none: it is how the picture is read out, and named as a link', () => {
    const { host, box } = picked('image');
    const description = box('Description') as HTMLInputElement;
    expect(description.getAttribute('aria-invalid')).toBe('true');
    type(description, 'A map of the venue');
    expect(description.getAttribute('aria-invalid')).toBe('false');
    expect(host.querySelector('.fd-properties')?.textContent).toMatch(/Read out to those who cannot see it/);
  });
});

describe('a picture with no description', () => {
  it('is a check before publishing, until it is described; a linked one says it is a link with no name', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addBlock('image', { parent: 'section-1' }) as string;
    const about = () => designer.checks().filter((c) => c.at === id);
    expect(about()).toEqual([{ at: id, severity: 'should', text: 'A picture has no description: people who cannot see it are told nothing of it.', fix: { label: 'Describe it', action: { kind: 'go', id, part: 'label' } } }]);
    designer.updateBlock(id, { href: 'https://example.com' });
    expect(about()[0].text).toBe('A picture that is a link has no description: a screen reader would read it as a link with no name.');
    designer.updateBlock(id, { alt: 'Our logo' });
    expect(about()).toEqual([]);
  });
});
