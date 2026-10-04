import type { FieldNode, Page } from '@fieldia/core';
import type { AppKind, AppKindSettings } from './app-kinds';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { kindById, kindOfField } from './kinds';

/**
 * Where an app's kind shows in the editors beyond its tile: its own settings
 * on the picked field and on the panel's Content tab, and how its closed
 * card reads. The app draws them; these put them in place and keep them up
 * to date.
 */

/** The app's kind a field was made as, or null for one of Fieldia's or none. */
export function appKindOf(kind: string | null): AppKind | null {
  if (!kind) return null;
  try {
    return kindById(kind).app ?? null;
  } catch {
    return null;
  }
}

/** The app's settings for the field `id`, drawn by the app, saving through the designer. */
function drawSettings(el: ElementFactory, designer: Designer, id: string, app: AppKind): AppKindSettings | null {
  if (!app.settings) return null;
  const document = el('span').ownerDocument;
  return app.settings({ document, id, designer, set: (patch) => designer.setWidgetOptions(id, patch) });
}

/** The app's settings among the picked field's own, for `kind-settings`: none for one of Fieldia's kinds, or one with no settings. */
export function appKindSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): { element: HTMLElement; standsIn: false; refresh(page: Page, node: FieldNode): void } | null {
  const app = appKindOf(kind);
  const own = app ? drawSettings(el, designer, id, app) : null;
  if (!app || !own) return null;
  return { element: el('div', { class: 'fd-app-settings', 'data-kind': app.id }, own.element), standsIn: false, refresh: (page, node) => own.refresh(page, node) };
}

/** A row of the panel's Content tab with the app's settings, named after its kind; hidden for a field of another kind, or of the model. */
export function appKindPanel(el: ElementFactory, designer: Designer, id: string): { element: HTMLElement; update(page: Page, node: FieldNode): void } {
  const name = el('span', { class: 'fd-prop-name' });
  const box = el('div', { class: 'fd-app-settings' });
  const element = el('div', { class: 'fd-prop fd-set', 'data-tab': 'content', 'data-setting': 'Settings', hidden: '' }, name, box);
  let drawn: string | null = null;
  let own: AppKindSettings | null = null;
  return {
    element,
    update(page, node) {
      const app = designer.isFromModel(id) ? null : appKindOf(kindOfField(page.fields[node.field], node));
      const key = app?.settings ? app.id : '';
      if (key !== drawn) {
        drawn = key;
        own = app ? drawSettings(el, designer, id, app) : null;
        box.replaceChildren(...(own ? [own.element] : []));
        name.textContent = app?.label ?? '';
        element.dataset['setting'] = app && own ? `${app.label} settings` : 'Settings';
      }
      element.hidden = !own;
      own?.refresh(page, node);
    },
  };
}

/** How a closed card of an app's kind reads: its words on a dotted line, or its own drawing; null for its real widget. */
export function appKindPreview(el: ElementFactory, page: Page, node: FieldNode, kind: string | null): HTMLElement | null {
  const preview = appKindOf(kind)?.preview;
  if (typeof preview === 'string') return el('div', { class: 'fd-q-preview fd-q-preview-short' }, preview);
  if (typeof preview === 'function') return preview({ document: el('span').ownerDocument, page, node });
  return null;
}
