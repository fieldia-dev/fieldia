import type { Page } from '@fieldia/core';
import { createDesigner, type DesignerAssistant } from '@fieldia/designer';
import { APP_KINDS } from './app-kinds';

/**
 * The demos' stand-in for an app's own assistant. Fieldia ships no AI: an
 * app hands the designer its own. This one is no AI either — it looks for a
 * few words ("contact", "rating", "date"…) and adds the questions they name,
 * after a short wait, as a real one would answer. It says so in the editor.
 */

/** A question the words ask for: its kind, its words, and whether it must be answered. */
interface Recipe {
  words: RegExp;
  kind: string;
  label: string;
  required?: boolean;
  choices?: string[];
}

const RECIPES: Recipe[] = [
  { words: /\b(contact|name|register|registration|sign[- ]?up)\b/, kind: 'short-answer', label: 'Full name', required: true },
  { words: /\b(contact|e-?mail|register|registration|sign[- ]?up)\b/, kind: 'email', label: 'Email', required: true },
  { words: /\b(contact|phone|mobile|call)\b/, kind: 'phone', label: 'Phone' },
  { words: /\b(address|where|deliver(y)?)\b/, kind: 'address', label: 'Address' },
  { words: /\b(iban|bank|refund|payout|account)\b/, kind: 'iban', label: 'Bank account (IBAN)' },
  { words: /\b(date|day|when|book(ing)?)\b/, kind: 'date', label: 'Which date suits you?' },
  { words: /\b(how many|number|guests|quantity|people)\b/, kind: 'number', label: 'How many people?' },
  { words: /\b(rating|rate|stars|satisf(ied|action)|feedback)\b/, kind: 'rating', label: 'How would you rate it?', required: true },
  { words: /\b(choice|choose|pick|option|which)\b/, kind: 'multiple-choice', label: 'Which do you prefer?', choices: ['The first', 'The second', 'Either'] },
  { words: /\b(feedback|comment|comments|improve|suggest(ion)?s?|notes?)\b/, kind: 'paragraph', label: 'Anything else you would like to tell us?' },
  { words: /\b(file|upload|cv|resume|photo|document)\b/, kind: 'file', label: 'Upload a file' },
  { words: /\b(agree|consent|terms|accept)\b/, kind: 'tick', label: 'I agree to the terms', required: true },
  { words: /\b(sign|signature)\b/, kind: 'signature', label: 'Signature' },
];

/** A title from the words: "a feedback form for a cooking class: …" is "Feedback form for a cooking class". */
function titleOf(prompt: string): string {
  const first = prompt.split(/[:.,;\n]/)[0].trim().replace(/^(a|an|the|i need|make|build)\s+/i, '');
  const short = first.length > 48 ? `${first.slice(0, 47).trimEnd()}…` : first;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** The fields a page shows: each place's id and its field's name. */
function placesOf(nodes: unknown[]): { id: string; field: string }[] {
  return (nodes as { type: string; id: string; field?: string; children?: unknown[] }[]).flatMap((n) => (n.type === 'field' && n.field ? [{ id: n.id, field: n.field }] : n.children ? placesOf(n.children) : []));
}

/**
 * The page with what the words ask for. On a page with parts, "required"
 * makes the questions it names required; otherwise the questions the words
 * name are added at its end, a blank page taking its title from the words.
 */
function build(prompt: string, page: Page): Page {
  const words = prompt.toLowerCase();
  const draft = createDesigner({ page, kinds: APP_KINDS });
  const blank = Object.keys(page.fields).length === 0;
  let changed = false;
  if (!blank && /\b(required|must)\b/.test(words)) {
    for (const place of placesOf((page.layout as { children: unknown[] }).children)) {
      const label = page.fields[place.field].label.toLowerCase();
      const named = label.split(/[^a-z]+/).some((w) => w.length > 3 && words.includes(w));
      if (named && draft.updateQuestion(place.id, { required: true })) changed = true;
    }
  } else {
    const have = new Set(Object.values(page.fields).map((f) => f.label));
    for (const recipe of RECIPES) {
      if (!recipe.words.test(words) || have.has(recipe.label)) continue;
      const id = draft.addQuestion(recipe.kind);
      if (!id) continue;
      draft.updateQuestion(id, { label: recipe.label, ...(recipe.required ? { required: true } : {}) });
      if (recipe.choices) draft.setOptions(id, recipe.choices);
      have.add(recipe.label);
      changed = true;
    }
  }
  if (!changed) throw new Error('The demo assistant knows only a few words: try contact, rating, date, address, IBAN, feedback, or “make the email required”.');
  if (blank) draft.setPageInfo({ title: titleOf(prompt) });
  return draft.getPage();
}

/** The demo assistant: an answer after `delay` milliseconds, or none once cancelled. */
export function demoAssistant(options: { delay?: number; locale?: string } = {}): DesignerAssistant {
  const delay = options.delay ?? 1200;
  // The app names its assistant in the designer's language, as an app would.
  const arabic = options.locale?.startsWith('ar');
  return {
    name: arabic ? 'مساعد تجريبي' : 'Demo assistant',
    note: arabic
      ? 'بديل لمساعد تطبيقك: يبحث عن كلمات مثل contact وrating وdate وIBAN. لا يأتي Fieldia بذكاء اصطناعي خاص به.'
      : 'A stand-in for your app’s own assistant: it looks for words such as contact, rating, date or IBAN. Fieldia ships no AI of its own.',
    describe({ prompt, page, signal }) {
      return new Promise<Page>((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            resolve(build(prompt, page));
          } catch (error) {
            reject(error);
          }
        }, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Cancelled'));
        });
      });
    },
  };
}
