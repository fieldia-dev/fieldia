import { createForm, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { kindOfFile as kindOf } from './media';

/**
 * Films and sounds in a file field, as a person meets them: a film's picture among the files is its poster frame — the
 * app's own, else the frame half a second in — under a play mark; a sound in a list plays in place in the browser's own
 * player; opened, a film plays in the dialog's player from its poster frame, a sound under its name; one the browser
 * cannot play says so; the arrows of a player's own move through it, not to the next file; and an address made for one
 * held in the value is let go once it is drawn again, and once the field goes.
 */

// jsdom has no object URLs: the browser's are stood in for.
const made: string[] = [];
const revoked: string[] = [];
beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: () => {
      made.push(`blob:${made.length + 1}`);
      return made[made.length - 1];
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});
beforeEach(() => {
  made.length = 0;
  revoked.length = 0;
});

function setup(value: FileValue[], options: { node?: Record<string, unknown>; readonly?: boolean } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Visit', type: 'binary', multiple: true } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options.node ? { options: options.node } : {}) }] },
  } as Page;
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node, id: 'fd-x', document, labels: WIDGET_LABELS.en });
  const root = document.createElement('div');
  root.className = 'fd-form';
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  form.setValue('x', value);
  refresh();
  return { form, el: widget.element, widget };
}
const dialog = () => document.querySelector('.fd-file-viewer') as HTMLElement | null;
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

const tour: FileValue = { name: 'tour.webm', type: 'video/webm', size: 92_000, url: 'https://files.example/tour.webm' };
const note: FileValue = { name: 'kitchen tap.webm', type: 'audio/webm', size: 14_000, url: 'https://files.example/note.webm' };
const plan: FileValue = { name: 'plan.pdf', type: 'application/pdf', size: 2048, url: 'https://files.example/plan.pdf' };

describe('a file’s kind', () => {
  it('is a film or a sound by its media type first, else by its extension where no type is known', () => {
    const of = (name: string, type: string) => kindOf({ name, type, size: 1 });
    expect([of('tour.mp4', 'video/mp4'), of('note.webm', 'audio/webm'), of('note.mp3', 'audio/mpeg'), of('clip.mov', 'video/quicktime')]).toEqual(['video', 'audio', 'audio', 'video']);
    // No type, or bytes alone: the extension says.
    expect([of('tour.webm', ''), of('note.m4a', ''), of('note.opus', 'application/octet-stream'), of('take.MP4', '')]).toEqual(['video', 'audio', 'audio', 'video']);
    // A type that says otherwise is believed; the rest are as they were.
    expect([of('report.pdf', 'application/pdf'), of('photo.png', 'image/png'), of('notes.txt', 'text/plain'), of('sheet.xlsx', '')]).toEqual(['pdf', 'image', 'doc', 'sheet']);
  });
});

describe('films and sounds among the files', () => {
  it('shows a film by its frame half a second in, muted and never read aloud, a play mark over it', () => {
    const { el } = setup([tour]);
    const frame = el.querySelector('.fd-file-open .fd-file-film') as HTMLElement;
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    const film = frame.querySelector('video') as HTMLVideoElement;
    expect([film.getAttribute('src'), film.getAttribute('preload'), film.muted, film.hasAttribute('controls'), film.tabIndex]).toEqual(['https://files.example/tour.webm#t=0.5', 'metadata', true, false, -1]);
    // The button is named by the file, as any file's is.
    expect(el.querySelector('.fd-file-open')?.getAttribute('aria-label')).toBe('tour.webm, 89.8 KB');
  });

  it('shows the app’s own poster frame where the file has one, and the kind’s page where the film cannot be read', () => {
    const { el } = setup([{ ...tour, poster: 'https://files.example/tour.jpg' }, { ...tour, name: 'broken.webm' }]);
    const [first, second] = [...el.querySelectorAll('.fd-file-open')];
    expect(first.querySelector('.fd-file-film img')?.getAttribute('src')).toBe('https://files.example/tour.jpg');
    second.querySelector('video')?.dispatchEvent(new Event('error'));
    expect(second.querySelector('.fd-file-film')).toBeNull();
    expect(second.querySelector('.fd-file-icon')?.getAttribute('data-kind')).toBe('video');
  });

  it('plays a sound in a list where it is, in the browser’s own player named by the file — read-only too — and not on a card', () => {
    const { el } = setup([note, plan], { readonly: true });
    const players = el.querySelectorAll('audio');
    expect(players).toHaveLength(1);
    const player = players[0];
    expect([player.className, player.getAttribute('src'), player.hasAttribute('controls'), player.getAttribute('aria-label'), player.getAttribute('preload')]).toEqual(['fd-file-player', 'https://files.example/note.webm', true, 'kitchen tap.webm', 'metadata']);
    // Beside its file's button, never inside it: a player is not part of a button.
    expect(player.closest('button')).toBeNull();
    expect(player.parentElement?.classList.contains('fd-file-item')).toBe(true);
    const cards = setup([note], { node: { files: 'cards' } });
    expect(cards.el.querySelector('audio')).toBeNull();
    expect(cards.el.querySelector('.fd-file-icon')?.getAttribute('data-kind')).toBe('audio');
  });

  it('plays a film or a sound held in the value from an address of its own, let go once drawn again and once the field goes', () => {
    const held: FileValue = { name: 'note.webm', type: 'audio/webm', size: 4, data: 'GkXfow==' };
    const { form, el, widget } = setup([held, { ...held, name: 'clip.webm', type: 'video/webm' }]);
    expect(el.querySelector('audio')?.getAttribute('src')).toBe('blob:1');
    expect(el.querySelector('.fd-file-film video')?.getAttribute('src')).toBe('blob:2#t=0.5');
    form.setValue('x', [held]);
    expect(revoked).toEqual(['blob:1', 'blob:2']);
    widget.destroy?.();
    expect(revoked).toEqual(['blob:1', 'blob:2', 'blob:3']);
  });
});

