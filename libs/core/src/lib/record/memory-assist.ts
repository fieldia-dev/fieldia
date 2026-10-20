import type { Field, LineField, Option } from '../format/field';
import type { JsonValue } from '../format/json';
import type { ResolvedFilterCondition, RewriteRequest, RewriteResult, SearchToFilterRequest, SearchToFilterResult, SuggestRequest, SuggestResult, UploadFile } from './data-source';
import { foldForSearch } from './input-rules';
import type { MemoryAssist } from './memory-data-source';
import type { Values } from './values';

/**
 * A stand-in for an app's AI, for demos and tests: no model, no keys, nothing sent anywhere — words read by their
 * patterns, the same every time. `createMemoryDataSource({ assist: assistStandIn() })` answers AI help with it:
 *
 * - **suggest**: an e-mail signature or a message read line by line — a person's name (two to four words with
 *   capitals), a job title and a company (by the words they hold: "Director", "Ltd", "Traders"), e-mails, phones (a
 *   mobile by its "M:" or "Mobile"), a website, a street, a city and a country (the country among the records a link
 *   can point to), a tax id — each given to the field whose name or label says it holds one; a choice by an option's
 *   words in the text, a number by the words of its label beside it ("3 bedrooms"); a table's lines as the person
 *   found (a name with an e-mail, a phone or a job), or as lines of "2 x Dental chair @ 4,500". Text files are read;
 *   any other file is said not to be.
 * - **rewrite**: a draft from a template of the app's (`drafts`, by `model.field`), else a short reply that greets the
 *   person the record names; polish puts capitals and full stops in, writes out "u", "pls", "asap" and the like, and
 *   tidies the spaces.
 * - **searchToFilter**: "villas in New Cairo under 15M" — a choice's options and a link's records by their names
 *   (singular or plural, the longest first), a number by "under", "over", "between … and …", "3+" and the words of a
 *   field's label or unit beside it ("3 bedrooms", "200 m²"), else the first amount; "15M", "2.5 million", "800k".
 *
 * Every answer says so in its `why`: "Stand-in AI, no model: …". An app answers with its own model instead.
 */
export interface StandInOptions {
  /** A draft's words, by the text field's `model.field` (or `pageId.field`), from the record: a template of the app's. */
  drafts?: Record<string, (values: Values, request: RewriteRequest) => string>;
}

type Records = Readonly<Record<string, Record<string, Values>>>;

const STAND_IN = 'Stand-in AI, no model:';

