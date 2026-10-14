/**
 * The Code drawer's code: the demo's page as JSON, and the code that shows
 * it with no framework, in React, in Vue and in Angular. Each names exactly
 * what the page needs beyond the viewer itself, read from the page: the
 * grid, CodeMirror or VS Code's editor for its code fields, its maps (a
 * place or an area, a list's map, a form's map, the borders its areas are
 * shaded by), a list's calendar and the page its new records open in, the
 * chatter beside a record. What is copied draws the page as the demo does.
 */

/** What a page uses beyond the viewer's own widgets, found by walking it. */
export function pageNeeds(page) {
  const needs = { grid: false, code: false, monaco: false, mapFields: false, listMap: false, listCalendar: null, formMap: false, chatter: false, own: false, priceTag: false, slots: new Set(), regions: new Set(), reach: false };
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const widget = node.widget;
    if (widget === 'grid') needs.grid = true;
    if (widget === 'code') needs.code = true;
    if (widget === 'monaco') needs.monaco = true;
    if (widget === 'place' || widget === 'area' || widget === 'address-search') needs.mapFields = true;
    if (widget === 'shout') needs.own = true;
    // "A part that fails": the app's price tag (demos/shared/contained.ts).
    if (widget === 'tag') needs.priceTag = true;
    if (node.type === 'map') needs.formMap = true;
    if (node.type === 'slot' && node.name === 'chatter') needs.chatter = true;
    // A slot the app fills with its own content.
    else if (node.type === 'slot' && typeof node.name === 'string') needs.slots.add(node.name);
    if (node.regions && typeof node.regions.from === 'string') needs.regions.add(node.regions.from);
    if (node.reachable) needs.reach = true;
    for (const value of Object.values(node)) walk(value);
  };
  walk(page?.layout);
  if (page?.layout?.type === 'list' && page.layout.map) needs.listMap = true;
  // A list's calendar, and the model its new records are made in.
  if (page?.layout?.type === 'list' && page.layout.calendar) needs.listCalendar = page.data?.model ?? 'record';
  // A field's own widget, by its field's definition: a json field drawn as code.
  for (const field of Object.values(page?.fields ?? {})) walk(field);
  return needs;
}

/** The viewer's options this demo sets from its address: its look, language and behaviour. */
function looks(params) {
  const options = [];
  const skin = params.get('skin');
  if (skin) options.push(['skin', `'${skin}'`]);
  if (params.get('theme')) options.push(['theme', `'${params.get('theme')}'`]);
  for (const key of ['locale', 'dir', 'saveStatus']) if (params.get(key)) options.push([key, `'${params.get(key)}'`]);
  for (const key of ['readonly', 'editSwitch', 'showValid']) if (params.get(key) === '1') options.push([key, 'true']);
  return options;
}

