import type { FilterCondition, Fields, Option, PropertyDefinition } from '../format/field';
import type { QuizResults } from './quiz';
import type { JsonValue } from '../format/json';
import type { Page } from '../format/page';
import type { FileValue, RecordId, RelatedRecord, Values } from './values';
import type { RunStop } from './run';
import type { DateInterval } from './periods';
import type { Facet } from './search';

/**
 * How Fieldia reaches data. Fieldia knows no backend: an app implements this
 * interface for its own (a Flectra adapter, a REST client, a survey store),
 * and every method is optional so a page uses only what it needs.
 */
export interface DataSource {
  /**
   * Read a record. Needed to edit an existing record. Its values, or
   * `loadedRecord(values, { version, can })` to tell also its version — so a
   * save can tell that someone else changed it since — and what this person
   * may do with it. `loadedRecordOf` reads either the same way.
   */
  load?(request: LoadRequest): Promise<Values | LoadedRecord>;
  /**
   * Create (`id: null`) or update a record. Needed to save a record page. A
   * source that keeps versions compares `request.version` with the record's
   * and throws a `ConflictError` when someone else saved it since.
   */
  save?(request: SaveRequest): Promise<SaveResult>;
  /** Recalculate after a value changes, the way a backend's onchange does. */
  onchange?(request: OnchangeRequest): Promise<OnchangeResult>;
  /** Find records a many2one, many2many or reference may point to. */
  search?(request: SearchRequest): Promise<RelatedRecord[]>;
  /** Make a record from just its name, for "Create 'xyz'" in a link field (a backend's name_create). */
  create?(request: CreateRequest): Promise<RelatedRecord>;
  /** Store one response to a `responses` page, such as a survey. */
  submit?(request: SubmitRequest): Promise<SubmitResult>;
  /** Records for a list: filtered, sorted and one page of them, with how many there are in all; with `allIds`, the ids of every one that matches. */
  list?(request: ListRequest): Promise<ListResult>;
  /** How many records fall under each value of a field, for a list's Group By. */
  groups?(request: GroupRequest): Promise<Group[]>;
  /**
   * The views kept for a list on the app's server: each a name and how the list stands — its search, its order and
   * its columns — the person's own and those shared with their team, the same on every device. Asked as the list
   * opens, before its records: it opens on the person's own default view, else the team's. Without it, a person's
   * searches are kept as favourites in their browser (the viewer's `preferences`), as before.
   */
  views?(request: ViewsRequest): Promise<SavedView[]>;
  /**
   * Keep a view: a new one (no `id`), or one of the person's own again (its `id`) — its name, how the list stands,
   * shared with the team or not, the default or not. Answer with it as kept, its `id` given. A view kept as the default
   * is the only one: the person's own default, or the team's (a shared one) — let go of the one before. Refused
   * (thrown, its message in the person's words), the menu says so and nothing is kept. Without it, views are listed
   * and put on, and none is saved.
   */
  saveView?(request: SaveViewRequest): Promise<SavedView>;
  /** Delete one of the person's own views. Without it, the menu deletes none. */
  deleteView?(request: DeleteViewRequest): Promise<void>;
  /** The choices of one of the app's lists, for a selection with `optionsFrom` — a page's field, or a table's line by its values. */
  options?(request: OptionsRequest): Promise<Option[]>;
  /** The definitions of a properties field with `definitionsFrom`: those the linked record keeps. */
  definitions?(request: OptionsRequest): Promise<PropertyDefinition[]>;
  /** Keep a properties field's definitions, a property added in place among them, on the record they come from. */
  saveDefinitions?(request: OptionsRequest & { definitions: PropertyDefinition[] }): Promise<void>;
  /** Archive a record, or bring it back (`archive: false`): Flectra's `active` set false or true. For the `archive` and `unarchive` steps. */
  archive?(request: ArchiveRequest): Promise<void>;
  /** Copy a record, as a backend's copy does: the copy's id, and its values when the source has them. For the `duplicate` step. */
  copy?(request: RecordRequest): Promise<SaveResult>;
  /** Delete a record. For the `delete` step. */
  delete?(request: RecordRequest): Promise<void>;
  /**
   * The record's attachments, its main one first, for a sheet's attachment
   * preview: each a file with its `url` (or its `data`) and its media type.
   */
  attachments?(request: RecordRequest): Promise<FileValue[]>;
  /**
   * Totals over the records a search finds — each field's sum, average,
   * least, most or count — over them all and, with `groupBy`, under each
   * value of a field: the row under a list and the sums on its Group By
   * headings. Without it, a list shows no totals.
   */
  totals?(request: TotalsRequest): Promise<TotalsResult>;
  /**
   * Store one file where the app keeps files, as soon as it is picked, for a
   * file or picture field: the record then keeps only its link. Without it,
   * a file travels inside the record as base64, as it always has. To fail,
   * throw: the field offers Retry, except after `saveRefused({ kind: 'rule',
   * message })`, which says the store refuses this file (its kind, its
   * size) and is shown as it is.
   */
  upload?(file: UploadFile, request: UploadRequest): Promise<UploadedFile>;
  /**
   * The times free to book, for a date and time drawn as booking slots
   * (`"widget": "slots"`): each day asked — the days of a month, in the
   * field's time zone — with its state (open, full, closed, a holiday) and
   * the times a booking may start on it; asked again for the day of a time
   * picked, so a time someone else took meanwhile is said, never booked.
   * Without it, such a field is the plain date and time box.
   */
  slots?(request: SlotsRequest): Promise<SlotsResult>;
  /**
   * Change many records at once, the same value in each field given: a
   * list's bulk edit, of the rows ticked or of every record the search
   * finds. Answer with those not changed and why; every other one is taken
   * as changed. Without it, the list saves each in turn (`save`, `partial`).
   * Refuse a record this person may not change, or one changed since the
   * version it was listed at (`versions`), as a save would.
   */
  writeMany?(request: WriteManyRequest): Promise<WriteManyResult>;
  /**
   * Write a list's export on the server, in place of the browser: for
   * exports too big for a browser, or files the server words its own way.
   * Answer with the file — its bytes (`data`: a Blob fits) or its address
   * (`url`) — for the browser to save; with `{ message }` when the server
   * hands it over its own way (an email on its way), the list saying it; or
   * with `false` to let the list write it in the browser after all, as it
   * does without this (a small export, say).
   */
  exportRecords?(request: ExportRequest): Promise<ExportedFile | { message: string } | false>;
  /**
   * Make many records at once, each with its own values: a list's Import of
   * a file's rows, a thousand at a time. Answer for each record asked for,
   * in its order: the id it was made with, or why it was not made, in the
   * person's words. Without it, the list saves each in turn (`save` with no
   * id).
   */
  createMany?(request: CreateManyRequest): Promise<CreateManyResult>;
  /**
   * Take a list's Import on the server, in place of the browser: a file too
   * big for one, or a server that imports its own way. Asked once the person
   * has matched the file's columns to the page's fields, before a row is
   * checked: answer `{ message }` when the server takes the file (the list
   * says it: "Your file is being imported: you will get an email"), or
   * `false` to let the browser import it after all, as it does without this.
   */
  importRecords?(request: ImportRequest): Promise<{ message: string } | false>;
  /**
   * Records like the one typed, for a page's possible duplicates (`duplicates`): asked a moment after a person stops
   * typing in a field it names, as a saved record is opened, and as a record is saved — with the fields it names that
   * hold a value. Answer with the records that have the same phone, email or id, or a name close enough, each with
   * the fields it matched on; never the record itself. Without it, nothing is asked and nothing shows.
   */
  duplicates?(request: DuplicatesRequest): Promise<DuplicatesResult>;
  /**
   * Merge records into one, as a person chose on a possible duplicate's Merge: `keepId` kept, holding the values
   * picked for each field, and `mergeIds` gone. Moving what was theirs — messages, activities, the records that link
   * to them — to the one kept is the source's work; the page says it will happen. Refuse with `saveRefused` (a `rule`,
   * with why) and nothing changes. Without it, possible duplicates offer no Merge.
   */
  merge?(request: MergeRequest): Promise<MergeResult | void>;
  /**
   * The records a person said are someone else for this one ("It's someone new"), by id: asked as a saved record is
   * shown, before its possible duplicates are said, so one let be on another device stays let be here. A pair: answer
   * from either side where you keep them so. With `markNotDuplicate`, these are kept on your server; without both,
   * in the person's browser (the viewer's `preferences`), as before. To fail, throw: what the browser kept is read.
   */
  notDuplicates?(request: NotDuplicatesRequest): Promise<RecordId[]>;
  /**
   * Keep that a record found is someone else for this one: the person pressed "It's someone new" on a saved record,
   * or saved a new one after pressing it (once for each). Never said as its duplicate again, on any device. Refused
   * (thrown), the browser keeps it instead, as without this.
   */
  markNotDuplicate?(request: MarkNotDuplicateRequest): Promise<void>;
  /**
   * How many answers a page has taken, for its `limits` and its options' `seats`: the responses sent so far (what
   * `maxResponses` counts), this person's (what `onePerPerson` counts), and for each choice field asked how many hold
   * each of its options. Asked as the page opens — a closed or full form says so before anything is typed — and again
   * just before its answers are sent. Without it, the page keeps to its dates alone and shows no places left; its
   * `submit` (or `save`) refuses as it would.
   */
  limits?(request: LimitsRequest): Promise<LimitsResult>;
  /**
   * Keep a page's answers so far on the app's server, to continue from on this device or another: as they are typed
   * (a moment after typing stops), as a wizard's step is entered, and when the person presses "Continue later"
   * (`later`). The first time `key` is null: answer with the key the draft is kept under, and on "Continue later" a
   * `link` to continue from (the app makes it, with the key in it) and words of the app's own ("We emailed you the
   * link"). The answers kept are the app's to see — where people stopped, what they had written. Without it, drafts
   * stay in the browser's store (`drafts`), as before, and no "Continue later" shows.
   */
  saveDraft?(request: SaveDraftRequest): Promise<SavedDraft>;
  /** A draft kept by `saveDraft`, by its key: what the viewer's `resume` opens. Null when there is none (sent, or gone). */
  loadDraft?(request: LoadDraftRequest): Promise<StoredDraft | null>;
  /**
   * A record's approvals, for a page with `approval`: the levels it must pass — each with who may approve it there,
   * whether any one of them or all must, and where it stands — what was decided so far, and the levels this person may
   * decide now. Asked as a saved record is shown, again after each save and each decision. Who is asked, and in what
   * order, is the app's to decide — or the approval engine's behind it: Fieldia says it and asks. Without it, nothing
   * is asked and nothing shows; no levels, and nothing shows either.
   */
  approvals?(request: ApprovalsRequest): Promise<Approvals>;
  /**
   * A decision at a level this person may decide (`Approvals.mine`): approved, or rejected with why (`reason`, always
   * given with a rejection). Answer with the approvals as they stand now, or nothing: they are asked again. The record
   * is loaded again after it, as the decision may have moved it on (its state, what may be changed). Refuse with
   * `saveRefused` (a `rule`, with why) and nothing is decided. Without it, no Approve or Reject shows.
   */
  decide?(request: DecideRequest): Promise<Approvals | void>;
  /**
   * Values for a form, read by the app's own model from words a person gives — an e-mail, a signature, a message — or
   * from files: what a page's `suggest` (its "Fill from text") asks. Answer with the values proposed, by field — a
   * table of lines' as the lines to add, each its values — and, if you like, why in a sentence. Nothing you answer is
   * kept unasked: each value is shown on its field for the person to accept or reject first, and a field they typed
   * in meanwhile keeps what they typed. Fieldia ships no model and no keys. Without it, no "Fill from text" shows.
   */
  suggest?(request: SuggestRequest): Promise<SuggestResult>;
  /**
   * A text field's words written by the app's own model: a draft of it from the record (`how: "draft"`), the words
   * the person wrote made clearer (`polish`), or a tool of the app's own the page names. What you answer is shown
   * under the field for the person to accept or reject; it is never kept unasked, and typing in the field meanwhile
   * lets it go. Without it, a field's `rewrite` tools are hidden.
   */
  rewrite?(request: RewriteRequest): Promise<RewriteResult>;
  /**
   * A search typed in plain words — "villas in New Cairo under 15M" — read by the app's own model as conditions on
   * the list's fields: what a list's `searchToFilter` asks. Each condition becomes a filter the person sees and may
   * take away, and Undo puts their words back. Without it, the list searches the words as typed, as before.
   */
  searchToFilter?(request: SearchToFilterRequest): Promise<SearchToFilterResult>;
  /**
   * A list's map, its records gathered on the server where they crowd: for the view the map shows (`bbox`, `zoom`),
   * the bubbles — each where its records' middle is, how many it holds and the box they lie in — and the records that
   * stand alone, with the fields their pins and cards show. Asked as a search changes and again a moment after the map
   * stops moving, so a map shows every record a search finds, however many, never loading them: thousands of homes, a
   * city's orders. Answer `false` to let the map load the search's records and gather them itself, as it does without
   * this (a search that finds few, a model your server does not gather). To fail, throw: the map says so.
   */
  clusters?(request: ClustersRequest): Promise<ClustersResult | false>;
  /**
   * Send a code that proves the person owns an email or a phone, for a field whose node says `options.verify`: by
   * email, SMS, WhatsApp — your app's own way (its mail service, Twilio, a WhatsApp gateway); Fieldia sends nothing and
   * holds no keys. Answer with how long it works, how soon another may be asked for and how many digits it has; throw
   * `saveRefused({ kind: 'rule', message })` to refuse it in your words ("Too many codes for this number: try in an
   * hour"). With `checkCode`; without both, no field asks for a code.
   */
  sendCode?(request: SendCodeRequest): Promise<SentCode>;
  /**
   * Check the code the person typed for the value it was sent to: right, wrong (with the tries left), or expired. Answer
   * right with a `proof` of your own — a signed token — and every send carries it (`verified`), so your server trusts
   * the value without asking again. With `sendCode`.
   */
  checkCode?(request: CheckCodeRequest): Promise<CodeChecked>;
  /**
   * Take a payment the answers wait for (a page's `payment`): a reservation fee, a deposit — your app's own way, through
   * its own provider (Stripe, Paymob, Fawry, PayPal…); Fieldia holds no keys and no provider's code. Called inside the
   * person's press of Pay, so you may open the provider's checkout in a window of its own; or draw it in `slot`, an
   * element in the payment step. Answer once it is over: paid (with the provider's reference, which the send carries),
   * failed (with why) or cancelled; nothing is sent until it is paid. Stop when `signal` aborts (the person pressed
   * Cancel, or left). `key` is the same for every try of one response's payment: hand it to your provider as its
   * idempotency key, so a payment is never taken twice. Without it, no payment is asked and the page sends as before.
   */
  pay?(request: PayRequest): Promise<PayResult>;
}

