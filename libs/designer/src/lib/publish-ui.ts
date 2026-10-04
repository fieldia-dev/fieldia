import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { designerIcon } from './icons';
import { openMenu } from './menu';
import { pageChanges, type PageCheck } from './page-checks';

/**
 * The bar's part in publishing: Checks, a count of what people would trip
 * over, opening a list with a fix for each; Publish, asking first with what
 * changed since the last version and holding back what must be fixed; and
 * the status, opening the versions published, any of them made the draft
 * again in one click.
 */

/** Put the cursor where a check says: a question's words, or its options. */
export type GoTo = (id: string, part: 'label' | 'options') => void;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const SEVERITY = { must: 'Must fix', should: 'Should fix' } as const;

function runFix(designer: Designer, check: PageCheck, goTo: GoTo) {
  const action = check.fix?.action;
  if (!action) return;
  if (action.kind === 'go') {
    designer.select(action.id);
    goTo(action.id, action.part);
  } else designer.fixCheck(check);
}

/** A check as a row: how much it matters, what it is, and its fix. */
function checkRow(el: ElementFactory, check: PageCheck, onFix: () => void): HTMLElement {
  const row = el('div', { class: 'fd-check', 'data-severity': check.severity }, el('span', { class: 'fd-check-severity' }, SEVERITY[check.severity]), el('p', { class: 'fd-check-text' }, check.text));
  if (check.fix) {
    const fix = el('button', { type: 'button', class: 'fd-button fd-check-fix' }, check.fix.label);
    fix.addEventListener('click', onFix);
    row.append(fix);
  }
  return row;
}

export function checksButton(el: ElementFactory, doc: Document, designer: Designer, goTo: GoTo) {
  const count = el('span', { class: 'fd-checks-count' });
  const element = el('button', { type: 'button', class: 'fd-button fd-checks-button', 'data-checks': '', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, designerIcon(doc, 'check'), el('span', { class: 'fd-checks-word' }, 'Checks'), count) as HTMLButtonElement;
  let open: (() => void) | null = null;

  function show() {
    const checks = designer.checks();
    const panel = el(
      'div',
      // It takes focus when it opens; with nothing to fix it has no button to take it, so it takes it itself.
      { class: 'fd-checks', role: 'dialog', 'aria-label': 'Checks before publishing', tabindex: '-1' },
      el('div', { class: 'fd-menu-title' }, checks.length ? `${checks.length} to look at before publishing` : 'All clear'),
      ...(checks.length
        ? checks.map((check) =>
            checkRow(el, check, () => {
              close();
              runFix(designer, check, goTo);
            })
          )
        : [el('p', { class: 'fd-check-text' }, 'Nothing here would stop people, or read wrong to them.')])
    );
    const onOutside = (event: Event) => {
      if (!panel.contains(event.target as Node) && !element.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
      element.focus();
    };
    // Not modal: Tab on past it closes it, rather than leaving it open over the page with no one in it.
    const onLeave = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && !panel.contains(next) && next !== element) close();
    };
    function close() {
      panel.remove();
      doc.removeEventListener('pointerdown', onOutside, true);
      panel.removeEventListener('keydown', onKey);
      panel.removeEventListener('focusout', onLeave);
      element.setAttribute('aria-expanded', 'false');
      open = null;
    }
    (element.closest('.fd-form') ?? doc.body).append(panel);
    const r = element.getBoundingClientRect();
    const width = panel.offsetWidth || 360;
    Object.assign(panel.style, { top: `${r.bottom + 6}px`, left: `${Math.max(8, Math.min(r.right - width, (doc.defaultView?.innerWidth ?? 1024) - width - 8))}px` });
    doc.addEventListener('pointerdown', onOutside, true);
    panel.addEventListener('keydown', onKey);
    panel.addEventListener('focusout', onLeave);
    element.setAttribute('aria-expanded', 'true');
    (panel.querySelector<HTMLElement>('button') ?? panel).focus();
    open = close;
  }
  element.addEventListener('click', () => (open ? open() : show()));

  return {
    element,
    update() {
      const checks = designer.checks();
      count.textContent = checks.length ? String(checks.length) : '✓';
      element.setAttribute('aria-label', checks.length ? `Checks: ${checks.length} to look at` : 'Checks: all clear');
      element.dataset['state'] = checks.some((c) => c.severity === 'must') ? 'must' : checks.length ? 'should' : 'clear';
    },
    destroy: () => open?.(),
  };
}