/** The imports, the settings and the options a page's needs bring, the same in every framework. */
function parts(needs) {
  const imports = [];
  const setup = [];
  const options = [];
  const widgets = [];
  const mapUse = needs.mapFields || needs.listMap || needs.formMap;
  if (needs.grid) {
    imports.push("import { gridWidgets } from '@fieldia/grid';");
    widgets.push('...gridWidgets');
  }
  if (needs.code) {
    imports.push("import { codeWidgets } from '@fieldia/code';");
    widgets.push('...codeWidgets');
  }
  if (needs.monaco) {
    imports.push("import { monacoWidgets } from '@fieldia/monaco';");
    widgets.push('...monacoWidgets');
  }
  if (mapUse) {
    const from = ['openStreetMap', ...(needs.mapFields ? ['mapWidgets'] : []), ...(needs.listMap ? ['mapListViews'] : []), ...(needs.formMap ? ['mapParts'] : [])].sort();
    imports.push(`import { ${from.join(', ')} } from '@fieldia/map';`);
    const regions = [...needs.regions].map((name) => `\n    '${name}': () => fetch('/geo/${name}.json').then((r) => r.json()),`).join('');
    setup.push(
      [
        '// The maps, once for every page: your provider (azureMaps, googleMaps, mapbox) in place of',
        "// OpenStreetMap's, which is for demos.",
        'const mapSettings = {',
        '  provider: openStreetMap(),',
        '  center: { lat: 30.0444, lng: 31.2357 },',
        ...(regions ? [`  // The borders the page's areas are shaded by: your own GeoJSON.\n  regions: {${regions}\n  },`] : []),
        ...(needs.reach ? ["  // The area within some minutes: azureMaps or mapbox work it out, or a function of your own.\n  reach: ({ at, minutes, mode }) => yourReach(at, minutes, mode),"] : []),
        '};',
      ].join('\n')
    );
    if (needs.mapFields) widgets.push('...mapWidgets(mapSettings)');
    if (needs.listMap && !needs.listCalendar) options.push(['listViews', 'mapListViews(mapSettings)']);
    if (needs.formMap) options.push(['maps', 'mapParts(mapSettings)']);
  }
  if (needs.listCalendar) {
    // The calendar, and the page a slot pressed opens a new record in, in a dialog with its start and end filled in.
    imports.push("import { calendarListViews } from '@fieldia/calendar';", "import recordPage from './record.page.json'; // the page one of these records opens in");
    options.push(['listViews', needs.listMap ? '{ ...mapListViews(mapSettings), ...calendarListViews() }' : 'calendarListViews()']);
    options.push(['pages', `{ '${needs.listCalendar}': recordPage }`]);
  }
  // Your own widget, by its field's type and its name.
  if (needs.own) widgets.push("'char.shout': yourShoutWidget");
  if (needs.priceTag) widgets.push("'float.tag': yourPriceTag");
  if (widgets.length) options.unshift(['widgets', widgets.length === 1 && !widgets[0].startsWith("'") ? widgets[0].slice(3) : `{ ${widgets.join(', ')} }`]);
  if (needs.chatter) imports.push("import { chatterSlot } from '@fieldia/chatter';");
  return { imports, setup, options };
}

const capital = (name) => name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

