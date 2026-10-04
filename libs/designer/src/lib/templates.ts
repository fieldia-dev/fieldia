import { checkPage, validatePage, type Field, type FieldNode, type JsonValue, type Page } from '@fieldia/core';
import { kindById } from './kinds';
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
  /** A choice's options, by their words. */
  choices?: string[];
  /** More of the field, such as a table's columns. */
  field?: Record<string, unknown>;
  /** How its widget shows it, such as the words at a scale's ends. */
  look?: Record<string, JsonValue>;
  colspan?: number;
}
const ask = (name: string, kind: string, label: string, more: Omit<Ask, 'name' | 'kind' | 'label'> = {}): Ask => ({ name, kind, label, ...more });

const valueOf = (words: string) => words.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** A template's page: its groups — a survey's pages, a screen's sections — and their questions, each made as its kind makes it. */
function made(kind: 'survey' | 'screen', id: string, title: string, description: string, groups: [string, Ask[]][]): PageTemplate {
  const fields: Record<string, Field> = {};
  const nodes = (asks: Ask[]): FieldNode[] =>
    asks.map((a) => {
      const k = kindById(a.kind);
      const field = { ...k.field(a.label), ...(a.field ?? {}) } as Field & { required?: boolean; help?: string };
      if (a.required) field.required = true;
      if (a.help) field.help = a.help;
      if (a.choices && field.type === 'selection') field.options = a.choices.map((label) => ({ value: valueOf(label), label }));
      fields[a.name] = field;
      return { type: 'field', id: `q-${a.name.replace(/_/g, '-')}`, field: a.name, ...(k.widget ? { widget: k.widget } : {}), ...(a.look ? { options: a.look } : {}), ...(a.colspan ? { colspan: a.colspan } : {}) };
    });
  const layout: Page['layout'] =
    kind === 'survey'
      ? { type: 'wizard', id: 'steps', children: groups.map(([label, asks], i) => ({ type: 'step', id: `step-${i + 1}`, label, children: nodes(asks) })) }
      : { type: 'sections', id: 'sections', children: groups.map(([label, asks], i) => ({ type: 'section', id: `section-${i + 1}`, title: label, columns: 2, children: nodes(asks) })) };
  const data: Page['data'] = kind === 'survey' ? { kind: 'responses' } : { kind: 'record', model: id.replace(/-/g, '.') };
  return { id, title, description, page: { fieldia: '0.1', id, title, description, data, fields, layout } };
}

export const SURVEY_TEMPLATES: readonly PageTemplate[] = [
  made('survey', 'feedback', 'Feedback', 'How it went, and what to do better, in two minutes.', [
    [
      'Your feedback',
      [
        ask('overall', 'rating', 'How was it overall?', { required: true }),
        ask('liked', 'paragraph', 'What did you like most?'),
        ask('better', 'paragraph', 'What could we do better?'),
        ask('recommend', 'scale', 'How likely are you to recommend us?', { look: { startLabel: 'Not likely', endLabel: 'Very likely' } }),
        ask('email', 'email', 'Your email, for a reply', { help: 'Only if you would like us to answer.' }),
      ],
    ],
  ]),
  made('survey', 'event-registration', 'Event registration', 'Who is coming, and what they need on the day.', [
    [
      'About you',
      [
        ask('full_name', 'short-answer', 'Full name', { required: true }),
        ask('email', 'email', 'Email', { required: true }),
        ask('phone', 'phone', 'Phone'),
        ask('organisation', 'short-answer', 'Organisation'),
      ],
    ],
    [
      'Your place',
      [
        ask('sessions', 'checkboxes', 'Which sessions will you join?', { required: true, choices: ['Morning talks', 'Afternoon workshop', 'Evening dinner'] }),
        ask('diet', 'dropdown', 'Dietary needs', { choices: ['None', 'Vegetarian', 'Vegan', 'Gluten-free'] }),
        ask('notes', 'paragraph', 'Anything we should know?'),
      ],
    ],
  ]),
  made('survey', 'job-application', 'Job application', 'Applications with a CV, ready to compare.', [
    [
      'The role',
      [
        ask('role', 'dropdown', 'Which role are you applying for?', { required: true, choices: ['Sales', 'Engineering', 'Operations'] }),
        ask('cv', 'file', 'Your CV', { required: true }),
        ask('experience', 'number', 'Years of experience'),
        ask('start', 'date', 'When could you start?'),
        ask('why', 'paragraph', 'Why this role?'),
      ],
    ],
    [
      'About you',
      [
        ask('full_name', 'short-answer', 'Full name', { required: true }),
        ask('email', 'email', 'Email', { required: true }),
        ask('phone', 'phone', 'Phone'),
        ask('profile', 'short-answer', 'A link to your profile or work'),
      ],
    ],
  ]),
];

export const SCREEN_TEMPLATES: readonly PageTemplate[] = [
  made('screen', 'contact', 'Contact', 'A person’s details, and notes about them.', [
    [
      'Contact',
      [
        ask('name', 'short-answer', 'Name', { required: true }),
        ask('company', 'short-answer', 'Company'),
        ask('email', 'email', 'Email'),
        ask('phone', 'phone', 'Phone'),
        ask('website', 'website', 'Website'),
      ],
    ],
    ['Notes', [ask('notes', 'paragraph', 'Notes', { colspan: 2 })]],
  ]),
  made('screen', 'order-request', 'Order request', 'What a customer asks for, line by line.', [
    [
      'Order',
      [
        ask('customer', 'short-answer', 'Customer', { required: true }),
        ask('status', 'status', 'Status'),
        ask('ordered_on', 'date', 'Ordered on', { required: true }),
        ask('deliver_by', 'date', 'Deliver by'),
      ],
    ],
    [
      'Lines',
      [
        ask('lines', 'lines', 'Items', {
          colspan: 2,
          field: { fields: { name: { type: 'char', label: 'Description' }, quantity: { type: 'float', label: 'Quantity' }, price: { type: 'float', label: 'Unit price' } } },
        }),
        ask('total', 'amount', 'Estimated total'),
        ask('notes', 'paragraph', 'Notes'),
      ],
    ],
  ]),
];

/** The templates for a page: Fieldia's for a survey or a screen, then the app's that are made the same way. */
export function templatesFor(page: Page, app: readonly PageTemplate[] = []): PageTemplate[] {
  const survey = page.layout.type === 'wizard';
  return [...(survey ? SURVEY_TEMPLATES : SCREEN_TEMPLATES), ...app.filter((t) => (t.page.layout.type === 'wizard') === survey)];
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
  const problem = pageProblem(draft, next);
  if (problem) throw new Refusal(problem);
  const checked = checkPage(next) as { ok: true; page: Page };
  const { id, data } = draft;
  for (const key of Object.keys(draft)) delete (draft as unknown as Record<string, unknown>)[key];
  Object.assign(draft, JSON.parse(JSON.stringify(checked.page)), { id, data });
}

/** Why `next` cannot take the place of `page`, in words, or null when it can: it must be a page, made the way `page` is. */
export function pageProblem(page: Page, next: unknown): string | null {
  const checked = checkPage(next);
  if (!checked.ok) return `This is not a page the designer can open: ${checked.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`;
  const full = validatePage(next);
  if (!full.ok) return `This is not a page the designer can open: ${full.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`;
  const survey = page.layout.type === 'wizard';
  if (survey && checked.page.layout.type !== 'wizard') return 'A survey is made of pages of questions: this is a screen of sections';
  if (!survey && checked.page.layout.type === 'wizard') return 'A screen is made of sections: this is a survey’s pages of questions';
  return null;
}
