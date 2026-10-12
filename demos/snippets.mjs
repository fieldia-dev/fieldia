/**
 * The Code drawer's code: the demo's page as JSON, and the code that shows
 * it with no framework, in React, in Vue and in Angular. Each names exactly
 * what the page needs beyond the viewer itself, read from the page: the
 * grid, CodeMirror or VS Code's editor for its code fields, its maps (a
 * place or an area, a list's map, a form's map, the borders its areas are
 * shaded by), the chatter beside a record. What is copied draws the page as
 * the demo does.
 */

/** What a page uses beyond the viewer's own widgets, found by walking it. */
export function pageNeeds(page) {
  const needs = { grid: false, code: false, monaco: false, mapFields: false, listMap: false, formMap: false, chatter: false, own: false, slots: new Set(), regions: new Set(), reach: false };
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const widget = node.widget;
    if (widget === 'grid') needs.grid = true;
    if (widget === 'code') needs.code = true;
    if (widget === 'monaco') needs.monaco = true;
    if (widget === 'place' || widget === 'area' || widget === 'address-search') needs.mapFields = true;
    if (widget === 'shout') needs.own = true;
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
    if (needs.listMap) options.push(['listViews', 'mapListViews(mapSettings)']);
    if (needs.formMap) options.push(['maps', 'mapParts(mapSettings)']);
  }
  // Your own widget, by its field's type and its name.
  if (needs.own) widgets.push("'char.shout': yourShoutWidget");
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
  const jsOptions = [
    ...options,
    ...chatterJs,
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
  const consts = [source, ...options.map(([key, value]) => `const ${key} = ${value};`)];
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
  return <FieldiaForm page={page} dataSource={dataSource} ${attrs((key, value, bound) => (bound ? `${key}={${value}}` : `${key}="${value}"`))}${slotsJs.length ? ` slots={{ ${[...(needs.chatter ? ['chatter: Chatter'] : []), ...own.map((slot) => `${slot}: Your${capital(slot)}`)].join(', ')} }}` : ''} />;
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
  <FieldiaForm :page="page" :data-source="dataSource" ${attrs((key, value, bound) => (bound ? `:${kebab(key)}="${value}"` : `${kebab(key)}="${value}"`))}${
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
  template: \`<fieldia-form [page]="page" [dataSource]="dataSource" ${attrs((key, value, bound) => (bound ? `[${key}]="${value}"` : `${key}="${value}"`))}${
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
  readonly dataSource = createMemoryDataSource(); // or your own, talking to your server${fields.length ? `\n${fields.join('\n')}` : ''}
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
