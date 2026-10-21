import type { ActionRequest, Locale, Theme } from '@fieldia/core';
import { loadParts, mountViewer, openFormDialog, type FormDialogResult, type Skin, type ViewerOptions } from '@fieldia/viewer';
import { quietPart, themesPart, type WidgetFactory } from '@fieldia/widgets';
import { gridWidgets } from '@fieldia/grid';
import { codeWidgets } from '@fieldia/code';
import { createMonacoWidgets, monacoWidgets } from '@fieldia/monaco';
import { demoListViews, demoMaps, demoMapWidgets } from '../shared/maps';
import { clicked, greeting, shout } from '../shared/custom-page';
import { chatterSlot } from '@fieldia/chatter';
import { sampleChatter } from '../shared/sample-chatter';
import { buyerBar, enquiryChatterOptions } from '../shared/enquiry';
import { historySlot } from '@fieldia/chatter';
import { wiHistoryChatter } from '../shared/wi-history';
import { appPages, openRecord, opensRows, optionsFromQuery, pageFromQuery, pages, recordFromQuery, sampleDataSource } from '../shared/sample-data';
import { openByRoute, valuesFromQuery } from '../shared/related-lists';
import { panelBar } from '../shared/panel-demo';
import { answerAction } from '../shared/order-desk';
import { timeFirstPaint } from '../shared/timing';
import { wiHeadAction, wiHeadTokens } from '../shared/wi-header';
import { wiTextDiscussion } from '../shared/wi-text';
import { errorLog, plannerSlot, priceTag } from '../shared/contained';
import { photosBar } from '../shared/listing-photos';
import { botLog, captchaSlot } from '../shared/captcha';
import { meanwhileBar } from '../shared/test-drive';
import { lastPlacesBar } from '../shared/event-signup';
import { signedInBar } from '../shared/approvals';
import { addressFollowsRecord } from '../shared/address';
import { priceListBar } from '../shared/editable-lists';

/**
 * Fieldia with no framework at all: one script, one call. The page, skin and
 * direction come from the query string, so tests and people see the same thing.
 */
const params = new URLSearchParams(location.search);
const name = params.get('page') ?? 'signup';
const page = pageFromQuery(params);
const dataSource = sampleDataSource();
const chatter = sampleChatter();
const actions: string[] = [];
/** Every button press in full, with the records chosen in a list. */
const requests: ActionRequest[] = [];

/** The badge field, as a plain-DOM widget. */
const shoutWidget: WidgetFactory = ({ form, name: field, id, document }) => {
  const input = document.createElement('input');
  input.id = id;
  input.className = 'fd-input';
  const preview = document.createElement('output');
  const element = document.createElement('span');
  element.className = 'demo-shout';
  element.append(input, preview);
  input.addEventListener('input', () => form.setValue(field, input.value || null));
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const text = String(state.value ?? '');
      if (input.value !== text) input.value = text;
      preview.textContent = shout(state.value);
    },
  };
};

/**
 * VS Code's editor for the code page's `"widget": "monaco"` fields: code coloured with no worker, or, with
 * `?workers=1`, JSON checked as it is typed by Monaco's own JSON worker, built beside the demo (workers/).
 */
const monaco =
  params.get('workers') === '1'
    ? createMonacoWidgets({
        getWorker: (_id, label) => new Worker(new URL(`./workers/${label === 'json' ? 'json' : 'editor'}.worker.js`, import.meta.url), { type: 'module' }),
        services: ['json'],
      })
    : monacoWidgets;

/** "A part that fails": what onError is told, listed under the form (shared/contained.ts). */
const failures = name === 'contained' ? errorLog(document) : null;
if (failures) document.getElementById('app')?.after(failures.element);