/** Publish, asked first: what changed since the last version, and what must be fixed before it can go. */
export function openPublishDialog(el: ElementFactory, designer: Designer, root: HTMLElement, goTo: GoTo): void {
  const doc = root.ownerDocument;
  const opener = doc.activeElement as HTMLElement | null;
  const state = designer.getState();
  const last = state.versions[state.versions.length - 1];
  const next = (last?.version ?? 0) + 1;
  const changes = pageChanges(last?.page ?? null, state.page);
  const must = designer.checks().filter((c) => c.severity === 'must');
  const id = `fd-publish-${next}-${Date.now()}`;

  const shown = changes.slice(0, 8);
  const list = el('ul', { class: 'fd-publish-changes' }, ...shown.map((c) => el('li', {}, c)), ...(changes.length > shown.length ? [el('li', { class: 'fd-publish-more' }, `and ${changes.length - shown.length} more`)] : []));
  const close = () => {
    backdrop.remove();
    opener?.focus?.();
  };
  const blocked = must.length
    ? el(
        'div',
        { class: 'fd-publish-blocked', role: 'alert' },
        el('p', { class: 'fd-publish-blocked-head' }, 'Must fix first'),
        ...must.map((check) =>
          checkRow(el, check, () => {
            close();
            runFix(designer, check, goTo);
          })
        )
      )
    : null;
  const failed = el('p', { class: 'fd-publish-failed', role: 'alert', hidden: '' });
  const keep = el('button', { type: 'button', class: 'fd-button' }, 'Keep editing');
  const publish = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, `Publish version ${next}`);
  keep.addEventListener('click', close);
  publish.addEventListener('click', async () => {
    publish.disabled = true;
    try {
      await designer.publish();
      close();
    } catch (error) {
      failed.hidden = false;
      failed.textContent = error instanceof Error ? error.message : 'It could not be published.';
      publish.disabled = false;
    }
  });
  const closeX = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': 'Close' }, '×');
  closeX.addEventListener('click', close);
  const box = el(
    'div',
    { class: 'fd-form-dialog fd-size-small fd-publish-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title`, tabindex: '-1' },
    el('div', { class: 'fd-form-dialog-head' }, el('h2', { class: 'fd-form-dialog-title', id: `${id}-title` }, `Publish version ${next}?`), closeX),
    el(
      'div',
      { class: 'fd-publish-body' },
      el('p', { class: 'fd-publish-lead' }, last ? `${changes.length} change${changes.length === 1 ? '' : 's'} since version ${last.version}:` : 'What people will get:'),
      list,
      ...(blocked ? [blocked] : []),
      el('p', { class: 'fd-properties-hint' }, last ? `People part-way through it keep the version they started. Version ${last.version} stays one click away, under the status.` : 'People part-way through it keep the version they started; later versions never change it under them.'),
      failed
    ),
    // Held back, not greyed out: the reason is right above.
    el('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }, keep, ...(must.length ? [] : [publish]))
  );
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-publish-backdrop' }, box);
  backdrop.addEventListener('pointerdown', (event) => event.target === backdrop && close());
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      // The keyboard stays in the dialog.
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => !e.closest('[hidden]'));
      const at = items.indexOf(doc.activeElement as HTMLElement);
      const to = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
      event.preventDefault();
      items[to]?.focus();
    }
  });
  root.append(backdrop);
  (must.length ? (blocked?.querySelector<HTMLElement>('button') ?? keep) : publish).focus();
}

/** The status, which opens the versions published: any of them made the draft again. */
export function versionsMenu(el: ElementFactory, designer: Designer, anchor: HTMLElement): void {
  const { versions } = designer.getState();
  const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const newest = [...versions].reverse();
  openMenu({
    el,
    anchor,
    title: 'Versions',
    actions: true,
    items: newest.map((v, i) => ({ id: String(v.version), label: `Version ${v.version} · ${i === 0 ? 'live · ' : ''}${when(v.publishedAt)}` })),
    note: versions.length ? 'Picking one makes it the draft; Undo brings back what was there. Nothing changes for people until it is published.' : 'Nothing published yet: publishing makes version 1.',
    onPick: (version) => designer.revertTo(Number(version)),
  });
}

export function statusWords(state: DesignerState): string {
  const last = state.versions[state.versions.length - 1];
  return !last ? 'Draft, not published yet' : state.unpublished ? 'Changes not published yet' : `Published · version ${last.version}`;
}
