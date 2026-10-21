import type { DataSource, Facet, ListNode, Page, SavedView, Tone, ViewState, ViewsRequest } from '@fieldia/core';
import { drawIcon, type IconSet } from '@fieldia/widgets';
import type { El } from './dom';
import type { Favourites, FavouritesContext } from './favourites';
import type { ViewerLabels } from './labels';

/** A source that keeps a list's views on the app's server: `views`, and `saveView` and `deleteView` where it has them. */
export type ViewsSource = Required<Pick<DataSource, 'views'>> & Pick<DataSource, 'saveView' | 'deleteView'>;

export interface SavedViewsContext {
  page: Page;
  node: ListNode;
  model: string;
  source: ViewsSource;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  icons?: IconSet;
  doc: Document;
  /** How the list stands now: its search, its keys, its columns. */
  state: () => ViewState;
  /** Put the list's order and its columns as a view keeps them; its search comes after, as the menu's own. */
  put: (state: ViewState) => void;
  /** A question answered Yes or No: whether a view shared with the team is deleted for everyone. Asked of no one without it. */
  ask?: (message: string) => Promise<boolean>;
  say?: (message: string, tone: Tone) => void;
}

export interface SavedViews {
  /**
   * The list's views asked of the source as it opens, before its records: the one it opens on — the person's own
   * default, else the team's — or null (none, or the source could not answer: the menu then says so, with Retry).
   */
  start(): Promise<SavedView | null>;
  /** The search bar's favourites, drawn from the views (searchBar's `favourites`). */
  part(context: FavouritesContext): Favourites;
}

/** The view a list opens on: the person's own default first, else the team's. */
export const openingView = (views: readonly SavedView[]): SavedView | null =>
  views.find((view) => view.isDefault && view.mine && !view.shared) ?? views.find((view) => view.isDefault && view.mine) ?? views.find((view) => view.isDefault && view.shared) ?? null;

/** Why a call failed, in the source's words where it gave some. */
const why = (error: unknown) => (error instanceof Error && error.message ? error.message.replace(/[.\s]+$/, '') : '');

/**
 * A list's views kept on the app's server, in the search bar's menu where its favourites were: the person's own and
 * those shared with the team (each marked, another's with who made it), each put on with a press — its search, its
 * order and its columns; Save current search with its name, Use by default and Share with the team, where the source
 * keeps views (`saveView`); a person's own deleted with ×, where it deletes them (`deleteView`), a shared one asked
 * first. The same on every device: nothing of it is kept in the browser.
 */