/** Whose approvals are asked: the record shown, and the person, as the app told the form. */
export interface ApprovalsRequest {
  model: string;
  /** The record shown, saved: a new one has none. */
  recordId: RecordId;
  /** The person as the app told the form (`user`), where it did: a server knows them by its own sign-in first. */
  user?: { id: RecordId | null; name?: string };
}

/** What was decided at a level: approved, or rejected. */
export type ApprovalDecision = 'approved' | 'rejected';

/**
 * Where a level stands: `waiting` for its approvers now, `later` — after the levels before it, or until the record is
 * sent for approval — `approved`, `rejected`, or `skipped`, not needed for this record.
 */
export type ApprovalLevelState = 'waiting' | 'later' | 'approved' | 'rejected' | 'skipped';

/** One who may approve at a level, and what they decided there, where they did. */
export interface Approver {
  /** Their id, where the app has one: the form's `user` is matched by it. */
  id?: RecordId;
  /** Their name, as people know them: "Mona Adel". */
  name: string;
  /** What they decided at this level, in the round of asking now; none while they have not. */
  decision?: ApprovalDecision;
  /** When, as an ISO date and time. */
  at?: string;
}

/** A level a record must pass: Manager, Finance, the CFO, Legal. */
export interface ApprovalLevel {
  /** The level's own id, as `decide` and the history name it: "finance". */
  id: string;
  /** Its name, in the person's language: "Finance". */
  name: string;
  /** Who may approve it there. */
  approvers: Approver[];
  /** Met by any one of them (`any`, the default) or by every one (`all`): said in words ("Mona Adel or Omar Said"). */
  needs?: 'any' | 'all';
  state: ApprovalLevelState;
}

