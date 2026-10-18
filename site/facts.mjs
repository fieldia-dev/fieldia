import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { REAL_DEMOS } from '../demos/real/index.mjs';

/**
 * The numbers fieldia.dev states, each from one place, read as the site is built: a script's size from the built file
 * the site serves beside its pages (measured as tools/script-bundle.mjs measures it against its budget), and each
 * count from the code that defines what it counts. A page that states one takes it from here, so no two pages can
 * disagree and none can go stale. The tests alone are counted by hand — running them is no part of a build — and
 * said as "over" a round number, which stays true as tests are added.
 */

const ROOT = new URL('..', import.meta.url);
const text = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const json = (path) => JSON.parse(text(path));
const BUNDLE = new URL('dist/libs/viewer/bundle/', ROOT);

/** A built script's size, gzipped at the level script-bundle.mjs measures it, in KB. */
const gzippedKB = (name) => gzipSync(readFileSync(new URL(name, BUNDLE)), { level: 9 }).length / 1024;
/** The quoted names of a `const NAME = [ … ]` in a source file. */
const listed = (path, name) => [...(new RegExp(`const ${name}\\b[^=]*= \\[([^\\]]*)\\]`).exec(text(path))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

const LANGUAGE_ADD_ONS = ['ar', 'de', 'fr'];
const addOns = LANGUAGE_ADD_ONS.map((code) => gzippedKB(`fieldia.${code}.js`));
const parts = readdirSync(BUNDLE)
  .filter((name) => /^fieldia\.[a-z]+\.js$/.test(name))
  .filter((name) => !LANGUAGE_ADD_ONS.includes(name.split('.')[1]));

/** Sizes, gzipped, in whole KB. */
export const SIZES = {
  /** fieldia.js: the one script a page with no build step loads. */
  script: Math.round(gzippedKB('fieldia.js')),
  /** The parts beside it, each fetched the first time a page uses it: a list, lines, files, a survey, the themes… */
  parts: parts.length,
  /** Each language's add-on, the least and the most. */
  languages: [Math.round(Math.min(...addOns)), Math.round(Math.max(...addOns))],
  /** fieldia.print.js: a page on paper whole, fetched as a person means to print. */
  print: Math.round(gzippedKB('fieldia.print.js')),
  /** fieldia.phone.js: the phone box and its country table, fetched the first time a page shows a phone. */
  phone: Math.round(gzippedKB('fieldia.phone.js')),
};

const packages = readdirSync(new URL('libs/', ROOT)).filter((dir) => {
  try {
    return !json(`libs/${dir}/package.json`).private;
  } catch {
    return false;
  }
});
const templates = json('examples/templates/index.json');
const legalCase = json('examples/pages/real-legal-case.page.json');
const nodesOf = (layout) => {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    found.push(node);
    Object.values(node).forEach(walk);
  };
  walk(layout);
  return found;
};
const legalNodes = nodesOf(legalCase.layout);
/** A field drawn as a table: lines, or a many2many not drawn as tags. */
const isTable = (node) => node.type === 'field' && (legalCase.fields[node.field]?.type === 'one2many' || (legalCase.fields[node.field]?.type === 'many2many' && !node.widget));

/** What there is, counted from the code that defines it. */
export const COUNTS = {
  packages: packages.length,
  fieldTypes: listed('libs/core/src/lib/format/names.ts', 'FIELD_TYPES').length,
  stepKinds: new Set([...text('libs/core/src/lib/format/actions.ts').matchAll(/^\s+do: '([a-zA-Z]+)';/gm)].map((m) => m[1])).size,
  themes: listed('libs/core/src/lib/format/themes.ts', 'THEMES').length,
  skins: listed('libs/core/src/lib/format/themes.ts', 'SKINS').length,
  // English, and each language the packages bring besides.
  languages: 1 + (/LANGUAGES[^=]*= \{([^}]*)\}/.exec(text('libs/core/src/lib/record/locales/all.ts'))?.[1].split(',').filter((s) => s.trim()).length ?? 0),
  codeLanguages: (text('libs/code/src/lib/languages.ts').match(/^ {2}language\(/gm) ?? []).length,
  realScreens: REAL_DEMOS.length,
  templates: templates.length,
  formTemplates: templates.filter((t) => t.group === 'forms').length,
  recordTemplates: templates.filter((t) => t.group === 'records').length,
  legalCase: {
    tabs: legalNodes.filter((node) => node.type === 'tab').length,
    statButtons: legalCase.layout.statButtons.length,
    tables: legalNodes.filter(isTable).length,
  },
};

/**
 * The tests, counted at 0.23.0: 2,407 browser tests in Chromium (`npx playwright test --list --project=chromium`;
 * Firefox and WebKit run a smoke set of them besides), and 5,555 unit tests across the packages
 * (`npx nx run-many -t test`). Said as "over" the hundred below.
 */
export const TESTS = { browser: 2400, unit: 5500 };

const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** A count in words, as the pages write the small ones: "nineteen"; a larger one in figures. */
export const words = (n) => SMALL[n] ?? n.toLocaleString('en');
/** The same, starting a sentence: "Nineteen". */
export const Words = (n) => {
  const said = words(n);
  return said[0].toUpperCase() + said.slice(1);
};
/** A figure with its thousands marked: 2,400. */
export const figure = (n) => n.toLocaleString('en');
