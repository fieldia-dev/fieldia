import { checkPage, validatePage, type Field, type FieldNode, type JsonValue, type Page } from '@fieldia/core';
import { kindById } from './kinds';
import { DESIGNER_WORDS, type DesignerLocale, type DesignerWords } from './designer-words';
import { en } from './locales/en';
import { Refusal } from './refusal';

/**
 * Pages to start from: a blank survey or screen offers a few sensible ones,
 * and the app adds its own. Each is a whole page, made of the designer's own
 * kinds, so every part of it is edited as if it had been added by hand.
 * Picking one puts it in place of the blank page, as one edit: the page
 * keeps its id and where its answers go, and takes the rest.
 */

export interface PageTemplate {
  id: string;
  title: string;
  /** One line saying what it is for. */
  description: string;
  page: Page;
}

/** A question of a template: its field's name, its kind, its words, and what it has beyond them. */
interface Ask {
  name: string;
  kind: string;
  label: string;
  required?: boolean;
  help?: string;
  /** A choice's options: each kept by the value its English words make, whatever the words. */
  choices?: { value: string; label: string }[];
  /** More of the field, such as a table's columns. */
  field?: Record<string, unknown>;
  /** How its widget shows it, such as the words at a scale's ends. */
  look?: Record<string, JsonValue>;
  colspan?: number;
}
const ask = (name: string, kind: string, label: string, more: Omit<Ask, 'name' | 'kind' | 'label'> = {}): Ask => ({ name, kind, label, ...more });

const valueOf = (words: string) => words.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
/** Options in the designer's words, valued by the English ones: a template's answers are stored the same in every language. */
const choices = (english: readonly string[], said: readonly string[]) => english.map((label, i) => ({ value: valueOf(label), label: said[i] ?? label }));

/** A template's page: its groups — a survey's pages, a screen's sections — and their questions, each made as its kind makes it. */
function made(kind: 'survey' | 'screen', id: string, title: string, description: string, groups: [string, Ask[]][], words: DesignerWords, language?: string): PageTemplate {
  const fields: Record<string, Field> = {};
  const nodes = (asks: Ask[]): FieldNode[] =>
    asks.map((a) => {
      const k = kindById(a.kind);
      const field = { ...k.field(a.label, words), ...(a.field ?? {}) } as Field & { required?: boolean; help?: string };
      if (a.required) field.required = true;
      if (a.help) field.help = a.help;
      if (a.choices && field.type === 'selection') field.options = a.choices;
      fields[a.name] = field;
      return { type: 'field', id: `q-${a.name.replace(/_/g, '-')}`, field: a.name, ...(k.widget ? { widget: k.widget } : {}), ...(a.look ? { options: a.look } : {}), ...(a.colspan ? { colspan: a.colspan } : {}) };
    });
  const layout: Page['layout'] =
    kind === 'survey'
      ? { type: 'wizard', id: 'steps', children: groups.map(([label, asks], i) => ({ type: 'step', id: `step-${i + 1}`, label, children: nodes(asks) })) }
      : { type: 'sections', id: 'sections', children: groups.map(([label, asks], i) => ({ type: 'section', id: `section-${i + 1}`, title: label, columns: 2, children: nodes(asks) })) };
  const data: Page['data'] = kind === 'survey' ? { kind: 'responses' } : { kind: 'record', model: id.replace(/-/g, '.') };
  // Written in another language than English: the page says so, and its form speaks it.
  return { id, title, description, page: { fieldia: '0.1', id, title, description, ...(language ? { language } : {}), data, fields, layout } };
}

/** Fieldia's surveys to start from, in the designer's language. */
export function surveyTemplates(locale: DesignerLocale = 'en'): PageTemplate[] {
  const words = DESIGNER_WORDS[locale];
  const language = locale === 'en' ? undefined : locale;
  const { feedback, event, job } = words.templates;
  const english = en.templates;
  return [
    made(
      'survey',
      'feedback',
      feedback.title,
      feedback.description,
      [
        [
          feedback.page,
          [
            ask('overall', 'rating', feedback.overall, { required: true }),
            ask('liked', 'paragraph', feedback.liked),
            ask('better', 'paragraph', feedback.better),
            ask('recommend', 'scale', feedback.recommend, { look: { startLabel: feedback.notLikely, endLabel: feedback.veryLikely } }),
            ask('email', 'email', feedback.email, { help: feedback.emailHelp }),
          ],
        ],
      ],
      words,
      language
    ),
    made(
      'survey',
      'event-registration',
      event.title,
      event.description,
      [
        [
          event.aboutYou,
          [
            ask('full_name', 'short-answer', event.fullName, { required: true }),
            ask('email', 'email', event.email, { required: true }),
            ask('phone', 'phone', event.phone),
            ask('organisation', 'short-answer', event.organisation),
          ],
        ],
        [
          event.yourPlace,
          [
            ask('sessions', 'checkboxes', event.sessions, { required: true, choices: choices(english.event.sessionChoices, event.sessionChoices) }),
            ask('diet', 'dropdown', event.diet, { choices: choices(english.event.dietChoices, event.dietChoices) }),
            ask('notes', 'paragraph', event.notes),
          ],
        ],
      ],
      words,
      language
    ),
    made(
      'survey',
      'job-application',
      job.title,
      job.description,
      [
        [
          job.theRole,
          [
            ask('role', 'dropdown', job.role, { required: true, choices: choices(english.job.roleChoices, job.roleChoices) }),
            ask('cv', 'file', job.cv, { required: true }),
            ask('experience', 'number', job.experience),
            ask('start', 'date', job.start),
            ask('why', 'paragraph', job.why),
          ],
        ],
        [
          job.aboutYou,
          [
            ask('full_name', 'short-answer', job.fullName, { required: true }),
            ask('email', 'email', job.email, { required: true }),
            ask('phone', 'phone', job.phone),
            ask('profile', 'short-answer', job.profile),
          ],
        ],
      ],
      words,
      language
    ),
  ];
}