/** What happened on a record's way to approval: sent for it, or a decision at a level — who, when, and why. */
export interface ApprovalEntry {
  /** A decision at a level, or the record sent for approval (`requested`): each round of asking starts with one. */
  decision: ApprovalDecision | 'requested';
  /** The level decided at, by its id; none for `requested`. */
  level?: string;
  /** The level's name, where it is no longer among the record's levels: its id is said otherwise. */
  levelName?: string;
  /** Who, by the name people know them by. */
  by: string;
  /** When, as an ISO date and time. */
  at: string;
  /** Why, as they wrote it: always with a rejection, where one approving wrote any. */
  reason?: string;
}

/** A record's approvals, as `approvals` and `decide` answer. */
export interface Approvals {
  /** The levels it must pass, in their order: none, and it needs no approval — nothing shows. */
  levels: ApprovalLevel[];
  /** True: the levels are asked all at once, each waiting together; else one after another, in their order. Words alone. */
  together?: boolean;
  /** What happened so far, oldest first: shown beside the record and in its conversation. */
  history?: ApprovalEntry[];
  /** The levels this person may decide now, by id: Approve and Reject for each. None: they only see where it stands. */
  mine?: string[];
  /** Why it needs approval, in the person's language, said with it: "Orders over EGP 50,000 go to Finance, then the CFO." */
  why?: string;
}

/** A decision at a level: what `decide` is asked. */
export interface DecideRequest {
  model: string;
  recordId: RecordId;
  /** The level decided at, by its id: one of `Approvals.mine`. */
  level: string;
  decision: ApprovalDecision;
  /** Why, as the person wrote it: always given with a rejection. */
  reason?: string;
  /** The person as the app told the form (`user`), where it did. */
  user?: { id: RecordId | null; name?: string };
}

/** What `suggest` is asked: the page and its values now, the fields a proposal may fill, and what the person gave. */
export interface SuggestRequest {
  pageId: string;
  /** The page's model; empty for a page of responses. */
  model: string;
  /** The record shown; null while it is new. */
  recordId: RecordId | null;
  /** The page as it is shown, in the reader's words: its fields' labels, kinds and options, for the model to read. */
  page: Page;
  /** The record's values now. */
  values: Values;
  /** The fields a proposal may fill, by name: those the page's `suggest` names, else those shown that a person can set. */
  fields: string[];
  /** What the person gave: words pasted or typed, files picked. */
  from: { text?: string; files?: UploadFile[] };
  /** The page's language, by tag: what the values proposed are written in. */
  language: string;
  /**
   * For each field it may fill that keeps its text in several languages (`translate`), the one language a proposal
   * fills, by tag — the one shown in its switch, else the reader's: answer that language's text alone, as a string.
   * Never the others: each language is typed by a person, never translated by a machine.
   */
  languages?: Record<string, string>;
}

/** Values proposed for a form, each shown on its field to accept or reject. */
export interface SuggestResult {
  /**
   * By field: a value as the field holds one — a link as `{ id, label }`, or its name, looked for as typing looks for
   * it; a choice by its value or its label; a day as "2026-10-20" — and a table of lines' as the lines to add, each
   * its values. A field not asked, or one the person cannot set, is left out.
   */
  values: Values;
  /** Why, in a sentence of the app's: shown over the values proposed. */
  why?: string;
}

/** What `rewrite` is asked: the text field, what was pressed, its words now and the record they belong to. */
export interface RewriteRequest {
  pageId: string;
  model: string;
  recordId: RecordId | null;
  /** The page as it is shown, in the reader's words. */
  page: Page;
  /** The record's values now: what a draft is written from. */
  values: Values;
  /** The text field, by name. */
  field: string;
  /** `draft` (write it from the record), `polish` (make the words there clearer), or a tool of the app's own, by its `how`. */
  how: string;
  /** The field's words now: empty for a draft of an empty field. */
  text: string;
  /**
   * The page's language, by tag — for a text kept in several languages (`translate`), the one shown in its switch: the
   * words given are that language's, and the words answered fill it alone, never another (each typed by a person).
   */
  language: string;
}

/** A text field's words proposed: shown under it to accept or reject. */
export interface RewriteResult {
  text: string;
  /** Why, in a sentence of the app's: shown with the words proposed. */
  why?: string;
}

/** What `searchToFilter` is asked: the words typed, and the fields a condition may name. */
export interface SearchToFilterRequest {
  pageId: string;
  model: string;
  /** The page as it is shown, in the reader's words: its fields' labels, kinds and options. */
  page: Page;
  /** The words typed: "villas in New Cairo under 15M". */
  text: string;
  /** The fields a condition may name: the list's columns, search fields and filter fields. */
  fields: string[];
  /** The page's language, by tag. */
  language: string;
}

/** A plain-words search as conditions, each shown as a filter the person may take away. */
export interface SearchToFilterResult {
  /**
   * Conditions on the fields asked, all holding together: `=` a value (a choice by its value, a link by its id), `in`
   * several, `>=`, `<=`, `>`, `<` or `between` [from, to] for a number or a day, `contains` for a record of links,
   * `ilike` words in a text. One a field was not asked of, or an `op` the list cannot show, is left out and said.
   */
  filter: ResolvedFilterCondition[];
  /** Words to search for as typed, besides: what was left of the words that names no field. */
  text?: string;
  /** Why, in a sentence of the app's: shown with the filters made. */
  why?: string;
}

