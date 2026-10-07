import { mountKind, typeInto } from './test-kinds';

/** A document shown inline: a PDF kept in a file field (Flectra's pdf_viewer), or a page at an address (its embed_viewer). */
const PDF = { name: 'Instructions.pdf', type: 'application/pdf', size: 9, data: 'JVBERi0xLjQK' };

describe('a PDF shown inline', () => {
  const made: string[] = [];
  const revoked: string[] = [];
  beforeEach(() => {
    made.length = revoked.length = 0;
    URL.createObjectURL = () => (made.push('blob:x'), `blob:pdf-${made.length}`);
    URL.revokeObjectURL = (url: string) => void revoked.push(url);
  });

  it('shows the file in a frame of the browser’s own viewer, named by the file, under the field’s file box', () => {
    const { el, form } = mountKind({ type: 'binary', label: 'Instructions', accept: ['application/pdf'] }, { widget: 'pdf' });
    expect(el.querySelector('.fd-file')).not.toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
    form.setValue('x', PDF);
    const frame = el.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.src).toBe('blob:pdf-1');
    expect(frame.title).toBe('Instructions.pdf');
    expect(frame.style.height).toBe('480px');
  });

  it('lets the old file’s address go when another comes, and says when there is none read-only', () => {
    const { el, form, refresh } = mountKind({ type: 'binary', label: 'Instructions' }, { widget: 'pdf', options: { height: 300 } });
    form.setValue('x', PDF);
    form.setValue('x', { ...PDF, name: 'v2.pdf' });
    expect(revoked).toEqual(['blob:pdf-1']);
    expect((el.querySelector('iframe') as HTMLIFrameElement).style.height).toBe('300px');
    form.setValue('x', null);
    refresh({ readonly: true });
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.querySelector('.fd-embed-none')?.textContent).toBe('No document yet');
  });

  it('shows a file the app gives by its address', () => {
    const { el, form } = mountKind({ type: 'binary', label: 'Instructions' }, { widget: 'pdf' });
    form.setValue('x', { name: 'Manual.pdf', type: 'application/pdf', size: 1, url: 'https://files.example/manual.pdf' });
    expect((el.querySelector('iframe') as HTMLIFrameElement).src).toBe('https://files.example/manual.pdf');
  });
});

describe('a page shown inline', () => {
  it('shows the address typed in a frame, with a link to open it in a tab of its own', () => {
    const { el, value } = mountKind({ type: 'char', label: 'Slides' }, { widget: 'embed' });
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.id).toBe('fd-x');
    typeInto(input, 'https://docs.google.com/presentation/d/abc/embed');
    expect(value()).toBe('https://docs.google.com/presentation/d/abc/embed');
    const frame = el.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.src).toBe('https://docs.google.com/presentation/d/abc/embed');
    expect(frame.title).toBe('Slides');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    const open = el.querySelector('a.fd-embed-open') as HTMLAnchorElement;
    expect(open.href).toBe('https://docs.google.com/presentation/d/abc/embed');
    expect(open.target).toBe('_blank');
    expect(open.rel).toContain('noopener');
  });

  it('shows nothing for an address that is not a web page’s', () => {
    const { el, form } = mountKind({ type: 'char', label: 'Slides' }, { widget: 'embed' });
    form.setValue('x', 'javascript:alert(1)');
    expect(el.querySelector('iframe')).toBeNull();
    expect((el.querySelector('a.fd-embed-open') as HTMLElement).hidden).toBe(true);
  });
});