const options: ViewerOptions = {
  page,
  dataSource,
  recordId: recordFromQuery(params, page),
  // A new record its address fills in: a customer's quotation made with New, by the app's own route.
  values: valuesFromQuery(params),
  // A list's row opens its record's page; a list changed in place has none to open.
  ...(opensRows(params) ? { onOpenRecord: (id: string | number) => openRecord(params, id) } : {}),
  // The app's own route for a customer's invoices (View all): the list's address, kept to that customer's.
  onOpen: (request) => openByRoute(params, request),
  skin: (params.get('skin') as Skin | null) ?? undefined,
  theme: (params.get('theme') as Theme | null) ?? undefined,
  dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
  locale: (params.get('locale') as Locale | null) ?? undefined,
  onAction: (request) => {
    actions.push(request.action);
    requests.push(request);
    // The shop's answers to the pages' steps: the stock checked for "Order by phone"; and a press with nothing to show
    // says what the app was given.
    return answerAction(request, params.get('locale') ?? undefined, { page, source: dataSource });
  },
  widgets: { 'char.name-badge': shoutWidget, 'monetary.tag': priceTag, ...gridWidgets, ...codeWidgets, ...monaco, ...demoMapWidgets },
  // Told of each part that fails, which then shows a small box in its place: "A part that fails" lists them.
  onError: failures?.onError,
  // A list with `map` shows its records on one too.
  listViews: demoListViews,
  // A page's own maps, with their layers: the order coming to its door.
  maps: demoMaps,
  pages: appPages,
  ...optionsFromQuery(params),
  slots: {
    // The sign-up's captcha: a stand-in for the app's own Turnstile, reCAPTCHA or hCaptcha (shared/captcha.ts).
    captcha: captchaSlot,
    // The app's delivery planner, which fails as it loads ("A part that fails").
    planner: plannerSlot,
    // The record's conversation, to-dos and followers, beside it.
    chatter: chatterSlot({ source: chatter, ...enquiryChatterOptions(params), locale: (params.get('locale') as Locale | null) ?? undefined, dir: params.get('dir') === 'rtl' ? 'rtl' : undefined }),
    // A work item's Discussion: a comment box, then a card for each comment (shared/wi-text.ts).
    discussion: wiTextDiscussion(params, dataSource),
    note: (element, { form }) => {
      let clicks = 0;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fd-button';
      button.textContent = clicked(0);
      button.addEventListener('click', () => (button.textContent = clicked(++clicks)));
      const hello = document.createElement('p');
      hello.className = 'demo-hello';
      const show = () => (hello.textContent = greeting(form.getState().values['badge_name']));
      show();
      const leave = form.subscribe(show);
      element.className += ' demo-note';
      element.append(hello, button);
      return leave;
    },
    // A bug's history, as its History tab shows it: the State Graph, then each change with its before and after.
    history: historySlot({
      source: wiHistoryChatter(),
      stateField: 'state',
      reasonField: 'reason',
      kind: 'work item',
      locale: (params.get('locale') as Locale | null) ?? undefined,
      dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
    }),
  },
};
// The parts the page draws from (a date's box, a work item's head), in before it is mounted, as an app that wants its
// page drawn the moment it mounts loads them: what is timed is the page drawn, never the wait for a file. (The
// framework demos mount at once, and the viewer waits for them itself.) And the parts of the look the address gives
// it — a theme, the quiet skin — which the viewer would otherwise wear as they come.
await Promise.all([
  loadParts(page, options.widgets, options.slots),
  options.theme ? themesPart.load() : undefined,
  options.skin === 'quiet' ? quietPart.load() : undefined,
]).catch(() => undefined);
const opened = timeFirstPaint('viewer');
const handle = mountViewer(document.getElementById('app') as HTMLElement, options);
opened();
// The address in step with the record shown: Reload and Back show the one on screen (shared/address.ts).
addressFollowsRecord(handle.form, page);

/**
 * `&open=dialog`: the page's record opened again in a large popup over the page,
 * as a work item opens over its backlog — 96px in from the window's sides, no
 * dimming, ⤢ and a grip. What it closes with is kept in `fieldiaDialog.results`.
 */
if (params.get('open') === 'dialog') {
  const locale = (params.get('locale') as Locale | null) ?? undefined;
  const dark = params.get('scheme') === 'dark' || (params.get('scheme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const results: FormDialogResult[] = [];
  const open = () =>
    openFormDialog({
      page,
      dataSource,
      recordId: recordFromQuery(params, page),
      title: page.title ?? name,
      size: 'inset',
      backdrop: 'clear',
      maximise: true,
      resizable: true,
      skin: (params.get('skin') as Skin | null) ?? undefined,
      theme: (params.get('theme') as Theme | null) ?? undefined,
      dir: params.get('dir') === 'rtl' ? 'rtl' : undefined,
      locale,
      pages: appPages,
      ...(name === 'wi-head' ? { tokens: wiHeadTokens(dark) } : {}),
      onAction: (request) => {
        actions.push(request.action);
        requests.push(request);
        return wiHeadAction(request) ?? answerAction(request, locale, { page, source: dataSource });
      },
    }).then((result) => void results.push(result));
  void open();
  Object.assign(window, { fieldiaDialog: { results, open } });
}

/** What each side panel handed back. */
const panelResults: FormDialogResult[] = [];
// "Every field" has a bar over it: a call logged beside the page, in a side panel, its look and language the page's.
if (name === 'fields') {
  const skin = (params.get('skin') as Skin) ?? 'underline';
  const locale = (params.get('locale') as Locale | null) ?? undefined;
  const dir = params.get('dir') === 'rtl' ? 'rtl' : undefined;
  document.getElementById('app')?.before(panelBar({ dataSource, pages: appPages, skin, locale, dir, look: page.look }, panelResults));
}

// The sign-up says under it what the app was told with each response: its bot check's report (shared/captcha.ts).
if (name === 'signup') document.getElementById('app')?.after(botLog(document, handle.form));

// The listing has a bar over it: ten photos as a phone takes them, added at once (shared/listing-photos.ts).
if (name === 'listing-photos') document.getElementById('app')?.before(photosBar());

// The test drive has a bar over it: someone else books a time on another screen (shared/test-drive.ts).
if (name === 'test-drive') document.getElementById('app')?.before(meanwhileBar(dataSource));
// The price list has a bar over it: someone else changes a price on another screen (shared/editable-lists.ts).
if (name === 'service-prices') document.getElementById('app')?.before(priceListBar(dataSource));
// The sign-up has a bar over it: two people take the morning's last places on other screens (shared/event-signup.ts).
if (name === 'event-signup') document.getElementById('app')?.before(lastPlacesBar(dataSource));
// The enquiry has a bar over it: the buyer's phone reads what was sent and writes back (shared/enquiry.ts).
if (name === 'enquiry') document.getElementById('app')?.before(buyerBar(chatter));
// A purchase order's and an expense's approvals: who uses the demo, and the others to sign in as (shared/approvals.ts).
const signedIn = signedInBar(params);
if (signedIn) document.getElementById('app')?.before(signedIn);

// `pageNames`: every page `?page=` opens, for the browser test that each is named for what it shows; `pages` themselves,
// for the one that each draws the sample records' values as their kind is.
Object.assign(window, { fieldiaDemo: { handle, dataSource, actions, requests, chatter, panelResults, pageNames: Object.keys(pages), pages } });