/** A box on the earth, its edges in degrees: west beyond east when it crosses the antimeridian, -180 and 180 the world round. */
export interface GeoBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** What a list's map asks `clusters`: the search, where its records are, and the view it shows. */
export interface ClustersRequest {
  model: string;
  /** The list's search, as `list` gets it; the view is not among it. */
  filter: ResolvedFilter[];
  /** Where each record is: a field holding a GeoJSON point, or a latitude whose longitude is in `longitude` — as a `near` order names them. */
  field: string;
  longitude?: string;
  /** The view: the records within it are gathered. */
  bbox: GeoBox;
  /** The map's zoom: 0 the world in one 256-pixel image, each step twice as close (Web Mercator, every web map's). */
  zoom: number;
  /** How near two pins come, in pixels at this zoom, before they crowd: the cell of a grid a server gathers by. */
  radius: number;
  /** The fields a record standing alone carries: its place, its pin's and its card's. */
  fields: string[];
  /** A number field to add up in each bubble (`MapCluster.weight`): what a heat map from afar weighs its records by. */
  weight?: string;
  /** Aborted when the map moves on before the answer comes: stop, and reject with an error named `AbortError`. */
  signal?: UploadSignal;
}

/** Records gathered where they crowd, for one view of a list's map. */
export interface ClustersResult {
  /** The bubbles: each two records or more, drawn with its count; pressed, the map zooms to its `bbox`. */
  clusters: MapCluster[];
  /** The records that stand alone, each drawn as its own pin, its card opened from it: `{ id, values }` with the fields asked. */
  points?: ListedRecord[];
  /** How many records the search finds that have no place: said under the map ("2 without a place, not on the map"). */
  unplaced?: number;
}

/** A bubble: records close together, counted where they stand. */
export interface MapCluster {
  /** Where it is drawn: its records' middle. */
  lat: number;
  lng: number;
  /** How many records it holds. */
  count: number;
  /** The box its records lie in: a press zooms there, and a new search fits the map to its bubbles' boxes. Without it, a press zooms two steps in. */
  bbox?: GeoBox;
  /** With `weight` asked: that field added up over its records. */
  weight?: number;
}

/** What `pay` is asked: what is due, what for, the answers it pays for, and where its checkout may be drawn. */
export interface PayRequest {
  pageId: string;
  /** The page's model; empty for a page of responses. */
  model: string;
  recordId: RecordId | null;
  /** How much, in the currency's own units (10000 for EGP 10,000.00). */
  amount: number;
  /** ISO 4217: "EGP". */
  currency: string;
  /** What it is for, in the page's words: "Reservation fee". */
  label: string;
  description?: string;
  /** The same for every try of this response's payment: the provider's idempotency key. */
  key: string;
  /** The answers it pays for, as the send would carry them. */
  values: Values;
  /** The page's language, by tag. */
  language: string;
  /** Where the provider's checkout may be drawn in the payment step: an element, in a browser. */
  slot?: unknown;
  /** Aborts when the person presses Cancel or leaves: stop, and answer cancelled (or reject with an error named AbortError). */
  signal?: UploadSignal;
}

/** How a payment ended. */
export interface PayResult {
  status: 'paid' | 'failed' | 'cancelled';
  /** The provider's reference for a payment taken, sent with the answers. */
  reference?: string;
  /** Why it failed, in the person's words, said as it is: "The card was declined." */
  message?: string;
}

/** What a page's payment asks now: the amount, its currency, what for, and its key. */
export interface PaymentDue {
  amount: number;
  currency: string;
  label: string;
  description?: string;
  key: string;
}

/** A payment taken, as a send carries it (`payment`). */
export interface PaidPayment {
  amount: number;
  currency: string;
  key: string;
  reference?: string;
}

/** What `sendCode` is asked: the field, the value to prove, and how the person asked to get the code. */
export interface SendCodeRequest {
  pageId: string;
  /** The page's model; empty for a page of responses. */
  model: string;
  /** The record edited; null for a new one or a response. */
  recordId: RecordId | null;
  /** The email or phone field, by name. */
  field: string;
  /** What it holds now: an email address, or a phone number (E.164 where the page reads phones the world over). */
  value: string;
  /** What the value is: an email, or a phone. */
  kind: 'email' | 'phone';
  /** The way the person picked to get it — `sms`, `whatsapp`, `call`, `email`, or one of the page's own — where the page offers more than one. */
  by?: string;
  /** The page's language, by tag: the code's message is written in it. */
  language: string;
}

/** A code on its way. Each part is told where the app knows it. */
export interface SentCode {
  /** When it stops working, as ISO: said ("The code works for 10 minutes"), and after it, a new one is asked for. */
  expiresAt?: string;
  /** Seconds before another may be asked for: Send again waits so long, its count said. */
  retryAfter?: number;
  /** How many digits it has: its box takes so many, and checks it once they are all typed. 6 unless said. */
  length?: number;
  /** Your own id for it, handed back to `checkCode`. */
  id?: string;
  /** Words of your own, said as they are: "We sent a code to +20 10 1234 5678 on WhatsApp." */
  message?: string;
}

/** What `checkCode` is asked: the code typed, for the value it was sent to. */
export interface CheckCodeRequest {
  pageId: string;
  model: string;
  recordId: RecordId | null;
  field: string;
  value: string;
  /** What the person typed, its digits as 0-9, without spaces. */
  code: string;
  /** The id `sendCode` gave it, where it gave one. */
  id?: string;
}

/** Whether a code was right. */
export interface CodeChecked {
  ok: boolean;
  /** Right: a proof of your own (a signed token), sent with the answers so your server trusts the value as proved. */
  proof?: string;
  /** Wrong: how many tries are left; 0, a new code must be asked for. */
  triesLeft?: number;
  /** Too late: the code no longer works, and a new one must be asked for. */
  expired?: boolean;
  /** Words of your own, said as they are, in place of Fieldia's. */
  message?: string;
}

/** An email or a phone the person proved they own, by a code: the value proved, and the app's proof of it. */
export interface VerifiedValue {
  value: string;
  proof?: string;
}

/** Whose possible duplicates were let be: what `notDuplicates` is asked. */
export interface NotDuplicatesRequest {
  model: string;
  /** The record shown, saved. */
  recordId: RecordId;
}

/** A record found, said to be someone else for this one: what `markNotDuplicate` is asked. */
export interface MarkNotDuplicateRequest {
  model: string;
  /** The record shown, saved. */
  recordId: RecordId;
  /** The record found like it, which is someone else. */
  matchId: RecordId;
}

/** What `limits` is asked: the page, the record (whose own choice is no other's place) and the choice fields with places. */
export interface LimitsRequest {
  pageId: string;
  /** The page's model; empty for a page of responses. */
  model: string;
  /** The record edited, whose own choices are not counted as another's; null for a new one or a response. */
  recordId: RecordId | null;
  /** The choice fields whose options have `seats`, by name: count how many hold each option. */
  fields: string[];
  /** The person as the app told the form (`user`), where it did: a server knows them by its own sign-in first. */
  user?: { id: RecordId | null; name?: string };
}

/** How many answers a page has taken. Each part is told where the source knows it; one left out is not kept to. */
export interface LimitsResult {
  /** The responses (or records) sent so far: what the page's `maxResponses` counts. */
  responses?: number;
  /** Those this person sent: one or more refuses another where the page says `onePerPerson`. */
  mine?: number;
  /** For each field asked, by option value: how many answers hold it (the record edited not counted). */
  perChoice?: Record<string, Record<string, number>>;
}