/** The code for each tab, for this page and this demo's address. */
export function snippets(page, params) {
  const name = page?.id ?? 'page';
  const needs = pageNeeds(page);
  const { imports, setup, options } = parts(needs);
  const look = looks(params);
  const enterToNext = params.get('enterToNext') === '1';
  const translate = !!params.get('translate');
  const before = (lines) => (lines.length ? `${lines.join('\n')}\n` : '');
  const afterImports = setup.length ? `\n${setup.join('\n\n')}\n` : '';
  // The slots: the chatter, and the app's own content by each slot's name.
  const own = [...needs.slots];
  const slotsJs = [...(needs.chatter ? ['chatter: chatterSlot({ source: yourChatter })'] : []), ...own.map((slot) => `${slot}: your${capital(slot)}`)];
  const chatterJs = slotsJs.length ? [['slots', `{ ${slotsJs.join(', ')} }`]] : [];
  // A page whose parts may fail ("A part that fails"): told of each, which then shows a box in its place.
  const failing = needs.priceTag;
  const jsOptions = [
    ...options,
    ...chatterJs,
    ...(failing ? [['onError', '(error, where) => yourErrorLog(error, where)']] : []),
    ...look,
    ...(enterToNext ? [['keys', '{ enterMovesToNext: true }']] : []),
    ...(translate ? [['translate', '(text) => catalog[text] ?? text']] : []),
  ];

  const js = `import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
${before(imports)}import page from './${name}.page.json';
${afterImports}
mountViewer(document.getElementById('app'), {
  page,
  dataSource: createMemoryDataSource(), // or your own, talking to your server${jsOptions.map(([key, value]) => `\n  ${key}: ${value},`).join('')}
});`;

  // The frameworks: the same options as props, defined once beside the component.
  const source = 'const dataSource = createMemoryDataSource(); // or your own, talking to your server';
  const consts = [source, ...options.map(([key, value]) => `const ${key} = ${value};`), ...(failing ? ['/** Told of each part that fails, which shows a box in its place; the rest of the form goes on. */', 'const onError = (error, where) => yourErrorLog(error, where);'] : [])];
  const attrs = (pattern) => [...options.map(([key]) => pattern(key, key, true)), ...look.map(([key, value]) => pattern(key, value.replace(/^'|'$/g, ''), value === 'true'))].join(' ');

  const reactChatter = needs.chatter
    ? `
/** The chatter beside the record: a box it mounts into, for as long as the slot lives. */
function Chatter({ form }) {
  const box = useRef(null);
  useEffect(() => chatterSlot({ source: yourChatter })(box.current, { form }), [form]);
  return <div ref={box} />;
}
`
    : '';
  const react = `${needs.chatter ? "import { useEffect, useRef } from 'react';\n" : ''}import { FieldiaForm } from '@fieldia/react';
import { createMemoryDataSource } from '@fieldia/core';
${before(imports)}import page from './${name}.page.json';
${afterImports}
${consts.join('\n')}
${reactChatter}
export function Screen() {
  return <FieldiaForm page={page} dataSource={dataSource} ${attrs((key, value, bound) => (bound ? `${key}={${value}}` : `${key}="${value}"`))}${failing ? ' onError={onError}' : ''}${slotsJs.length ? ` slots={{ ${[...(needs.chatter ? ['chatter: Chatter'] : []), ...own.map((slot) => `${slot}: Your${capital(slot)}`)].join(', ')} }}` : ''} />;
}`.replace(/ {2,}\/>/g, ' />');

  const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const vueChatter = needs.chatter
    ? `
// The chatter beside the record: a box it mounts into, for as long as the slot lives.
const Chatter = defineComponent({
  props: ['form'],
  setup(props) {
    const box = ref(null);
    let done;
    onMounted(() => (done = chatterSlot({ source: yourChatter })(box.value, { form: props.form })));
    onBeforeUnmount(() => done?.());
    return () => h('div', { ref: box });
  },
});`
    : '';
  const vue = `<script setup lang="ts">
${needs.chatter ? "import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';\n" : ''}import { FieldiaForm } from '@fieldia/vue';
import { createMemoryDataSource } from '@fieldia/core';
${before(imports)}import page from './${name}.page.json';
${afterImports}
${consts.join('\n')}${vueChatter}
</script>

<template>
  <FieldiaForm :page="page" :data-source="dataSource" ${attrs((key, value, bound) => (bound ? `:${kebab(key)}="${value}"` : `${kebab(key)}="${value}"`))}${failing ? ' @error="onError"' : ''}${
    slotsJs.length
      ? `>${needs.chatter ? `
    <template #chatter="{ form }"><Chatter :form="form" /></template>` : ''}${own.map((slot) => `
    <template #${slot}="{ form }"><Your${capital(slot)} :form="form" /></template>`).join('')}
  </FieldiaForm>`
      : ' />'
  }
</template>`.replace(/ {2,}(\/?>)/g, ' $1');

  const angularChatter = needs.chatter
    ? `
/** The chatter beside the record, mounted into its own element. */
@Component({ selector: 'app-chatter', template: '' })
class ChatterComponent implements AfterViewInit {
  @Input() form!: Form;
  private readonly host = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  ngAfterViewInit() {
    this.destroyRef.onDestroy(chatterSlot({ source: yourChatter })(this.host.nativeElement, { form: this.form }));
  }
}
`
    : '';
  const fields = options.map(([key, value]) => `  readonly ${key} = ${value};`);
  const angular = `import { ${needs.chatter ? 'AfterViewInit, Component, DestroyRef, ElementRef, Input, inject' : 'Component'} } from '@angular/core';
import { FieldiaFormComponent${slotsJs.length ? ', FieldiaSlotDirective' : ''} } from '@fieldia/angular';
import { createMemoryDataSource${needs.chatter ? ', type Form' : ''} } from '@fieldia/core';
${before(imports)}import page from './${name}.page.json';
${afterImports}${angularChatter}
@Component({
  imports: [FieldiaFormComponent${slotsJs.length ? ', FieldiaSlotDirective' : ''}${needs.chatter ? ', ChatterComponent' : ''}${own.map((slot) => `, Your${capital(slot)}Component`).join('')}],
  template: \`<fieldia-form [page]="page" [dataSource]="dataSource" ${attrs((key, value, bound) => (bound ? `[${key}]="${value}"` : `${key}="${value}"`))}${failing ? ' (partError)="failed($event)"' : ''}${
    slotsJs.length
      ? `>${needs.chatter ? `
    <ng-template fieldiaSlot="chatter" let-form><app-chatter [form]="form" /></ng-template>` : ''}${own.map((slot) => `
    <ng-template fieldiaSlot="${slot}" let-form><your-${slot} [form]="form" /></ng-template>`).join('')}
  </fieldia-form>`
      : ' />'
  }\`,
})
export class ScreenComponent {
  readonly page = page;
  readonly dataSource = createMemoryDataSource(); // or your own, talking to your server${fields.length ? `\n${fields.join('\n')}` : ''}${
    failing
      ? `
  /** Told of each part that fails, which shows a box in its place; the rest of the form goes on. */
  failed({ error, where }) {
    yourErrorLog(error, where);
  }`
      : ''
  }
}`.replace(/ {2,}(\/?>)/g, ' $1');

  return { json: JSON.stringify(page ?? {}, null, 2), js, react, vue, angular };
}

