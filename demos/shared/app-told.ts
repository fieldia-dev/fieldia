import type { ActionRequest, ActionResult, MemoryDataSource, Page, RecordId, Values } from '@fieldia/core';

/**
 * A button whose work is the app's — Send a reminder, Book a viewing, Share with a buyer, Archive — does nothing a
 * person can see in a demo, where no app stands behind it: the press looks lost. So a press whose steps only hand it to
 * the app, answered with nothing to show, says what the app was given, in plain words, as a toast: "The app was asked
 * to send a reminder for INV/2026/0042." An answer that shows something — words, values, a page, a file, the record
 * reloaded — is the app's own, and left as it is; so is a moment's call (`on.open`, `on.change.*`).
 */

/** What the demo knows to say it: the page its buttons are on, and the records they name. */
export interface Told {
  page: Page;
  source: Pick<MemoryDataSource, 'records'>;
}

/** Steps that show nothing of their own: what remains is the app's to show. */
const QUIET = new Set(['call', 'confirm', 'check']);

interface ButtonLike {
  id?: string;
  type?: string;
  label?: string;
  action?: string;
  field?: string;
  steps?: { do: string }[];
}

/** The button or stat button a request came from, and the model its records are of: a related list's own, or the page's. */
function buttonOf(page: Page, id: string): { button: ButtonLike; model: string } | null {
  const pageModel = page.data.kind === 'record' ? page.data.model : '';
  let found: { button: ButtonLike; model: string } | null = null;
  const walk = (value: unknown, model: string): void => {
    if (found || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((item) => walk(item, model));
    const node = value as ButtonLike & { model?: string };
    if (node.id === id && typeof node.label === 'string' && (node.action || node.steps)) {
      found = { button: node, model };
      return;
    }
    const inside = node.type === 'related' && typeof node.model === 'string' ? node.model : model;
    for (const [key, child] of Object.entries(node)) if (key !== 'fields') walk(child, inside);
  };
  walk(page.layout, pageModel);
  return found;
}

/** Whether an answer shows a person something of its own. */
function shows(answer: ActionResult | undefined): boolean {
  if (!answer) return false;
  const some = (values: Values | undefined) => !!values && Object.keys(values).length > 0;
  return !!(answer.say || answer.stop || answer.open || answer.file || answer.post || answer.reload || answer.record !== undefined || some(answer.values) || some(answer.stored));
}

/** A record's name as people read it: its page's title field, else the usual name fields. */
function nameOf(told: Told, model: string, id: RecordId): string {
  const values = told.source.records[model]?.[String(id)];
  const layout = told.page.layout as { title?: { field?: string } };
  const title = model === (told.page.data.kind === 'record' ? told.page.data.model : '') ? layout.title?.field : undefined;
  for (const field of [title, 'name', 'display_name', 'title', 'client']) {
    const value = field ? values?.[field] : undefined;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return String(id);
}

/** Names in a sentence: "A", "A and B", "A, B and C", "A, B and 3 more". */
function together(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/**
 * A button's words inside a sentence: each word written with a capital only to start it ("Reset to Draft", "Send &
 * Print") small; a word in capitals ("EDI") or with one inside it ("WhatsApp") kept as it is.
 */
const lowered = (label: string) => label.replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());

/** The words a press with nothing to show says: the app asked, what for, and the records it was given. */
export function toldWords(told: Told, request: ActionRequest): string | null {
  if (request.id.startsWith('on.')) return null;
  const found = buttonOf(told.page, request.id);
  if (!found) return null;
  const { button, model } = found;
  if ((button.steps ?? []).some((step) => !QUIET.has(step.do))) return null;
  const ids = request.recordIds?.length ? request.recordIds : request.recordId != null ? [request.recordId] : [];
  const names = together(ids.map((id) => nameOf(told, model, id)));
  const label = button.label ?? '';
  // A stat button's label names records (Sales, Invoices): the app is asked to show them.
  if (button.type !== 'button' && button.field) return `The app was asked to show ${label}${names ? ` for ${names}` : ''}.`;
  // "archive Nile Traders and Delta Foods"; "send a reminder for INV/2026/0042".
  const joint = label.trim().includes(' ') ? ' for ' : ' ';
  return `The app was asked to ${lowered(label)}${names ? `${joint}${names}` : ''}.`;
}

/** The app's answer, or — where it shows nothing — the words saying what the app was given. */
export async function sayWhatTheAppGot(told: Told, request: ActionRequest, answer: ActionResult | undefined | Promise<ActionResult | undefined>): Promise<ActionResult | undefined> {
  const answered = await answer;
  if (shows(answered)) return answered;
  const words = toldWords(told, request);
  return words ? { ...answered, say: { message: words, tone: 'info' } } : answered;
}