/** A page's answers so far, as a draft keeps them: on the app's server (`saveDraft`) or in the browser's store. */
export interface StoredDraft {
  /** The answers, as typed so far: where files are stored apart, no file's bytes. */
  values: Values;
  /** The wizard's step on screen, which the draft opens at again. */
  step?: string | null;
  /** The optional steps passed over with Skip. */
  skipped?: string[];
  /** Text typed that does not read yet, by its box's path, kept as it was typed and said again as the draft opens. */
  unread?: Record<string, { text: string; message: string }>;
  /** The fields the person answered (changed), in the page's order: where they got to. */
  answered?: string[];
  /** On a page that draws its order or some of its questions: the draw they were answering, kept so it opens the same. */
  order?: Record<string, string[]>;
  /** On a page with time limits: when each started, as ISO — the page's under `#form`, a step's by its id. */
  timers?: Record<string, string>;
  /** When it was kept, as ISO. */
  savedAt: string;
}

/** What `saveDraft` is asked: the draft, and the key it was kept under before. */
export interface SaveDraftRequest {
  pageId: string;
  /** The page's model; empty for a page of responses. */
  model: string;
  /** The record edited; null for a new one or a response. */
  recordId: RecordId | null;
  /** The key the source gave this draft before; null the first time: answer with a new one. */
  key: string | null;
  draft: StoredDraft;
  /** The person pressed "Continue later": the app may send them the link now, and answers with it. */
  later?: boolean;
}

/** A draft kept on the server: its key, and after "Continue later" the link to continue from and the app's own words. */
export interface SavedDraft {
  key: string;
  /** The address to continue from, with the key in it, as the app makes it: shown with Copy. */
  link?: string;
  /** Words of the app's own, said as they are: "We emailed the link to mona@example.com." */
  message?: string;
}

/** What `loadDraft` is asked: the page, and the key the draft was kept under. */
export interface LoadDraftRequest {
  pageId: string;
  key: string;
}

/** Many records made at once, each with its own values: a list's Import. */
export interface CreateManyRequest {
  model: string;
  /** Each record's values, in the file's order: what its row fills in, and the page's defaults for the rest. Links as `{ id, label }`. */
  records: Values[];
  /** The fields' definitions, as a save gets them. */
  fields: Fields;
}

export interface CreateManyResult {
  /**
   * One answer for each record asked for, in the same order: the id it was made with, or why it was not made — and,
   * where the source has it, the problem as a save would throw it (a field's own words). A record left unanswered is
   * taken as not made.
   */
  records: ({ id: RecordId } | { message: string; problem?: SaveProblem })[];
}

/** A file a list's Import hands to the server, its columns matched to the page's fields. */
export interface ImportRequest {
  model: string;
  /** The file as the person picked it: a browser's File fits. */
  file: UploadFile;
  /** Each column of the file, in its order — its header's words, and the field it fills, null where it is left out. */
  columns: { header: string; field: string | null }[];
  /** How many rows it holds under its header. */
  rows: number;
  /** The fields' definitions, as a save gets them. */
  fields: Fields;
  /** The page's language and the order it writes dates in, so a server reads the cells as the page would. */
  locale: string;
  dateOrder: 'dmy' | 'mdy' | 'ymd';
}

/** Records like the one typed: what `duplicates` is asked. */
export interface DuplicatesRequest {
  model: string;
  /** The record typed, never its own duplicate; null while it is new. */
  recordId: RecordId | null;
  /** Every value of the form, as typed: a phone kept as E.164 where the page reads phones the world over. */
  values: Values;
  /** The fields to compare it by, by name: those the page names (`duplicates.fields`) that hold a value now. */
  fields: string[];
}

/** A record like the one typed. */
export interface DuplicateMatch {
  id: RecordId;
  /** Its name, as people know it: "Nile Traders". */
  name: string;
  /**
   * What it matched on: the names of the fields asked that it holds the same (`phone`, `email`), or a name close to
   * the one typed (the name's field). Each is said under that field's box; words of the source's own ("the same
   * address") are said as they are.
   */
  why: string[];
  /** How alike, from 0 to 1, where the source tells: the likest first. */
  score?: number;
}

export interface DuplicatesResult {
  matches: DuplicateMatch[];
}

/** Records merged into one: what `merge` is asked. */
export interface MergeRequest {
  model: string;
  /** The record kept. */
  keepId: RecordId;
  /** The records merged into it, then gone. */
  mergeIds: RecordId[];
  /** The kept record's values, as picked on the merge's screen for each field the records held apart. */
  values: Values;
  /** The page's fields, so the source knows each link's model, as a save does. */
  fields: Fields;
}

/** What a merge may tell: words of the source's own about it, said once it is done ("4 messages moved"). */
export interface MergeResult {
  message?: string;
}

/** The same value written in a field of each record: a list's bulk edit. */
export interface WriteManyRequest {
  model: string;
  ids: RecordId[];
  /** The fields written and their value, the same in each record: `{ state: 'active' }`. */
  values: Values;
  /** Those fields' definitions, as a save gets them. */
  fields: Fields;
  /** The version each record was listed at, by its id, where the list knew it: one changed since is refused, as a save over someone else's. */
  versions?: Record<string, RecordVersion>;
}

export interface WriteManyResult {
  /** Each record not changed, with why in the person's words — and, where the source has it, the problem as a save would throw it (a conflict's who and when). */
  failed: { id: RecordId; message: string; problem?: SaveProblem }[];
}

/** A list's records to put in a file: those ticked, or every one its search finds. */
export interface ExportRequest {
  model: string;
  format: 'xlsx' | 'csv';
  /** The list's columns, in its order, each with its header's words. */
  columns: { field: string; label: string }[];
  /** The records ticked, by id; left out, every record `filter` finds. */
  ids?: RecordId[];
  /** The list's search, as `list` gets it. */
  filter: ResolvedFilter[];
  /** The list's order now. */
  sort: SortOrder[];
  /** How many records go. */
  count: number;
  /** The file's name, as the list would give it: "Customers 2026-10-16.xlsx". */
  name: string;
  /** The page's language, for values written as people there read them. */
  locale: string;
}

/** A file for the browser to save: its bytes, or where to fetch them. */
export interface ExportedFile {
  name: string;
  /** Its media type, when `data` does not say it. */
  type?: string;
  /** Its bytes: a Blob, an ArrayBuffer, a typed array, or text. */
  data?: ExportBytes | ArrayBuffer | ArrayBufferView | string;
  /** Where the browser fetches it, in place of `data`. */
  url?: string;
}