/** Words as they are compared: small letters, no accents or marks, digits as 0-9, Arabic letters folded. */
const fold = (text: string) => foldForSearch(text).normalize('NFD').replace(/[̀-ͯ]/g, '');
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words of `words` in `text` (both folded), as a pattern: a word's plural too ("villa", "villas", "cities"). */
const wordsPattern = (words: string) => {
  const body = escape(words).replace(/\s+/g, '\\s+');
  const plural = /y$/.test(words) ? `(?:${body}|${escape(words.slice(0, -1))}ies)` : `${body}(?:e?s)?`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${plural}(?![\\p{L}\\p{N}])`, 'u');
};

/** A record's name, as a search finds it: its `name`, else its `label`, `title` or `display_name`. */
const nameOf = (values: Values): string | null => {
  for (const key of ['name', 'label', 'title', 'display_name']) if (typeof values[key] === 'string' && (values[key] as string).trim()) return values[key] as string;
  return null;
};

/** A number as people write it in a search or a message: "15M", "2.5 million", "800k", "15,000,000", "1.5". */
export function standInNumber(digits: string, unit = ''): number | null {
  const clean = digits.replace(/\s/g, '');
  // "15,000,000" and "15.000.000" group by threes; "1.5" and "1,5" are a fraction.
  const grouped = /^\d{1,3}([,.]\d{3})+$/.test(clean) && !/^\d{1,3}[,.]\d{3}$/.test(clean) ? clean.replace(/[,.]/g, '') : /^\d{1,3},\d{3}$/.test(clean) ? clean.replace(',', '') : clean.replace(',', '.');
  const value = Number(grouped);
  if (!Number.isFinite(value)) return null;
  const times = /^(k|thousand)$/i.test(unit) ? 1e3 : /^(m|mn|mio|million|millions)$/i.test(unit) ? 1e6 : /^(bn|b|billion|billions)$/i.test(unit) ? 1e9 : 1;
  return Math.round(value * times * 100) / 100;
}

// ---- reading a signature or a message --------------------------------------------------------------------------

const TITLE_WORDS = /\b(manager|director|head|lead|engineer|officer|ceo|cfo|coo|cto|cmo|founder|co-founder|partner|consultant|specialist|coordinator|executive|president|vice|agent|broker|analyst|accountant|designer|developer|assistant|supervisor|owner|associate|advisor|adviser|representative|administrator|architect|doctor|dr\.?|nurse|lawyer|counsel)\b/i;
const COMPANY_WORDS = /\b(ltd|llc|l\.l\.c|inc|co|corp|corporation|company|group|gmbh|sae|s\.a\.e|plc|traders|trading|holding|holdings|developments|development|realty|properties|industries|foods|clinic|clinics|hospital|bank|partners|studio|agency|solutions|systems|consulting|logistics|pharma|labs?)\b\.?/i;
const STREET_WORDS = /\b(st|street|rd|road|ave|avenue|blvd|boulevard|sq|square|floor|building|bldg|tower|district|corniche|way|lane|plaza)\b/i;
const CLOSINGS = /^(best|kind|warm)?\s*(regards|wishes)|^thanks|^thank you|^cheers|^sincerely|^sent from|^--+$|^__+$|^(hi|hello|dear)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL = /\b(?:https?:\/\/[^\s<>()]+|www\.[\w-]+(?:\.[\w-]+)+(?:\/[^\s<>()]*)?)/gi;
const PHONE = /(?:\+|00)?\d[\d\s().-]{6,}\d/g;
const TAX = /\b(?:vat|tax(?:\s*(?:id|no\.?|number|reg(?:istration)?(?:\s*no\.?)?))?|trn)\b\s*[:#.]?\s*([A-Z0-9][A-Z0-9 -]{3,}[A-Z0-9])/i;
const ONE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const ONE_URL = /\b(?:https?:\/\/\S+|www\.[\w-]+(?:\.[\w-]+)+)/i;
const PERSON = /^[\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){1,3}$|^[؀-ۿ]+(?:\s+[؀-ۿ]+){1,3}$/u;

/** What a signature or a message holds, as a stand-in reads it. */
export interface StandInFound {
  person?: string;
  title?: string;
  company?: string;
  emails: string[];
  phones: string[];
  mobile?: string;
  website?: string;
  street?: string;
  city?: string;
  /** The last part of an address: a country's name, looked for among the records later. */
  place?: string;
  tax?: string;
}

/** A signature or a message, read line by line by its patterns. */
export function readSignature(text: string): StandInFound {
  const found: StandInFound = { emails: [...new Set(text.match(EMAIL) ?? [])], phones: [] };
  // A line each, or parts of one line apart with a middle dot, as a signature copied on one line has them.
  const lines = text.split(/\r?\n|\s[·•]\s/).map((line) => line.trim()).filter(Boolean);
  const website = text.replace(EMAIL, ' ').match(URL)?.[0];
  if (website) found.website = /^https?:\/\//i.test(website) ? website.replace(/[.,;]+$/, '') : `https://${website.replace(/[.,;]+$/, '')}`;
  const tax = TAX.exec(text);
  if (tax) found.tax = tax[1].trim();
  for (const line of lines) {
    const plain = line.replace(EMAIL, ' ').replace(URL, ' ');
    // A tax id's digits are no phone's.
    for (const match of (tax && line.includes(tax[1]) ? '' : plain).match(PHONE) ?? []) {
      const number = match.trim();
      if (number.replace(/\D/g, '').length < 7) continue;
      if (/\b(m|mob|mobile|cell|whatsapp)\b\s*[:.]?/i.test(line) && !found.mobile) found.mobile = number;
      else found.phones.push(number);
    }
  }
  if (found.mobile && !found.phones.length) found.phones.push(found.mobile);
  for (const line of lines) {
    // A greeting, a sign-off, an e-mail's, a website's or a phone's line names no one; an address keeps its numbers.
    const address = /,/.test(line) && STREET_WORDS.test(line);
    if (!address && (CLOSINGS.test(line) || ONE_EMAIL.test(line) || ONE_URL.test(line) || /\d{5,}/.test(line.replace(/[\s().+-]/g, '')))) continue;
    // "Sales Director | Nile Traders", "Sales Director, Nile Traders", "Sales Director at Nile Traders".
    const split = /^(.+?)\s*(?:\||·|•|–|—|,| at | @ )\s*(.+)$/.exec(line);
    if (!found.title && TITLE_WORDS.test(line)) {
      if (split && TITLE_WORDS.test(split[1]) && !TITLE_WORDS.test(split[2])) {
        found.title = split[1].trim();
        if (!found.company) found.company = split[2].trim();
      } else if (!STREET_WORDS.test(line)) found.title = line;
      continue;
    }
    if (!found.company && COMPANY_WORDS.test(line) && !STREET_WORDS.test(line) && !/\d/.test(line)) {
      found.company = line;
      continue;
    }
    if (!found.street && (STREET_WORDS.test(line) || /^\d+\s+\p{L}/u.test(line)) && line.length > 6) {
      const parts = line.split(/\s*,\s*/).filter(Boolean);
      found.street = parts.length > 2 ? parts.slice(0, -2).join(', ') : parts[0];
      if (parts.length > 2) {
        found.city = parts[parts.length - 2];
        found.place = parts[parts.length - 1];
      } else if (parts.length === 2) found.city = parts[1];
      continue;
    }
    if (!found.person && PERSON.test(line) && !COMPANY_WORDS.test(line) && !TITLE_WORDS.test(line) && !STREET_WORDS.test(line)) found.person = line;
  }
  return found;
}

