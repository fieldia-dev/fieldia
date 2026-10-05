import type { FormNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { locate } from './layout-tree';
import { setting } from './panel-controls';
import type { BlockContent } from './panel-block';
import { setHidden } from './writes';

/**
 * A saved form's own settings, on the Content tab: which saved form, the
 * latest version or one kept to, its title, and where its answers go. What is
 * inside it is changed on its own page: “Open it”, when the app gives a way.
 */

const focused = (node: Element) => node.ownerDocument.activeElement === node;
const LATEST = 'latest';

export function formContent(el: ElementFactory, designer: Designer, id: string): BlockContent {
  const w = designer.words.savedForms;
  const partOf = (page: Page) => {
    const node = locate(page, id)?.node;
    return node?.type === 'form' ? node : null;
  };

  // ---- which saved form: the store's, loaded once; the one placed stays even when the store no longer has it ----
  const which = el('select', { class: 'fd-input fd-select', 'aria-label': w.savedForm }) as HTMLSelectElement;
  let listed: { id: string; title: string }[] | null = null;
  void designer.savedForms().then((found) => {
    listed = found;
    draw(designer.getPage());
  });
  which.addEventListener('change', async () => {
    const chosen = which.value;
    // Loaded first, with what it places: one that would hold this page is refused, saying why.
    await designer.loadSavedForm(chosen);
    if (!designer.setForm(id, { page: chosen, version: null })) draw(designer.getPage());
  });

  // ---- the latest version, or one kept to ----
  const version = el('select', { class: 'fd-input fd-select', 'aria-label': w.version }) as HTMLSelectElement;
  version.addEventListener('change', () => designer.setForm(id, { version: version.value === LATEST ? null : Number(version.value) }));

  // ---- its title: the saved form's own, words of this page's, or none ----
  const title = el('input', { class: 'fd-input', 'aria-label': w.title, autocomplete: 'off' }) as HTMLInputElement;
  title.addEventListener('input', () => designer.setForm(id, { title: title.value === '' ? null : title.value }));
  const showTitle = el('input', { type: 'checkbox', 'aria-label': w.showTitle }) as HTMLInputElement;
  showTitle.addEventListener('change', () => designer.setForm(id, { title: showTitle.checked ? null : '' }));

  // ---- where its answers go: kept once typed and left, a name half typed being no name yet ----
  const name = el('input', { class: 'fd-input', 'aria-label': w.answersGoUnder, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  name.addEventListener('change', () => {
    if (!designer.setForm(id, { name: name.value })) name.setAttribute('aria-invalid', 'true');
  });

  const open = el('button', { type: 'button', class: 'fd-button' }, w.openIt) as HTMLButtonElement;
  open.addEventListener('click', () => {
    const node = partOf(designer.getPage());
    if (node) designer.openForm(node.page);
  });
  const openRow = setting(el, 'content', 'Open it', open, { hint: w.openHint, words: w.openIt });

  function draw(page: Page) {
    const node = partOf(page);
    if (!node) return;
    // The saved forms to pick from, and the one placed even if the store has it no longer.
    const choices = [...(listed ?? [])];
    if (!choices.some((c) => c.id === node.page)) choices.unshift({ id: node.page, title: listed ? w.notFound(node.page) : node.page });
    const key = choices.map((c) => `${c.id}:${c.title}`).join('|');
    if (which.dataset['key'] !== key) {
      which.dataset['key'] = key;
      which.replaceChildren(...choices.map((c) => el('option', { value: c.id }, c.title)));
    }
    which.value = node.page;
    versions(node);
    const saved = designer.savedForm(node.page, node.version)?.page ?? designer.savedForm(node.page)?.page ?? null;
    title.placeholder = saved?.title ?? '';
    showTitle.checked = node.title !== '';
    setHidden(title, node.title === '');
    if (!focused(title) && node.title !== '') title.value = node.title ?? '';
    if (!focused(name)) {
      name.value = node.name;
      name.removeAttribute('aria-invalid');
    }
    setHidden(openRow, !designer.canOpenForm());
  }

  function versions(node: FormNode) {
    const known = designer.savedForm(node.page);
    const published = known ? [...known.versions].reverse() : [];
    const options: [string, string][] = [[LATEST, w.latest], ...published.map((v): [string, string] => [String(v.version), w.versionOn(v.version, v.publishedAt)])];
    // A version kept to that the store has not got still shows, as the Checks list names it.
    if (node.version !== undefined && !published.some((v) => v.version === node.version)) options.push([String(node.version), w.versionOnly(node.version)]);
    const key = options.map(([value, words]) => `${value}:${words}`).join('|');
    if (version.dataset['key'] !== key) {
      version.dataset['key'] = key;
      version.replaceChildren(...options.map(([value, words]) => el('option', { value }, words)));
    }
    version.value = node.version === undefined ? LATEST : String(node.version);
  }

  return {
    rows: [
      setting(el, 'content', 'Saved form', which, { words: w.savedForm }),
      setting(el, 'content', 'Version', version, { hint: w.versionHint, words: w.version }),
      setting(el, 'content', 'Title', [el('label', { class: 'fd-q-required' }, showTitle, el('span', {}, w.showTitle)), title], { hint: w.titleHint, words: w.title }),
      setting(el, 'content', 'Answers go under', name, { hint: w.answersHint, words: w.answersGoUnder }),
      openRow,
    ],
    update: draw,
  };
}