export function savedViews(context: SavedViewsContext): SavedViews {
  const { page, node, model, source, el, labels, fill, doc } = context;
  const request: ViewsRequest = { pageId: page.id, model, list: node.id };
  let views: SavedView[] = [];
  /** The source could not answer: said in the menu, with Retry. */
  let failed = false;
  /** Each ask counts on: an older answer is not drawn over a newer one's. */
  let asking = 0;
  /** What the menu draws again once views come. */
  let redraw: () => void = () => undefined;

  async function asked(): Promise<void> {
    const mine = ++asking;
    try {
      const answer = await source.views(request);
      if (mine !== asking) return;
      views = Array.isArray(answer) ? answer : [];
      failed = false;
    } catch {
      if (mine !== asking) return;
      failed = true;
    }
    redraw();
  }

  function part(menu: FavouritesContext): Favourites {
    const list = el('ul', { class: 'fd-favourite-list fd-view-list' });
    const none = el('p', { class: 'fd-favourites-none' }, labels.noFavourites);
    const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
    const failedWords = el('p', { class: 'fd-favourites-none fd-views-failed', role: 'alert', hidden: '' }, labels.viewsFailed, ' ', retry);
    retry.addEventListener('click', () => void asked());
    const name = el('input', { class: 'fd-input', 'aria-label': labels.searchName, placeholder: labels.searchName });
    const byDefault = el('input', { type: 'checkbox' });
    const shared = el('input', { type: 'checkbox' });
    const save = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.save);
    const refused = el('p', { class: 'fd-view-refused', role: 'alert', hidden: '' });
    const form = el(
      'div',
      { class: 'fd-favourite-form', hidden: '' },
      name,
      el('label', { class: 'fd-favourite-default' }, byDefault, labels.useByDefault),
      el('label', { class: 'fd-favourite-default' }, shared, labels.shareView),
      refused,
      save
    );
    const open = el('button', { type: 'button', class: 'fd-search-option fd-search-add', 'aria-expanded': 'false' }, labels.saveSearch);
    // Without saveView, views are put on, and none is saved.
    open.hidden = !source.saveView;
    let slots: { slot: HTMLElement; name: string; facets: Facet[] }[] = [];

    const teamIcon = () => {
      const drawn = drawIcon(doc, 'team', { team: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>', ...context.icons });
      drawn?.setAttribute('aria-hidden', 'true');
      return drawn ? [drawn] : [];
    };

    function draw() {
      none.hidden = failed || views.length > 0;
      failedWords.hidden = !failed;
      slots = [];
      list.replaceChildren(
        ...views.map((view) => {
          const slot = menu.slot?.();
          if (slot) slots.push({ slot, name: view.name, facets: view.state.facets });
          // Shared: a mark and its words — the person's own "Shared with the team", another's "Shared by Mona Adel".
          const whose = view.shared ? (view.mine || !view.by ? labels.viewShared : fill(labels.viewSharedBy, { name: view.by })) : null;
          const use = el(
            'button',
            { type: 'button', class: 'fd-search-option', 'data-default': view.isDefault ? 'true' : undefined, 'data-view': view.id },
            // Its name whole, and under it whose it is, as narrow as the menu's column is.
            el('span', { class: 'fd-view-words' }, el('span', { class: 'fd-view-name' }, view.name), ...(whose ? [el('span', { class: 'fd-view-shared' }, ...teamIcon(), el('span', { class: 'fd-view-whose' }, whose))] : [])),
            ...(slot ? [slot] : [])
          );
          use.addEventListener('click', () => {
            context.put(view.state);
            menu.apply(view.state.facets);
          });
          const item = el('li', { class: 'fd-favourite', 'data-shared': view.shared ? '' : undefined }, use);
          // The person's own alone, where the source deletes them: a shared one asked first, as it goes for everyone.
          if (view.mine && source.deleteView) {
            const remove = el('button', { type: 'button', class: 'fd-favourite-remove', 'aria-label': fill(labels.deleteFavourite, { name: view.name }) }, '×');
            remove.addEventListener('click', () => void drop(view, remove));
            item.append(remove);
          }
          return item;
        })
      );
      menu.drawn?.();
    }
    redraw = draw;

    async function drop(view: SavedView, button: HTMLElement) {
      if (view.shared && context.ask && !(await context.ask(fill(labels.viewDeleteAsk, { name: view.name })))) return;
      button.setAttribute('aria-busy', 'true');
      try {
        await source.deleteView?.({ ...request, id: view.id });
      } catch (error) {
        context.say?.(fill(labels.viewNotDeleted, { name: view.name, why: why(error) || labels.viewsFailed }), 'danger');
        button.removeAttribute('aria-busy');
        return;
      }
      await asked();
      open.focus();
    }

    open.addEventListener('click', () => {
      form.hidden = !form.hidden;
      open.setAttribute('aria-expanded', String(!form.hidden));
      refused.hidden = true;
      if (!form.hidden) name.focus();
    });
    save.addEventListener('click', () => void keep());
    name.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      void keep();
    });

    async function keep() {
      const named = name.value.trim();
      if (!named) return name.focus();
      if (!source.saveView || save.hasAttribute('aria-busy')) return;
      // A name of the person's own kept again takes its place, as a favourite's does; another's is never written over.
      const same = views.find((view) => view.mine && view.name === named);
      const state = { ...context.state(), facets: menu.current() };
      save.setAttribute('aria-busy', 'true');
      refused.hidden = true;
      try {
        await source.saveView({ ...request, view: { ...(same ? { id: same.id } : {}), name: named, state, ...(shared.checked ? { shared: true } : {}), ...(byDefault.checked ? { isDefault: true } : {}) } });
      } catch (error) {
        refused.textContent = fill(labels.viewNotSaved, { why: why(error) || labels.viewsFailed });
        refused.hidden = false;
        return;
      } finally {
        save.removeAttribute('aria-busy');
      }
      name.value = '';
      byDefault.checked = shared.checked = false;
      form.hidden = true;
      open.setAttribute('aria-expanded', 'false');
      await asked();
      open.focus();
    }

    draw();
    return { list, none: el('div', {}, none, failedWords), open, form, slots: () => slots };
  }

  return {
    async start() {
      await asked();
      return openingView(views);
    },
    part,
  };
}