/**
 * A list's map in a page of its own (`mountListMap`): the page's JSON, and
 * the page's own script as the demo runs it — its search, its address, its
 * list lit by the pins — with the map mounted in one call.
 */
export function listMapSnippets(page) {
  const name = page?.id ?? 'page';
  const js = `import { createMemoryDataSource } from '@fieldia/core';
import { mountListMap, openStreetMap } from '@fieldia/map';
import page from './${name}.page.json';

// Your own, talking to your server: its list() reads the filter it is given.
const dataSource = createMemoryDataSource();

// The page's own search: its offer, and one area of each kind the map asked for.
let offer = 'sale';
const searches = new Map();
const filter = () => [{ field: 'offer', op: '=', value: offer }, ...[...searches.values()].flatMap((s) => s.filter)];

// Where the map opens: ?at=lat,lng,zoom, as the map wrote it there.
const params = new URLSearchParams(location.search);
const [lat, lng, zoom] = (params.get('at') ?? '').split(',').map(Number);

// The map fills its element ("height": "fill"): give it a height, a column of the page, say.
const map = mountListMap(document.getElementById('map'), {
  page,
  provider: openStreetMap(), // yours: azureMaps, googleMaps, mapbox
  dataSource,
  locale: document.documentElement.lang,
  filter,
  sort: [{ field: 'price' }],
  ...(Number.isFinite(zoom) ? { start: { center: { lat, lng }, zoom } } : {}),
  // "Search this area (24)": the source counts a view's homes when the homes on hand cannot.
  countArea: true,
  onSearch(search) {
    searches.set(search.kind, search); // "In this area", "In the area drawn": one of each
    showHomes(filter()); // your own list, from the same search
    map.reload();
  },
  onViewChange({ center, zoom }) {
    params.set('at', \`\${center.lat.toFixed(5)},\${center.lng.toFixed(5)},\${zoom}\`);
    history.replaceState(null, '', \`?\${params}\`);
  },
  onHighlight: (id) => lightRow(id), // a pin under the pointer lights its row
  onOpenRecord: (id) => openHome(id), // a card's Open
});

// Each of your rows lights its pin.
row.addEventListener('mouseenter', () => map.highlight(id));
row.addEventListener('mouseleave', () => map.highlight(null));

// Your colours, over Fieldia's: .fd-map-embed { --fd-accent: #375dfb; }`;
  return { json: JSON.stringify(page ?? {}, null, 2), js };
}