/** A Blob, as far as an export reads one: core names no DOM types. */
export interface ExportBytes {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Which state of a record a page opened, as its source keeps it: an etag, a
 * write date, a revision number — Fieldia only hands `token` back — with who
 * changed the record last and when, for the words a conflict shows ("Mona
 * changed this at 10:42").
 */
export interface RecordVersion {
  token: string;
  /** Who changed it last, by the name people know them by. */
  by?: string;
  /** When, as an ISO date and time: `2026-10-13T10:42:00Z`. */
  at?: string;
}

/**
 * What this person may do with one record. Each is allowed unless it says
 * `false`, so a source that tells nothing keeps today's behaviour. The page
 * hides what is not allowed — never shows it disabled — and says why.
 */
export interface RecordPermissions {
  /** False: the form is read-only for this person, and Save is hidden. */
  edit?: boolean;
  /** False: Delete is hidden, and the `delete` step's buttons. */
  delete?: boolean;
  /** False: Archive and Unarchive are hidden, and those steps' buttons. */
  archive?: boolean;
  /** False: Duplicate is hidden, and the `duplicate` step's buttons. */
  duplicate?: boolean;
  /** Fields this person may see but not change on this record, by name. */
  readonlyFields?: string[];
  /** Fields this person may not see on this record, by name: hidden, and the source leaves their values out. */
  hiddenFields?: string[];
  /** Why not everything is allowed, in the person's language, for the page to say: "Only Mona, the lead's agent, can change it." */
  reason?: string;
}

/**
 * A record as `load` gives it to tell more than its values. A field cannot
 * be named `$loaded`, so the mark keeps it apart from bare values.
 */
export interface LoadedRecord {
  $loaded: true;
  values: Values;
  /** The version it was read at: each save carries it back. */
  version?: RecordVersion;
  /** What this person may do with it. */
  can?: RecordPermissions;
}

/** What `load` returns to tell a record's version, or what this person may do with it, beside its values. */
export function loadedRecord(values: Values, more: { version?: RecordVersion; can?: RecordPermissions } = {}): LoadedRecord {
  return { $loaded: true, values, ...(more.version ? { version: more.version } : {}), ...(more.can ? { can: more.can } : {}) };
}

/** What a load gave, in one shape: bare values, as every source gave them before, are a record with nothing more to tell. */
export function loadedRecordOf(loaded: Values | LoadedRecord): LoadedRecord {
  const marked = loaded as Partial<LoadedRecord>;
  return marked.$loaded === true && marked.values !== null && typeof marked.values === 'object' ? (loaded as LoadedRecord) : { $loaded: true, values: loaded as Values };
}

/** One stored record, by its model and id. */
export interface RecordRequest {
  model: string;
  id: RecordId;
  /** The page's fields, so the source knows what the page shows of it. */
  fields: Fields;
}

export interface ArchiveRequest extends RecordRequest {
  /** True to archive it, false to bring it back. */
  archive: boolean;
}

export interface OptionsRequest {
  /** The list's name, from the field's `optionsFrom.list`. */
  list: string;
  /**
   * Every value of the form, for a list that changes with another field (`dependsOn`). For a table's line, the line's
   * values: its connection, for its tools.
   */
  values: Values;
  /**
   * For a table's line — or a form editing one in a dialog — the values of the record it is on, which a line's list
   * may change with (`parent.` in its `dependsOn`). Left out for a page's own field.
   */
  parent?: Values;
}

export interface CreateRequest {
  model: string;
  /** What the person typed: the new record's name. */
  name: string;
  /** What else it starts with, from the link's `createValues`: links as `{ id, label }`. */
  values?: Values;
}

export interface LoadRequest {
  model: string;
  id: RecordId;
  /** The page's fields, so the source reads exactly what the page shows. */
  fields: Fields;
}

export interface SaveRequest {
  model: string;
  id: RecordId | null;
  /** The page's fields, so the source knows each relation's model. */
  fields: Fields;
  /** Only what changed since the record was loaded or last saved. */
  changes: RecordChanges;
  /** Every value, for sources that save whole records. */
  values: Values;
  /**
   * True when the save carries some of the record's fields, not all of it:
   * `values` then holds the fields in `changes` alone and `fields` names
   * them alone — a save from outside a form, which never had the rest, as a
   * calendar's move and its Undo. A source that saves whole records writes
   * these over the record as stored and keeps every other field.
   */
  partial?: boolean;
  /**
   * The version the record was opened at — from its load, or from the last
   * save — for a source that refuses a save over someone else's. None for a
   * new record, nor from a source that tells no versions. "Keep mine" after
   * a conflict saves again with the conflict's `version`: these changes over
   * the record as it is now.
   */
  version?: RecordVersion;
  /** The key of the draft these changes were kept in on the server (`saveDraft`): the source may let it go. */
  draft?: string;
  /** The emails and phones proved by a code (`options.verify`), by field: the value and the app's own proof, to trust it by. */
  verified?: Record<string, VerifiedValue>;
  /** The payment the answers waited for (a page's `payment`), taken: its amount, currency, key and the provider's reference. */
  payment?: PaidPayment;
  /**
   * A send kept on the device without signal and sent later (a page's `outbox`): its key — the same for every try, so a
   * server that kept the first can tell a second — and when it was made.
   */
  queued?: { key: string; at: string };
}

export interface SaveResult {
  id: RecordId;
  /** The record as stored, when the source recalculated anything. */
  values?: Values;
  /** Its version now, for the next save to carry. */
  version?: RecordVersion;
  /** What the person may do with it now, when the save changed that (a stage that locks it). */
  can?: RecordPermissions;
}

export interface OnchangeRequest {
  model: string;
  id: RecordId | null;
  /** The field that changed. */
  changed: string;
  values: Values;
}

export interface OnchangeResult {
  /** New values for other fields. */
  values?: Values;
  /** Something to tell the person editing, without blocking them. */
  warning?: string;
}

export interface SearchRequest {
  /** The related model, from the field's `relation`. */
  model: string;
  query: string;
  /** The field's filter, with every `valueFrom` already replaced by its value. */
  filter?: ResolvedFilter[];
  limit?: number;
  /**
   * Only the records named exactly `query`, in any case — not every one whose
   * name holds it. A box asks so for a name typed when a search's first
   * answers, cut at their limit, did not hold it ("Nile" after ten "Blue
   * Nile"s), and to tell whether more than one record has that name. A source
   * that does not know it searches as ever: the box looks for the name among
   * what comes.
   */
  exact?: boolean;
}

export type ResolvedFilterCondition = Omit<FilterCondition, 'valueFrom' | 'value'> & { value: JsonValue };

export interface SortOrder {
  field: string;
  desc?: boolean;
  /**
   * Nearest this place first, for a list's "Nearest first": the field is a
   * place (a GeoJSON point), or a latitude when `longitude` names its pair.
   * A data source that cannot sort by distance leaves the order as it is.
   */
  near?: { lat: number; lng: number; longitude?: string };
}

export interface ListRequest {
  model: string;
  /** The fields the list shows. */
  fields: string[];
  /** What the search bar and the open groups ask for; an `any` group is an OR. */
  filter: ResolvedFilter[];
  /** By the first, then the next: a link by its label, empty values last. */
  sort: SortOrder[];
  offset: number;
  limit: number;
  /**
   * Give also the id of every record that matches, in this order, in
   * `ListResult.allIds`: for "Select all 1,284 that match", export and bulk
   * edit. A source that leaves it out is paged through instead.
   */
  allIds?: boolean;
}

export interface ListResult {
  records: ListedRecord[];
  /** How many records match in all, for the pager. */
  total: number;
  /** With `allIds`: every matching record's id. Fewer than `total` means the source stopped short, and the page says so. */
  allIds?: RecordId[];
}

/** One row of a list. */
export interface ListedRecord {
  id: RecordId;
  values: Values;
  /** Its version, for a bulk edit that saves it to carry. */
  version?: RecordVersion;
  /** What the person may do with it: its row's buttons and a bulk edit keep to it. */
  can?: RecordPermissions;
}

/** Which list's views (`views`, `saveView`, `deleteView`): the page, its model and the list on it. */
export interface ViewsRequest {
  pageId: string;
  model: string;
  /** The list's id on the page (its layout's `id`): a page may hold more than one. */
  list: string;
}

/** A column as a list keeps it for a person: shown or hidden, in its place in their order, and its width in pixels where they sized it. */
export interface ColumnState {
  colId: string;
  width?: number | null;
  hide?: boolean;
}

/** How a list stands, as a saved view keeps it. */
export interface ViewState {
  /** Its search, as the search bar's chips: the filters on, the fields grouped by, a field's values, a person's own conditions. */
  facets: Facet[];
  /** The keys chosen from its headers, the first leading; none or left out: the list's own order. */
  sort?: SortOrder[];
  /** The columns, in the person's order, those hidden marked — where the list lets a person choose (`optionalColumns`). */
  columns?: ColumnState[];
}

/** A view kept on the app's server: what `views` answers, and `saveView` gives back. */
export interface SavedView {
  /** The source's own key for it. */
  id: string;
  name: string;
  state: ViewState;
  /** Shared with the team: everyone who opens this list is offered it. Else the person's own alone. */
  shared?: boolean;
  /** The list opens on it: the person's own default first, else the team's (a shared one). */
  isDefault?: boolean;
  /** The person's own: theirs to keep again and delete. Another's shared view is only put on. */
  mine?: boolean;
  /** Who made it, said beside another's shared view: "Mona Adel". */
  by?: string;
}

/** A view to keep: new, or one of the person's own by its `id`. */
export interface SaveViewRequest extends ViewsRequest {
  view: { id?: string; name: string; state: ViewState; shared?: boolean; isDefault?: boolean };
}

/** One of the person's own views to delete, by its `id`. */
export interface DeleteViewRequest extends ViewsRequest {
  id: string;
}

/**
 * How a date's records are grouped: by the day, week, month, quarter or year
 * each falls in rather than by its exact value. Each group's `value` is then
 * the first day of its span — "2026-03-01" for March 2026, "2026-03-09" for
 * the week from 9 March — the page writing its words ("March 2026", "Week 11,
 * 2026"); the groups in time order, those with no date last. `spanStart`
 * counts a value's span as a source should.
 */
export interface GroupInterval {
  /** For a date or a date and time field: group by the span each record falls in. */
  interval?: DateInterval;
  /** With `interval: "week"`: the day a week starts on, 0 Sunday to 6 Saturday — the page's language's. */
  weekStart?: number;
  /** With `interval`, for a date and time field: the time zone its days are told in (IANA: "Africa/Cairo") — the page's. */
  timeZone?: string;
}

export interface GroupRequest extends GroupInterval {
  model: string;
  field: string;
  filter: ResolvedFilter[];
}

/**
 * The records under one value of a field: a link's by its id, a record of links (a many2many) under each of its links
 * — tags counted as a server groups them, a list's filter counting each — and those with none as a group of their own
 * (value null).
 */
export interface Group {
  value: JsonValue;
  label: string;
  count: number;
}

/** How a field is totalled: added up, averaged, its least or its most, or how many records hold a value in it. */
export type TotalKind = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface TotalsRequest extends GroupInterval {
  model: string;
  /** The list's search, as `list` gets it. For the ticked rows alone, add `{ field: 'id', op: 'in', value: ids }`. */
  filter: ResolvedFilter[];
  /** What to total, by field: `{ amount: ['sum'], hours: ['sum', 'avg'] }`. */
  totals: Record<string, TotalKind[]>;
  /** Total under each value of this field as well, grouped as `groups` groups it (by `interval`, for a date): a Group By heading's sums. */
  groupBy?: string;
  /**
   * The field holding each amount's currency, by the money field, where each
   * record keeps its own: `{ amount: 'currency_id' }`. Such an amount is
   * totalled within one currency only: over records in more than one, its
   * sum, average, least and most are null — no honest number — and the
   * result names the currency of those it could total (`currencies`).
   */
  currencies?: Record<string, string>;
}

/**
 * Each field's totals, by field and then by kind: `totals.amount.sum`. The
 * sum and the count of nothing are 0, the others null. A total the source
 * cannot make honestly — amounts in more than one currency — is null, and
 * the page shows none.
 */
export type Totals = Record<string, Partial<Record<TotalKind, number | null>>>;

export interface TotalsResult {
  /** How many records match. */
  count: number;
  totals: Totals;
  /** With `groupBy`: each value's totals, in the order `groups` gives them. */
  groups?: TotalsGroup[];
  /**
   * With `currencies` asked: the currency each money field's totals are in,
   * by field, as its currency field holds it (a link as `{ id, label }`, a
   * code as "EGP"); null where its records hold more than one, or none. A
   * page writes an amount's total only in a currency it knows: the field's
   * own, or the one named here.
   */
  currencies?: Record<string, JsonValue>;
}

export interface TotalsGroup extends Group {
  totals: Totals;
  /** The currency of each money field's totals under this value, as `TotalsResult.currencies` says it. */
  currencies?: Record<string, JsonValue>;
}

/**
 * A file to store: what an upload reads of a browser's `File`. Core names no
 * DOM types; an adapter may type its parameter `File` and hand it to `fetch`
 * or a storage SDK as it is.
 */
export interface UploadFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** An `AbortSignal`, as far as an upload listens to it. */
export interface UploadSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface UploadRequest {
  /** The page's model: for a saved form placed in a record, the record's. */
  model: string;
  /**
   * The file or picture field the file is for. In a saved form placed in a
   * record, whose answers the record keeps under the part's name, the field's
   * place in them: `consent.doc`, as a line's table is `consent.items`.
   */
  field: string;
  /** The record it is for; null while that record is new — its first save links the file to it. */
  recordId: RecordId | null;
  /** For a field on a line of a table: the table's field, the line's key and, once saved, its id. */
  line?: { field: string; key: string; id?: RecordId };
  /** Aborts when the person takes the file away or leaves before it is stored: stop, and reject with an error named `AbortError`. */
  signal?: UploadSignal;
  /** How far it has got, bytes sent of the bytes in all, for its progress bar; without a call the bar moves with no number. */
  onProgress?: (sent: number, total: number) => void;
}

/** A stored file, as the field keeps it — a `FileValue` with its link instead of its bytes. */
export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  /** Its id, where the source keeps files as records of their own (Flectra's attachments): a save links it by this. */
  fileId?: RecordId;
}

/**
 * A filter as a search receives it: each `valueFrom` already replaced by its
 * value. An adapter must keep the groups: `any` is an OR, `all` an AND.
 */
export type ResolvedFilter = ResolvedFilterCondition | { any: ResolvedFilter[] } | { all: ResolvedFilter[] };

export interface SubmitRequest {
  pageId: string;
  /** The answers to the questions that were shown. Skipped steps are left out. */
  values: Values;
  /** On a page with a bot check (`botCheck`): what it saw, for the app to decide on. The page never refuses a send for it. */
  bot?: BotReport;
  /** The key of the draft these answers were kept in on the server (`saveDraft`): the source may let it go, or mark it sent. */
  draft?: string;
  /**
   * On a page that draws its order or some of its questions (`order: "random"`, `draw`): for each part drawn, its parts'
   * ids in the order this person was shown — those not drawn left out, their answers not among `values`.
   */
  order?: Record<string, string[]>;
  /**
   * On a page with a time limit (`timeLimit`): when the person pressed Start, as ISO, and whether the time ran out — the
   * answers then sent as they stood. A step's limit run out says `timeUp: false` with no `started`. The browser's clock:
   * a server that must be sure keeps its own.
   */
  started?: string;
  timeUp?: boolean;
  /** The emails and phones proved by a code (`options.verify`), by field: the value and the app's own proof, to trust it by. */
  verified?: Record<string, VerifiedValue>;
  /** The payment the answers waited for (a page's `payment`), taken: its amount, currency, key and the provider's reference. */
  payment?: PaidPayment;
  /**
   * A send kept on the device without signal and sent later (a page's `outbox`): its key — the same for every try, so a
   * server that kept the first can tell a second — and when it was made.
   */
  queued?: { key: string; at: string };
}

/**
 * What a page's bot check saw as its answers were sent. A person never fills the hidden box and takes longer than a
 * few seconds; a send that is either is likely a bot's — or a person's whose browser filled every box at once, which is
 * why the app decides: keep it aside, ask the captcha's service, or refuse it.
 */
export interface BotReport {
  /** The hidden box was filled: no person sees it, reaches it with Tab or hears it read out. */
  honeypot: boolean;
  /** Sent sooner than the page's `minSeconds` after it was shown, or started again. */
  tooFast: boolean;
  /** Seconds from the page shown (or started again) to this send, to a tenth. */
  seconds: number;
  /** The captcha's token, on a page with one (`botCheck.captcha`), for the app to check with its service: null when none came. */
  captcha?: string | null;
}

export interface SubmitResult {
  /** The id the app gave the response: a booking's reference ("B-1043"), a ticket's number. An ending's words say it as `{id}`. */
  id?: RecordId;
  /**
   * Values the app worked out as it kept the response, by the page's fields — a reference field it filled in, the time
   * it confirmed — laid over the answers sent where an ending reads them (its `when` and its `{field}`s). The form's
   * answers themselves stay as they were sent.
   */
  values?: Values;
  /**
   * A quiz's results as the app marked them on its server (`quiz` on the page), shown in place of those the page works
   * out: for a test that keeps its right answers out of the page. See `QuizResults`.
   */
  quiz?: QuizResults;
}

/**
 * What changed, using the operation names Odoo gives its x2many commands, so
 * an adapter maps them one to one.
 */
export interface RecordChanges {
  /** Changed values of every field that is not one2many or many2many. */
  values: Values;
  /** one2many changes, per field. */
  lines: Record<string, LineOp[]>;
  /** many2many changes, per field. */
  links: Record<string, LinkOp[]>;
}

export type LineOp =
  | { op: 'create'; key: string; values: Values }
  | { op: 'update'; id: RecordId; values: Values }
  | { op: 'delete'; id: RecordId };

export type LinkOp =
  | { op: 'link'; id: RecordId }
  | { op: 'unlink'; id: RecordId }
  | { op: 'set'; ids: RecordId[] }
  | { op: 'clear' };

/**
 * Why a save was refused, so each kind is shown where it belongs: `fields`
 * under those fields, a `rule` (a backend's business rule) in a dialog,
 * `network` in a banner with Retry, `other` beside Save with Retry, and a
 * `conflict` with Reload and Keep mine.
 */
export interface SaveProblem {
  /** `stopped`: a step of the page's `beforeSave` stopped it, with `reason` — no data source was asked. */
  kind: 'fields' | 'rule' | 'network' | 'other' | 'stopped' | 'conflict';
  message: string;
  /** For `fields`: a message for each field, by name. */
  fields?: Record<string, string>;
  /** For `stopped`: why the step stopped. */
  reason?: RunStop;
  /** For `conflict`: who changed the record, when, and what it holds now. */
  conflict?: SaveConflict;
}

/** Someone else saved the record after this page opened it. */
export interface SaveConflict {
  /** The version the record has now, with who changed it and when. Saving with it is "Keep mine". */
  version: RecordVersion;
  /**
   * The record as the other person left it, when the source has it: what
   * Reload shows without asking again, and what a source that saves whole
   * records keeps of theirs under Keep mine — their values, with this
   * person's changes over them.
   */
  theirs?: Values;
}

/**
 * What a source's save throws when the record changed after the page opened
 * it: `saveProblemOf` reads it as a `conflict`, and the page names who
 * changed it and when (`conflict.version.by`, `.at`) and offers Reload or
 * Keep mine.
 */
export class ConflictError extends Error {
  readonly conflict: SaveConflict;
  readonly problem: SaveProblem;
  constructor(conflict: SaveConflict, message = 'Someone else changed this record after it was opened') {
    super(message);
    this.name = 'ConflictError';
    this.conflict = conflict;
    this.problem = { kind: 'conflict', message, conflict };
  }
}

/** An error for a data source's save to throw when the backend refuses it. */
export function saveRefused(problem: SaveProblem): Error & { problem: SaveProblem } {
  return Object.assign(new Error(problem.message), { problem });
}

/** What a failed save tells: its own problem, a failed fetch as the network, anything else as it is. */
export function saveProblemOf(error: unknown): SaveProblem {
  const carried = (error as { problem?: SaveProblem } | null)?.problem;
  if (carried && typeof carried.kind === 'string') return carried;
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) return { kind: 'network', message };
  return { kind: 'other', message };
}

