import type { FormNode, Page } from '@fieldia/core';
import { mountViewer, type PageRequest, type ViewerHandle } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { setHidden, setText } from './writes';

/**
 * A saved form placed in the page, on the canvas: drawn as the form will draw
 * it — by the viewer itself, every field read-only — inside a frame with its
 * title, the saved form and version it shows, and “Open it”, the app's way to
 * edit it on its own page; it is not edited here. Picked, moved and widened
 * as any part is. While it loads, a quiet line; when it cannot be shown — not
 * found, a version gone, holding this page — what the Checks list says of it.
 */

export interface FormViews {
  /** The saved form's frame, made or brought up to date. */
  draw(node: FormNode, picked: boolean): HTMLElement;
  /** Let go of the frames of saved forms no longer drawn. */
  keep(ids: Set<string>): void;
  destroy(): void;
}

interface View {
  element: HTMLElement;
  title: HTMLElement;
  tag: HTMLElement;
  open: HTMLButtonElement;
  note: HTMLElement;
  body: HTMLElement;
  viewer: ViewerHandle | null;
  /** What the form inside was drawn from: drawn again only when it changes. */
  drawn: { page: Page; look: string } | null;
  /** The saved form it shows now, for “Open it”. */
  pageId: string;
}

export function formViews(options: { el: ElementFactory; doc: Document; designer: Designer; skin?: string; widgets?: Record<string, WidgetFactory> }): FormViews {
  const { el, doc, designer } = options;
  const views = new Map<string, View>();

  /** A saved form inside the saved form, as the app's store has it: the viewer draws it too. */
  const pages = (request: PageRequest): Page | null | Promise<Page | null> => {
    if (!('id' in request)) return null;
    const known = designer.savedForm(request.id, request.version);
    if (known !== undefined) return known?.page ?? null;
    return designer.loadSavedForm(request.id).then(() => designer.savedForm(request.id, request.version)?.page ?? null);
  };

  function make(id: string): View {
    const title = el('span', { class: 'fd-canvas-form-title' });
    const tag = el('span', { class: 'fd-canvas-form-tag' });
    const open = el('button', { type: 'button', class: 'fd-button fd-button-link fd-canvas-form-open' }, 'Open it') as HTMLButtonElement;
    const note = el('p', { class: 'fd-canvas-form-note' });
    // Shown, never used: what is inside takes no focus and no click, so a click picks the saved form itself.
    const body = el('div', { class: 'fd-canvas-form-body', inert: '' });
    const head = el('div', { class: 'fd-canvas-form-head' }, designerIcon(doc, 'saved-form'), el('span', { class: 'fd-canvas-form-words' }, title, tag), open);
    const element = el('div', { class: 'fd-canvas-block fd-canvas-form', 'data-node': id }, head, note, body);
    const view: View = { element, title, tag, open, note, body, viewer: null, drawn: null, pageId: '' };
    open.addEventListener('click', () => designer.openForm(view.pageId));
    return view;
  }

  function unmount(view: View) {
    view.viewer?.destroy();
    view.viewer = null;
    view.drawn = null;
  }

  /** Inside the frame, the saved form's parts keep their own ids apart from the page's: the canvas finds the page's parts by theirs. */
  function apart(view: View) {
    for (const part of view.body.querySelectorAll('[data-node]')) {
      part.setAttribute('data-saved-node', part.getAttribute('data-node') as string);
      part.removeAttribute('data-node');
    }
  }

  return {
    draw(node, picked) {
      let view = views.get(node.id);
      if (!view) views.set(node.id, (view = make(node.id)));
      view.pageId = node.page;
      const known = designer.savedForm(node.page, node.version);
      const saved = known?.page ?? null;
      const name = saved?.title || node.page;
      // The words over it, as the form shows them: its own, the saved form's title, or none.
      const title = node.title ?? saved?.title ?? '';
      setText(view.title, title);
      setHidden(view.title, !title);
      setText(view.tag, `Saved form “${name}” · ${node.version === undefined ? 'latest version' : `version ${node.version}`}`);
      view.open.title = `Open “${name}” on its own page, to change it`;
      setHidden(view.open, !designer.canOpenForm());
      view.element.classList.toggle('fd-canvas-selected', picked);
      view.element.classList.toggle('fd-hidden-sometimes', node.invisible !== undefined);
      if (node.colspan) view.element.style.setProperty('--fd-span', String(node.colspan));
      else view.element.style.removeProperty('--fd-span');

      const problem = known === undefined ? null : designer.checks().find((check) => check.at === node.id && check.severity === 'must');
      const words = known === undefined ? `Loading “${node.page}”…` : problem ? problem.text : '';
      setText(view.note, words);
      setHidden(view.note, !words);
      view.note.classList.toggle('fd-canvas-form-problem', !!problem);
      if (!saved || problem) {
        unmount(view);
        view.body.replaceChildren();
        return view.element;
      }
      // Drawn by the viewer as the form draws it, in this page's look: the saved form's own title stands over the frame instead.
      const look = JSON.stringify(designer.getPage().look ?? null);
      if (view.drawn?.page !== saved || view.drawn.look !== look) {
        unmount(view);
        view.body.replaceChildren();
        try {
          view.viewer = mountViewer(view.body, {
            page: { ...saved, title: undefined, description: undefined, look: designer.getPage().look },
            readonly: true,
            showActions: false,
            skin: (options.skin ?? 'outlined') as 'outlined' | 'underline',
            widgets: options.widgets,
            pages,
          });
        } catch (error) {
          setText(view.note, `“${name}” cannot be shown: ${(error as Error).message.split('\n')[0]}`);
          setHidden(view.note, false);
        }
        view.drawn = { page: saved, look };
      }
      apart(view);
      return view.element;
    },
    keep(ids) {
      for (const [id, view] of views) {
        if (ids.has(id)) continue;
        unmount(view);
        view.element.remove();
        views.delete(id);
      }
    },
    destroy() {
      for (const view of views.values()) unmount(view);
      views.clear();
    },
  };
}