/**
 * A tracker's backlog (the backlog demo): the list page's JSON, the bug
 * page's, and the app's own script as the demo runs it — the list mounted in
 * its page with the look's tokens, a row's bug opened in the popup with its
 * discussion and its history, the address keeping it open, Follow answered.
 */
export function backlogSnippets(listPage, bugPage) {
  const js = `import { mountViewer, openFormDialog } from '@fieldia/viewer';
import { chatterSlot, historySlot } from '@fieldia/chatter';
import backlog from './${listPage?.id ?? 'backlog'}.page.json';
import bug from './${bugPage?.id ?? 'work-item-bug'}.page.json';

// Your own, talking to your server: records, and each record's comments and changes.
const dataSource = yourDataSource;
const chatter = yourChatter;
// Your look, as Fieldia's tokens: the list's and the popup's colours, corners and font.
const tokens = { text: '#1a1a1a', muted: '#707070', surface: '#ffffff', fill: '#f2f2f2', border: '#eaeaea',
  accent: '#0078d4', 'accent-soft': '#deecf9', link: '#005a9e', band: '#f8f8f8', help: '#f4f4f4', radius: '4px' };

// The backlog, in your page. A row opens its bug; once the popup closes the list asks again
// and its row has the focus back, because onOpenRecord answers with the popup's promise.
const list = mountViewer(document.getElementById('backlog'), {
  page: backlog,
  dataSource,
  tokens: { ...tokens, page: '#f8f8f8' },
  onOpenRecord: (id) => openBug(id),
});

// The bug in a large popup over the backlog, nothing dimmed; the address keeps it open.
async function openBug(id) {
  const address = new URL(location.href);
  if (id === null) address.searchParams.delete('workitem');
  else address.searchParams.set('workitem', id);
  history.replaceState(null, '', address);
  const me = { id: 3, name: 'Salma Nabil' };
  const result = await openFormDialog({
    page: bug,
    recordId: id,
    title: id === null ? 'Bug' : \`Bug \${id}\`,
    size: 'inset',
    backdrop: 'clear',
    maximise: true,
    resizable: true,
    dataSource,
    tokens,
    slots: {
      // The comment count in its head follows the comments, kept as the server has it.
      discussion: chatterSlot({ source: chatter, look: 'discussion', me,
        onCount: (count, form) => form.setValues({ comment_count: count }, { stored: true }) }),
      history: historySlot({ source: chatter, stateField: 'state', reasonField: 'reason', kind: 'work item' }),
    },
    // Follow is kept by your server: the record has nothing to save for it.
    onAction: async (request) =>
      request.action === 'follow' ? { stored: { following: await yourFollow(request.recordId) } } : undefined,
  });
  address.searchParams.delete('workitem');
  history.replaceState(null, '', address);
  if (id === null && result.saved) await list.reload();
  return result;
}

// A bug the address names opens with the page.
const asked = new URLSearchParams(location.search).get('workitem');
if (asked) openBug(Number(asked));`;
  return { json: JSON.stringify(listPage ?? {}, null, 2), bug: JSON.stringify(bugPage ?? {}, null, 2), js };
}

/**
 * A listing whose photos are stored as they are picked (the listing-photos demo): the page's JSON, the
 * demo's own script — the memory source as a slow store, one photo failing once — and the store an app
 * gives instead: uploadTo for its own endpoint, or Azure Blob through an address its server signs.
 */