/** What a booking's free times are asked with: the days, the zone they are in, and what the page knows of the booking. */
export interface SlotsRequest {
  /** The page's model, for a record page; empty for a responses page. */
  model: string;
  /** The date and time field booked. */
  field: string;
  /** The record booked, so its own booking counts as free for it; null for a new one. */
  recordId: RecordId | null;
  /** The schedule the field's node names (`options.schedule`): a doctor's, a showroom's. The field's name unless it names one. */
  schedule: string;
  /** The first and the last day asked, both included, as 2026-10-01: days in `timeZone`. */
  from: string;
  to: string;
  /** The zone the days are in, by its IANA name: the field's, its page's, or the browser's. */
  timeZone: string;
  /** The minutes a booking lasts, and those kept free between two, as the page says (`options.length`, `options.between`). */
  length?: number;
  between?: number;
  /** Every value of the form: the doctor, the service, the car to drive. */
  values: Values;
}

/** What a day is for booking: times free on it, all taken, not open, or a holiday. */
export type SlotDayState = 'open' | 'full' | 'closed' | 'holiday';

/** One day of a booking's: its state and the times a booking may start on it. */
export interface SlotDay {
  state: SlotDayState;
  /** The times free, as instants (ISO 8601, in UTC or with their offset: 2026-10-15T09:30:00+03:00), earliest first. */
  free?: string[];
  /** Words for the day, in the person's language: a holiday's name, why it is closed. */
  note?: string;
}

/** The days asked, each by its date (2026-10-15): a day left out is closed. */
export interface SlotsResult {
  days: Record<string, SlotDay>;
  /** The minutes a booking lasts, when the source knows better than the page: the service's own length. */
  length?: number;
}

/**
 * A new record's save, made from its values alone — as a list's Import saves a row where the source has no
 * `createMany`, and a memory source makes each of `createMany`'s: every value in `values`, the links of a many2many
 * as one `set`, the rest as changes.
 */
export function newRecordSave(model: string, fields: Fields, values: Values): SaveRequest {
  const changes: RecordChanges = { values: {}, lines: {}, links: {} };
  for (const [name, value] of Object.entries(values)) {
    if (fields[name]?.type === 'many2many') changes.links[name] = [{ op: 'set', ids: Array.isArray(value) ? (value as RelatedRecord[]).map((record) => record.id) : [] }];
    else changes.values[name] = value;
  }
  return { model, id: null, fields, changes, values };
}
