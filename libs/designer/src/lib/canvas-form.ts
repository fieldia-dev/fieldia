import type { FormNode, Page } from '@fieldia/core';
import { mountViewer, type PageRequest, type ViewerHandle } from '@fieldia/viewer';
import type { WidgetFactory } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { setHidden, setText } from './writes';

/**
 * A saved form placed in the page, on the canvas: drawn as the form will draw
 * it — by the viewer itself, placing it as the form does, its title over it —
 * inside a frame that names the saved form and the version it shows, with
 * “Open it”, the app's way to edit it on its own page. Nothing in it can be
 * typed in or picked here: it is changed on its own page. Picked, moved and
 * widened as any part is. While it loads, a quiet line; when it cannot be
 * shown — not found, a version gone, holding this page — what the Checks list
 * says of it.
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
  tag: HTMLElement;
  open: HTMLButtonElement;
  note: HTMLElement;
  body: HTMLElement;
  viewer: ViewerHandle | null;
  /** What the form inside was drawn from: drawn again only when it changes. */
  drawn: { page: Page; key: string } | null;
  /** The saved form it shows now, for “Open it”. */
  pageId: string;
}

/** A page of one part, the saved form placed as this page places it: what the form draws, without the page's own conditions round it. */
function placing(node: FormNode, look: Page['look']): Page {
  return {
    fieldia: '0.1',
    id: 'fieldia-designer-preview',
    data: { kind: 'responses' },
    fields: {},
    ...(look ? { look } : {}),
    layout: {
      type: 'sections',
      id: 'preview',
      children: [{ type: 'form', id: 'preview-part', page: node.page, name: node.name, ...(node.version === undefined ? {} : { version: node.version }), ...(node.title === undefined ? {} : { title: node.title }) }],
    },
  };
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
    const tag = el('span', { class: 'fd-canvas-form-tag' });
    const open = el('button', { type: 'button', class: 'fd-button fd-button-link fd-canvas-form-open' }, 'Open it') as HTMLButtonElement;
    const note = el('p', { class: 'fd-canvas-form-note' });
    // Shown, never used: what is inside takes no focus and no click, so a click picks the saved form itself.
    const body = el('div', { class: 'fd-canvas-form-body', inert: '' });
    const head = el('div', { class: 'fd-canvas-form-head' }, designerIcon(doc, 'saved-form'), tag, open);
    const element = el('div', { class: 'fd-canvas-block fd-canvas-form', 'data-node': id }, head, note, body);
    const view: View = { element, tag, open, note, body, viewer: null, drawn: null, pageId: '' };
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
      // Drawn by the viewer, placed as the form places it — its card, its title, its fields — in this page's look.
      const look = designer.getPage().look;
      const key = JSON.stringify([node.page, node.version ?? null, node.title ?? null, look ?? null]);
      if (view.drawn?.page !== saved || view.drawn.key !== key) {
        unmount(view);
        view.body.replaceChildren();
        try {
          view.viewer = mountViewer(view.body, { page: placing(node, look), showActions: false, skin: (options.skin ?? 'outlined') as 'outlined' | 'underline', widgets: options.widgets, pages });
        } catch (error) {
          setText(view.note, `“${name}” cannot be shown: ${(error as Error).message.split('\n')[0]}`);
          setHidden(view.note, false);
        }
        view.drawn = { page: saved, key };
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