export function uploadsSnippets(page, params) {
  const name = page?.id ?? 'listing-photos';
  const look = looks(params);
  const js = `import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from './${name}.page.json';

// The demo's store: the memory source, as slow as a phone sending on mobile data
// (150 KB a second), the balcony's photo failing on its first try so Retry shows.
// Your app gives its own upload() instead: see Your store.
const dataSource = createMemoryDataSource({
  records: { listing: { 1: { name: 'Garden flat with a view of the Nile', offer: 'sale', price: 9800000, district: 'zamalek', bedrooms: 3, photos: [] } } },
  storage: {
    bytesPerSecond: 150_000,
    fails: (file, attempt) => /^Balcony/.test(file.name) && attempt === 1,
  },
});

// Each photo picked is made smaller (the field's shrink: 1600 px at 0.82), then stored at once:
// the field keeps { url, name, size, type, fileId }, and Save waits for those still going.
mountViewer(document.getElementById('app'), {
  page,
  dataSource,
  recordId: 1,${look.map(([key, value]) => `\n  ${key}: ${value},`).join('')}
});`;
  const store = `import { uploadTo } from '@fieldia/core';

// Your data source, with upload() for its files: each goes as soon as it is picked, and the
// field keeps the link the answer gives — JSON { url, id }, or a Location header.
const dataSource = {
  ...yourDataSource,
  upload: uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': csrfToken } }),
};

// Or straight to Azure Blob storage, PUT to an address your server signs for each file:
// write-only, for ten minutes. The field keeps the blob's address, without the signature.
const toAzure = uploadTo({
  method: 'PUT',
  url: async (file) => (await fetch(\`/api/upload-address?name=\${encodeURIComponent(file.name)}\`)).text(),
  headers: { 'x-ms-blob-type': 'BlockBlob' },
});

// ---- your server (Node): the signed address, from the storage account's key — no SDK -----
import { createHmac, randomUUID } from 'node:crypto';

const ACCOUNT = 'yourstorage';
const CONTAINER = 'listings';
const KEY = process.env.AZURE_STORAGE_KEY; // the account's key, base64, as the portal gives it

/** A service SAS for one new blob: create and write (cw), over HTTPS, until it expires. */
export function uploadAddress(fileName) {
  const blob = \`\${new Date().toISOString().slice(0, 10)}/\${randomUUID()}-\${fileName.replace(/[^\\w.-]+/g, '-')}\`;
  const expiry = new Date(Date.now() + 10 * 60_000).toISOString().replace(/\\.\\d+Z$/, 'Z');
  const version = '2022-11-02';
  const signed = [
    'cw', '', expiry, \`/blob/\${ACCOUNT}/\${CONTAINER}/\${blob}\`, // permissions, start, expiry, resource
    '', '', 'https', version, 'b', // identifier, IP, protocol, version, a blob
    '', '', '', '', '', '', '', // snapshot, encryption scope, and the five response headers
  ].join('\\n');
  const sig = createHmac('sha256', Buffer.from(KEY, 'base64')).update(signed, 'utf8').digest('base64');
  const query = new URLSearchParams({ sv: version, spr: 'https', se: expiry, sr: 'b', sp: 'cw', sig });
  return \`https://\${ACCOUNT}.blob.core.windows.net/\${CONTAINER}/\${blob}?\${query}\`;
}
// The account's CORS rules let your site PUT, with the x-ms-blob-type and Content-Type headers.`;
  return { json: JSON.stringify(page ?? {}, null, 2), js, store };
}

/**
 * One record in two tabs (the two-tabs and viewer-role demos): the lead's page JSON, the demo's own script as it runs —
 * one memory data source that keeps versions and says what each person may do, the lead mounted in two tabs, the
 * second saving in Mona's name — and a data source of your own that does the same against your server.
 */