/** What a field holds, by its name and its label: an e-mail, a phone, a website, a job, a company, a person's name… */
function roleOf(name: string, def: Field | LineField): string | null {
  const words = fold(`${name.replace(/_/g, ' ')} ${def.label}`);
  if (/e-?mail/.test(words)) return 'email';
  if (/mobile|whatsapp|cell/.test(words)) return 'mobile';
  if (/phone|tel\b|telephone/.test(words)) return 'phone';
  if (/website|web site|\burl\b|homepage|\bweb\b/.test(words)) return 'website';
  if (/\bvat\b|\btax\b|\btrn\b/.test(words)) return 'tax';
  if (/\bjob\b|position|\bfunction\b|\brole\b|job title/.test(words)) return 'title';
  if (/company|organi[sz]ation|employer|business|\bfirm\b|account name/.test(words)) return 'company';
  if (/street|address/.test(words)) return 'street';
  if (/\bcity\b|\btown\b/.test(words)) return 'city';
  if (/\bname\b|contact|person/.test(words)) return 'person';
  return null;
}

/** A record of `model` named in `text` (folded), the longest name first: `{ id, label }`, or null. */
function recordIn(text: string, model: string | undefined, records: Records): { id: JsonValue; label: string } | null {
  if (!model) return null;
  const named = Object.entries(records[model] ?? {})
    .map(([id, values]) => ({ id, label: nameOf(values) }))
    .filter((one): one is { id: string; label: string } => !!one.label && one.label.trim().length > 1)
    .sort((a, b) => b.label.length - a.label.length);
  const one = named.find((record) => wordsPattern(fold(record.label)).test(text));
  return one ? { id: /^\d+$/.test(one.id) ? Number(one.id) : one.id, label: one.label } : null;
}

/** An option of a choice named in `text` (folded), the longest words first. */
const optionIn = (text: string, options: readonly Option[]) => [...options].sort((a, b) => b.label.length - a.label.length).find((option) => wordsPattern(fold(option.label)).test(text));

