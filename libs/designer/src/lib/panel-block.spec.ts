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