/** Fieldia's screens to start from, in the designer's language. */
export function screenTemplates(locale: DesignerLocale = 'en'): PageTemplate[] {
  const words = DESIGNER_WORDS[locale];
  const language = locale === 'en' ? undefined : locale;
  const { contact, order } = words.templates;
  return [
    made(
      'screen',
      'contact',
      contact.title,
      contact.description,
      [
        [
          contact.contact,
          [
            ask('name', 'short-answer', contact.name, { required: true }),
            ask('company', 'short-answer', contact.company),
            ask('email', 'email', contact.email),
            ask('phone', 'phone', contact.phone),
            ask('website', 'website', contact.website),
          ],
        ],
        [contact.notes, [ask('notes', 'paragraph', contact.notes, { colspan: 2 })]],
      ],
      words,
      language
    ),
    made(
      'screen',
      'order-request',
      order.title,
      order.description,
      [
        [
          order.order,
          [
            ask('customer', 'short-answer', order.customer, { required: true }),
            ask('status', 'status', order.status),
            ask('ordered_on', 'date', order.orderedOn, { required: true }),
            ask('deliver_by', 'date', order.deliverBy),
          ],
        ],
        [
          order.lines,
          [
            ask('lines', 'lines', order.items, {
              colspan: 2,
              field: { fields: { name: { type: 'char', label: order.lineDescription }, quantity: { type: 'float', label: order.quantity }, price: { type: 'float', label: order.unitPrice } } },
            }),
            ask('total', 'amount', order.total),
            ask('notes', 'paragraph', order.notes),
          ],
        ],
      ],
      words,
      language
    ),
  ];
}

/** Fieldia's templates in English, as they always were. */
export const SURVEY_TEMPLATES: readonly PageTemplate[] = surveyTemplates('en');
export const SCREEN_TEMPLATES: readonly PageTemplate[] = screenTemplates('en');

/** The templates for a page: Fieldia's for a survey or a screen, then the app's that are made the same way. */
export function templatesFor(page: Page, app: readonly PageTemplate[] = [], locale: DesignerLocale = 'en'): PageTemplate[] {
  const survey = page.layout.type === 'wizard';
  const own = locale === 'en' ? (survey ? SURVEY_TEMPLATES : SCREEN_TEMPLATES) : survey ? surveyTemplates(locale) : screenTemplates(locale);
  return [...own, ...app.filter((t) => (t.page.layout.type === 'wizard') === survey)];
}

/** Whether a page has nothing of its own yet: a survey's empty pages, or a screen's empty sections. A sheet and a list start with a field, so they never are. */
export function isBlank(page: Page): boolean {
  const layout = page.layout;
  if (layout.type !== 'wizard' && layout.type !== 'sections') return false;
  if (Object.keys(page.fields).length) return false;
  return (layout.children as { type: string; children?: unknown[] }[]).every((c) => (c.type === 'step' || c.type === 'section') && !c.children?.length);
}

/**
 * Make `draft` the page `next`, keeping its id and where its answers go: a
 * survey takes only a survey, a screen only a screen. Refused, saying why,
 * for what is not a page the designer can open.
 */
export function replaceWith(draft: Page, next: unknown): void {
  if (pageProblem(draft, next)) throw new Refusal((w) => pageProblem(draft, next, w) as string);
  const checked = checkPage(next) as { ok: true; page: Page };
  const { id, data } = draft;
  for (const key of Object.keys(draft)) delete (draft as unknown as Record<string, unknown>)[key];
  Object.assign(draft, JSON.parse(JSON.stringify(checked.page)), { id, data });
}

/** Why `next` cannot take the place of `page`, in words, or null when it can: it must be a page, made the way `page` is. */
export function pageProblem(page: Page, next: unknown, words: DesignerWords = en): string | null {
  const w = words.templates;
  // The format's own words (from @fieldia/core): as it writes them.
  const issues = (found: { path: string; message: string }[]) => found.map((i) => `${i.path}: ${i.message}`).join('; ');
  const checked = checkPage(next);
  if (!checked.ok) return w.notAPage(issues(checked.issues));
  const full = validatePage(next);
  if (!full.ok) return w.notAPage(issues(full.issues));
  const survey = page.layout.type === 'wizard';
  if (survey && checked.page.layout.type !== 'wizard') return w.surveyNotScreen;
  if (!survey && checked.page.layout.type === 'wizard') return w.screenNotSurvey;
  return null;
}