export function saveSafetySnippets(page, params) {
  const name = page?.id ?? 'lead';
  const viewer = params?.get('role') === 'viewer';
  const js = `import { ConflictError, createMemoryDataSource, loadedRecordOf } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
import page from './${name}.page.json';

// One data source for both tabs. Each save moves the lead's version on, and a save
// from a page that opened an older one is refused as a conflict: "Mona changed this
// record at 10:42", with Reload and Keep mine.
const dataSource = createMemoryDataSource({
  records: { lead: { 1: { name: 'Villa in Sheikh Zayed', phone: '+20 100 123 4567', stage: 'new', budget: 4000000, commission: 2.5 } } },
  versions: { by: 'Sara' },
  // What this person may do with each lead: kept to by the form, and by the source.
  can: {
    lead: () => ${
      viewer
        ? `({
      edit: false, archive: false, duplicate: false, delete: false, // Omar only reads it
      hiddenFields: ['commission'],
      reason: 'Omar is a viewer: he can read leads, but not change them.',
    })`
        : `({
      delete: false, // an agent never deletes a lead
      readonlyFields: ['commission'], // nor sets the commission
      reason: 'Only a manager sets the commission or deletes a lead.',
    })`
    },
  },
});
${
  viewer
    ? `
// Omar's tab: no Save, no Archive, Duplicate or Delete, the commission not shown,
// and the reason over the record.
mountViewer(document.getElementById('omar'), { page, dataSource, recordId: 1 });`
    : `
// Your tab, Sara's.
mountViewer(document.getElementById('you'), { page, dataSource, recordId: 1 });

// Mona's tab, on the same records: her saves go in her name, refused as a
// conflict when someone saved after she opened the lead, as a server refuses.
const asMona = {
  ...dataSource,
  async save(request) {
    const { version: now } = loadedRecordOf(await dataSource.load(request));
    if (request.version && request.version.token !== now.token) {
      throw new ConflictError({ version: now, theirs: { ...dataSource.records.lead[request.id] } });
    }
    const version = dataSource.changeElsewhere('lead', request.id, request.changes.values, { by: 'Mona' });
    return { id: request.id, values: { ...dataSource.records.lead[request.id] }, version };
  },
};
const mona = mountViewer(document.getElementById('mona'), { page, dataSource: asMona, recordId: 1 });

// "Someone else edits this": Mona moves the lead on and raises its budget, and saves.
async function someoneElseEdits() {
  await mona.reload();
  const { budget } = mona.form.getState().values;
  mona.setValues({ stage: 'visit', budget: budget + 500000 });
  await mona.save();
}`
}`;
  const server = `import { ConflictError, loadedRecord, saveRefused } from '@fieldia/core';
import { mountViewer } from '@fieldia/viewer';
import page from './${name}.page.json';

// Your own data source, talking to your server. Its load tells the record's
// version and what this person may do with it; its save sends the version back,
// and your server refuses a save over someone else's (HTTP 409 here).
const dataSource = {
  async load({ model, id }) {
    const row = await (await fetch(\`/api/\${model}/\${id}\`)).json();
    return loadedRecord(row.values, {
      version: { token: row.etag, by: row.changedBy, at: row.changedAt },
      can: { edit: row.canEdit, delete: row.canDelete, readonlyFields: row.lockedFields, hiddenFields: row.hiddenFields, reason: row.why },
    });
  },
  async save({ model, id, changes, version }) {
    const response = await fetch(\`/api/\${model}/\${id ?? ''}\`, {
      method: id === null ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(version ? { 'If-Match': version.token } : {}) },
      body: JSON.stringify(changes.values),
    });
    const row = await response.json();
    // Someone saved in between: who, when, and the record as they left it.
    if (response.status === 409) throw new ConflictError({ version: { token: row.etag, by: row.changedBy, at: row.changedAt }, theirs: row.values });
    // Not this person's to change: the form shows why.
    if (response.status === 403) throw saveRefused({ kind: 'rule', message: row.why });
    return { id: row.id, values: row.values, version: { token: row.etag, by: row.changedBy, at: row.changedAt } };
  },
};

// The form does the rest: who changed it and when, Reload and Keep mine; no Save,
// Archive, Duplicate or Delete where the person may not, and why, in words.
mountViewer(document.getElementById('lead'), { page, dataSource, recordId: 1 });`;
  return { json: JSON.stringify(page ?? {}, null, 2), js, server };
}