describe('a film or a sound opened', () => {
  it('plays a film in the dialog’s player from its frame a tenth of a second in, or from the app’s poster frame', () => {
    const { el } = setup([tour, { ...tour, name: 'with poster.webm', poster: 'https://files.example/tour.jpg' }]);
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    const film = dialog()?.querySelector('.fd-file-viewer-body video') as HTMLVideoElement;
    expect([film.getAttribute('src'), film.hasAttribute('controls'), film.hasAttribute('playsinline'), film.getAttribute('aria-label'), film.getAttribute('poster')]).toEqual(['https://files.example/tour.webm#t=0.1', true, true, 'tour.webm', null]);
    expect(dialog()?.querySelector('a[download]')?.getAttribute('href')).toBe('https://files.example/tour.webm');
    key(dialog() as HTMLElement, 'ArrowRight');
    const posted = dialog()?.querySelector('.fd-file-viewer-body video') as HTMLVideoElement;
    expect([posted.getAttribute('src'), posted.getAttribute('poster')]).toEqual(['https://files.example/tour.webm', 'https://files.example/tour.jpg']);
    key(dialog() as HTMLElement, 'Escape');
  });

  it('plays a sound under its name, and says so where the browser cannot play it', () => {
    const { el } = setup([{ ...note, name: 'site.mp3', type: 'audio/mpeg' }], { node: { files: 'cards' } });
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    const sound = dialog()?.querySelector('.fd-file-sound') as HTMLElement;
    expect(sound.querySelector('strong')?.textContent).toBe('site.mp3');
    const player = sound.querySelector('audio') as HTMLAudioElement;
    expect([player.hasAttribute('controls'), player.getAttribute('aria-label')]).toEqual([true, 'site.mp3']);
    player.dispatchEvent(new Event('error'));
    expect(sound.querySelector('audio')).toBeNull();
    expect(sound.textContent).toContain('This browser cannot play it: download it to play it.');
    key(dialog() as HTMLElement, 'Escape');
  });

  it('leaves a player’s arrows to it: they move through the film, not to the next file', () => {
    const { el } = setup([tour, plan]);
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    const film = dialog()?.querySelector('video') as HTMLVideoElement;
    key(film, 'ArrowRight');
    expect(dialog()?.querySelector('h2')?.textContent).toBe('tour.webm');
    key(dialog() as HTMLElement, 'ArrowRight');
    expect(dialog()?.querySelector('h2')?.textContent).toBe('plan.pdf');
    key(dialog() as HTMLElement, 'Escape');
  });

  it('says a film the browser cannot play in the player’s place', () => {
    const { el } = setup([tour]);
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    dialog()?.querySelector('video')?.dispatchEvent(new Event('error'));
    expect(dialog()?.querySelector('.fd-file-none')?.textContent).toContain('tour.webm');
    expect(dialog()?.querySelector('.fd-file-none p')?.textContent).toBe('This browser cannot play it: download it to play it.');
    key(dialog() as HTMLElement, 'Escape');
  });
});