/** A number beside the words of a field's label in `text`: "3 bedrooms", "Budget: 12M". */
function numberBy(text: string, def: Field | LineField): number | null {
  const words = fold(def.label).split(/[^\p{L}]+/u).filter((word) => word.length > 2);
  for (const word of words) {
    const stem = escape(word.replace(/s$/, ''));
    const after = new RegExp(`(\\d[\\d.,]*)\\s*(k|m|mn|million|thousand|bn)?\\s+${stem}`, 'iu').exec(text);
    const before = new RegExp(`${stem}\\w*(?:\\s*(?:of|:|is|-|about|around|roughly|up to|max|maximum|under|below|egp|le|usd|\\$))*\\s*(\\d[\\d.,]*)\\s*(k|m|mn|million|thousand|bn)?(?![\\p{L}²\\d])`, 'iu').exec(text);
    const hit = after ?? before;
    if (hit) return standInNumber(hit[1], hit[2] ?? '');
  }
  return null;
}

/** Lines of things to add: "2 x Dental chair @ 4,500", "3 × Botox 50u", "- 5 pcs Gloves". */
const LINE_ITEM = /^\s*[-*•]?\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|pcs|pieces|units?|no\.?)\s+(.+?)(?:\s+(?:@|at)\s+([\d.,]+))?\s*$/i;

function linesFrom(text: string, found: StandInFound, def: Field | LineField, records: Records): Values[] {
  const fields = (def as { fields?: Record<string, LineField> }).fields ?? {};
  const roles = Object.entries(fields).map(([name, sub]) => [name, sub, roleOf(name, sub)] as const);
  const personal = roles.some(([, , role]) => role === 'person') && roles.some(([, , role]) => role === 'email' || role === 'phone' || role === 'title' || role === 'mobile');
  if (personal && found.person) {
    const line: Values = {};
    for (const [name, sub, role] of roles) {
      const value = valueFor(role, found, sub, text, records);
      if (value !== undefined) line[name] = value;
    }
    return [line];
  }
  // Things to add, each a line: its quantity, its name (a product by its record), its price.
  const quantity = roles.find(([, sub]) => sub.type === 'integer' || sub.type === 'float')?.[0];
  const price = roles.find(([, sub]) => sub.type === 'monetary')?.[0] ?? roles.find(([name, sub]) => sub.type === 'float' && name !== quantity)?.[0];
  const what = roles.find(([, sub]) => sub.type === 'many2one')?.[0] ?? roles.find(([, sub]) => sub.type === 'char' || sub.type === 'text')?.[0];
  if (!what) return [];
  return text.split(/\r?\n/).flatMap((line): Values[] => {
    const item = LINE_ITEM.exec(line);
    if (!item) return [];
    const sub = fields[what];
    const name = item[2].trim();
    const link = sub.type === 'many2one' ? (recordIn(fold(name), (sub as { relation?: string }).relation, records) ?? name) : name;
    return [{ [what]: link as JsonValue, ...(quantity ? { [quantity]: standInNumber(item[1]) } : {}), ...(price && item[3] ? { [price]: standInNumber(item[3]) } : {}) }];
  });
}

function valueFor(role: string | null, found: StandInFound, def: Field | LineField, text: string, records: Records): JsonValue | undefined {
  const folded = fold(text);
  if (def.type === 'many2one') return (role === 'company' && found.company ? found.company : recordIn(folded, (def as { relation?: string }).relation, records)) ?? undefined;
  if (def.type === 'selection') return optionIn(folded, (def as { options?: Option[] }).options ?? [])?.value;
  if (def.type === 'integer' || def.type === 'float' || def.type === 'monetary') return numberBy(folded, def) ?? undefined;
  if (def.type !== 'char' && def.type !== 'text') return undefined;
  switch (role) {
    case 'email':
      return found.emails[0];
    case 'mobile':
      return found.mobile ?? found.phones[1];
    case 'phone':
      return found.phones[0];
    case 'website':
      return found.website;
    case 'tax':
      return found.tax;
    case 'title':
      return found.title;
    case 'company':
      return found.company;
    case 'street':
      return found.street;
    case 'city':
      return found.city;
    case 'person':
      return found.person;
    default:
      return undefined;
  }
}

/** What a file holds as words, where it is text; null for any other file. */
async function fileText(file: UploadFile): Promise<string | null> {
  if (!/^text\/|json|rfc822|vcard|csv/i.test(file.type) && !/\.(txt|eml|vcf|csv|md|json)$/i.test(file.name)) return null;
  // The host's own decoder (a browser's, or Node's): core names no DOM types.
  const Decoder = (globalThis as unknown as { TextDecoder: new () => { decode(bytes: ArrayBuffer): string } }).TextDecoder;
  return new Decoder().decode(await file.arrayBuffer());
}

/** The kinds found, in words: "a name, a job title and an e-mail". */
const listed = (items: string[]) => (items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

async function suggest(request: SuggestRequest, records: Records): Promise<SuggestResult> {
  const unread: string[] = [];
  const texts = [request.from.text ?? ''];
  for (const file of request.from.files ?? []) {
    const words = await fileText(file);
    if (words === null) unread.push(file.name);
    else texts.push(words);
  }
  const text = texts.join('\n');
  const found = readSignature(text);
  // A company's page: its name is the company's, the person a contact of it.
  const companyPage = request.fields.some((name) => /company|organi[sz]ation|customer|account/.test(fold(request.page.fields[name]?.label ?? '')) && (name === 'name' || roleOf(name, request.page.fields[name]) === 'company'));
  const values: Values = {};
  const said = new Set<string>();
  const words: Record<string, string> = { person: 'a name', title: 'a job title', company: 'a company', email: 'an e-mail', phone: 'a phone', mobile: 'a mobile', website: 'a website', street: 'a street', city: 'a city', tax: 'a tax id' };
  for (const name of request.fields) {
    const def = request.page.fields[name];
    if (!def) continue;
    if (def.type === 'one2many') {
      const lines = linesFrom(text, found, def, records);
      if (lines.length) {
        values[name] = lines as unknown as JsonValue;
        said.add(lines.length === 1 ? `a line for ${def.label}` : `${lines.length} lines for ${def.label}`);
      }
      continue;
    }
    let role = roleOf(name, def);
    if (role === 'person' && name === 'name' && companyPage) role = 'company';
    const value = role === 'company' && def.type === 'char' ? found.company : valueFor(role, found, def, text, records);
    if (value === undefined || value === null || value === '') continue;
    values[name] = value;
    said.add(role && words[role] ? words[role] : `the ${def.label.toLowerCase()}`);
  }
  const why = [`${STAND_IN} read by its patterns${said.size ? ` — ${listed([...said])}` : ''}.`, unread.length ? `It reads text files only: ${unread.join(', ')} not read.` : ''].filter(Boolean).join(' ');
  return { values, why };
}

// ---- writing and polishing ------------------------------------------------------------------------------------------

const SHORTHAND: [RegExp, string][] = [
  [/\bu\b/gi, 'you'],
  [/\bur\b/gi, 'your'],
  [/\b(pls|plz)\b/gi, 'please'],
  [/\b(thx|thnx|thanx)\b/gi, 'thanks'],
  [/\basap\b/gi, 'as soon as possible'],
  [/\bmsg\b/gi, 'message'],
  [/\bappt\b/gi, 'appointment'],
  [/\b(tmrw|tmr|2moro)\b/gi, 'tomorrow'],
  [/\bb4\b/gi, 'before'],
  [/\bw\/o\b/gi, 'without'],
  [/\bw\/(?=\s)/gi, 'with'],
  [/\babt\b/gi, 'about'],
  [/\bim\b/gi, "I'm"],
  [/\bive\b/gi, "I've"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bisnt\b/gi, "isn't"],
  [/\bdoesnt\b/gi, "doesn't"],
  [/\bi\b/g, 'I'],
];

/** Words made clearer, the same every time: what it did, in words. */
export function polishText(text: string): { text: string; did: string[] } {
  const did = new Set<string>();
  let out = text.replace(/\r\n?/g, '\n');
  const spaced = out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ +([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[\p{L}])/gu, '$1 ').trim();
  if (spaced !== out.trim()) did.add('tidied the spaces');
  out = spaced;
  const marks = out.replace(/([!?])\1+/g, '$1').replace(/\.{4,}/g, '…');
  if (marks !== out) did.add('one mark where there were several');
  out = marks;
  for (const [pattern, words] of SHORTHAND) {
    const next = out.replace(pattern, words);
    if (next !== out && words !== 'I') did.add('wrote out shorthand');
    out = next;
  }
  // The sign-off: a last paragraph of short lines after another ("regards" / "mona") — its first ends with a comma, the
  // name under it written with capitals and nothing after it.
  const all = out.split('\n');
  const gap = all.lastIndexOf('');
  const closing = gap > 0 && all.length - gap - 1 >= 1 && all.length - gap - 1 <= 3 && all.slice(gap + 1).every((line) => line.trim().split(/\s+/).length <= 3) ? gap + 1 : all.length;
  const lines = all.map((line, i) => {
    if (!line.trim()) return line;
    if (i >= closing) {
      const words = line.replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
      return i === closing && !/[.!?:,…]$/.test(words) ? `${words},` : words;
    }
    // A greeting: "hi mona" → "Hi Mona,".
    const greeting = /^(hi|hello|dear|hey)\b\s*(.*)$/i.exec(line);
    if (greeting && line.split(/\s+/).length <= 4) {
      const name = greeting[2].replace(/[,.!:]+$/, '').replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
      return `${greeting[1][0].toUpperCase()}${greeting[1].slice(1).toLowerCase()}${name ? ` ${name}` : ''},`;
    }
    let sentence = line.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
    // A line that ends a paragraph ends its sentence; a short sign-off ("Kind regards") ends with a comma.
    const last = i === all.length - 1 || !all[i + 1].trim();
    const short = line.split(/\s+/).length <= 3;
    if (last && !/[.!?:,…)"”]$/.test(sentence)) sentence += short && !/^(thanks|thank you)/i.test(sentence) && i > 0 ? ',' : '.';
    return sentence;
  });
  const polished = lines.join('\n');
  if (polished !== out) did.add('put capitals and full stops in');
  return { text: polished, did: [...did] };
}

/** An html field's words as lines, and back: each paragraph a line. */
const fromHtml = (html: string) => html.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const toHtml = (text: string) => text.split(/\n{2,}/).map((part) => `<p>${part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');

/** A short reply that greets the person the record names: the stand-in's draft where the app gave no template. */
function plainDraft(request: RewriteRequest): string {
  const named = Object.entries(request.page.fields).find(([name, def]) => def.type === 'char' && roleOf(name, def) === 'person' && typeof request.values[name] === 'string' && (request.values[name] as string).trim());
  const first = named ? (request.values[named[0]] as string).trim().split(/\s+/)[0] : '';
  return [`${first ? `Dear ${first}` : 'Hello'},`, '', 'Thank you for your message. We have it, and will come back to you shortly with what you asked for.', '', 'Kind regards,'].join('\n');
}

async function rewrite(request: RewriteRequest, options: StandInOptions): Promise<RewriteResult> {
  const html = request.page.fields[request.field]?.type === 'html';
  if (request.how === 'draft') {
    const own = options.drafts?.[`${request.model}.${request.field}`] ?? options.drafts?.[`${request.pageId}.${request.field}`];
    const text = own ? own(request.values, request) : plainDraft(request);
    return { text: html ? toHtml(text) : text, why: `${STAND_IN} written from this record’s fields by a template.` };
  }
  const { text, did } = polishText(html ? fromHtml(request.text) : request.text);
  return { text: html ? toHtml(text) : text, why: `${STAND_IN} ${did.length ? `${listed(did)}.` : 'nothing to make clearer.'}` };
}

// ---- a search in plain words ------------------------------------------------------------------------------------

// A unit read only where no letter, digit or square follows it: "15m" is fifteen million, "200 m²" two hundred.
const NUMBER = String.raw`(\d+(?:[.,]\d+)*)\s*(k|m|mn|million|millions|thousand|bn|billion)?(?![\p{L}²\d])`;
const UNDER = String.raw`(?:under|below|less than|up to|upto|max(?:imum)?|at most|no more than|cheaper than|<=?)`;
const OVER = String.raw`(?:over|above|more than|at least|min(?:imum)?|starting (?:at|from)|>=?)`;
const AREA_UNITS = /^\s*(m²|m2|sqm|sq\.?\s*m|square\s*(?:metres|meters|m))/i;
const STOPS = new Set(['in', 'at', 'on', 'with', 'for', 'and', 'or', 'the', 'a', 'an', 'of', 'to', 'near', 'by', 'around', 'egp', 'le', 'usd', 'pounds', 'dollars', 'show', 'me', 'find', 'all', 'any', 'some', 'that', 'which', 'is', 'are', 'has', 'have', 'from', 'between']);

function searchToFilter(request: SearchToFilterRequest, records: Records): SearchToFilterResult {
  let rest = ` ${fold(request.text)} `;
  const read: string[] = [];
  const filter: ResolvedFilterCondition[] = [];
  const fields = request.fields.map((name) => [name, request.page.fields[name]] as const).filter(([, def]) => !!def);
  const numbers = fields.filter(([, def]) => def.type === 'integer' || def.type === 'float' || def.type === 'monetary');
  /** The number field words beside a number name: a field's label ("bedrooms") or its unit ("m²"); else the first amount. */
  const numberField = (after: string, before: string): string | undefined => {
    const near = `${before.split(/\s+/).slice(-2).join(' ')} ${after.split(/\s+/).slice(0, 3).join(' ')}`;
    if (AREA_UNITS.test(after)) return numbers.find(([name, def]) => /area|m²|m2|size|surface/.test(fold(`${name} ${def.label}`)))?.[0];
    const byLabel = numbers.find(([, def]) => fold(def.label).split(/[^\p{L}]+/u).some((word) => word.length > 2 && new RegExp(`\\b${escape(word.replace(/s$/, ''))}`, 'u').test(near)));
    return byLabel?.[0] ?? numbers.find(([, def]) => def.type === 'monetary')?.[0] ?? numbers[0]?.[0];
  };
  const blank = (at: number, length: number) => (rest = rest.slice(0, at) + ' '.repeat(length) + rest.slice(at + length));
  const take = (match: RegExpExecArray) => {
    read.push(match[0].trim());
    blank(match.index, match[0].length);
  };
  /** The words of a number's field beside it — "bedrooms" after "3+", "m²" after "200" — taken with it. */
  const takeFieldWords = (field: string | undefined, end: number) => {
    if (!field) return;
    const near = rest.slice(end, end + 24);
    const words = fold(request.page.fields[field].label).split(/[^\p{L}]+/u).filter((word) => word.length > 2);
    const hit = [AREA_UNITS, ...words.map((word) => new RegExp(`^[\\s-]*${escape(word.replace(/s$/, ''))}\\p{L}*`, 'u'))].map((pattern) => pattern.exec(near)).find(Boolean);
    if (hit) blank(end, hit[0].length);
  };
  const ranges: [RegExp, (m: RegExpExecArray) => void][] = [
    [new RegExp(String.raw`(?:between|from)\s+${NUMBER}\s*(?:and|to|-|–)\s*${NUMBER}`, 'iu'), (m) => {
      const field = numberField(rest.slice(m.index + m[0].length), rest.slice(0, m.index));
      const from = standInNumber(m[1], m[2] ?? '');
      const to = standInNumber(m[3], m[4] ?? m[2] ?? '');
      if (field && from !== null && to !== null) filter.push({ field, op: 'between', value: [from, to] });
    }],
    [new RegExp(String.raw`${UNDER}\s+${NUMBER}`, 'iu'), (m) => {
      const field = numberField(rest.slice(m.index + m[0].length), rest.slice(0, m.index));
      const to = standInNumber(m[1], m[2] ?? '');
      if (field && to !== null) filter.push({ field, op: '<=', value: to });
    }],
    [new RegExp(String.raw`${OVER}\s+${NUMBER}`, 'iu'), (m) => {
      const field = numberField(rest.slice(m.index + m[0].length), rest.slice(0, m.index));
      const from = standInNumber(m[1], m[2] ?? '');
      if (field && from !== null) filter.push({ field, op: '>=', value: from });
    }],
    [new RegExp(String.raw`${NUMBER}\s*\+`, 'iu'), (m) => {
      const field = numberField(rest.slice(m.index + m[0].length), rest.slice(0, m.index));
      const from = standInNumber(m[1], m[2] ?? '');
      if (field && from !== null) filter.push({ field, op: '>=', value: from });
    }],
  ];
  for (const [pattern, made] of ranges) {
    for (let match = pattern.exec(rest); match; match = pattern.exec(rest)) {
      const before = filter.length;
      made(match);
      take(match);
      if (filter.length > before) takeFieldWords(filter[filter.length - 1].field, match.index + match[0].length);
    }
  }
  // A number beside a field's label or unit, as it is: "3 bedrooms", "200 m²".
  const plain = new RegExp(String.raw`(?<![\p{L}\d])${NUMBER}`, 'iu');
  for (let match = plain.exec(rest); match; match = plain.exec(rest)) {
    const after = rest.slice(match.index + match[0].length);
    const field = numberField(after, '');
    const value = standInNumber(match[1], match[2] ?? '');
    const unit = AREA_UNITS.exec(after);
    const labelled = field && fold(request.page.fields[field].label).split(/[^\p{L}]+/u).some((word) => word.length > 2 && new RegExp(`^[\\s-]*${escape(word.replace(/s$/, ''))}`, 'u').test(after));
    if (field && value !== null && (labelled || unit)) filter.push({ field, op: '=', value });
    take(match);
    if (field && (labelled || unit)) takeFieldWords(field, match.index + match[0].length);
  }
  // Choices and links by their names, the longest first, each word once: "garden city" before "garden".
  const named: { field: string; value: JsonValue; words: string; link: boolean }[] = [];
  for (const [name, def] of fields) {
    if (def.type === 'selection') for (const option of def.options) named.push({ field: name, value: option.value, words: fold(option.label), link: false });
    if (def.type === 'many2one' || def.type === 'many2many') {
      for (const [id, values] of Object.entries(records[(def as { relation?: string }).relation ?? ''] ?? {})) {
        const label = nameOf(values);
        if (label) named.push({ field: name, value: { id: /^\d+$/.test(id) ? Number(id) : id, label }, words: fold(label), link: true });
      }
    }
  }
  named.sort((a, b) => b.words.length - a.words.length);
  const picked = new Map<string, { value: JsonValue; at: number }[]>();
  for (const one of named) {
    const match = wordsPattern(one.words).exec(rest);
    if (!match) continue;
    picked.set(one.field, [...(picked.get(one.field) ?? []), { value: one.value, at: match.index }]);
    take(match);
  }
  // In the order the list names its fields, each field's values in the order they were written.
  for (const [field, found] of [...picked].sort(([a], [b]) => request.fields.indexOf(a) - request.fields.indexOf(b))) {
    const values = [...found].sort((a, b) => a.at - b.at).map((one) => one.value);
    const many = request.page.fields[field].type === 'many2many';
    if (many) for (const value of values) filter.push({ field, op: 'contains', value });
    else filter.push(values.length === 1 ? { field, op: '=', value: values[0] } : { field, op: 'in', value: values });
  }
  const left = rest.split(/\s+/).filter((word) => word && !STOPS.has(word) && /[\p{L}\d]/u.test(word)).join(' ');
  const why = read.length ? `${STAND_IN} read ${listed(read.map((words) => `“${words}”`))} by their patterns.` : `${STAND_IN} found no field in these words.`;
  return { filter, ...(left ? { text: left } : {}), why };
}

/** The stand-in's AI help, for a memory source's `assist`: see above. */
export function assistStandIn(options: StandInOptions = {}): Required<MemoryAssist> {
  return {
    suggest: (request, records) => suggest(request, records),
    rewrite: (request) => rewrite(request, options),
    searchToFilter: (request, records) => searchToFilter(request, records),
  };
}
