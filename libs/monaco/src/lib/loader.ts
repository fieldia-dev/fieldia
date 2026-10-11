import { registerJson } from './json';
import { monacoLanguage } from './languages';
import type { MonacoApi, MonacoLoader } from './types';

/**
 * Monaco, loaded the way a bundler splits it: the editor when the first field
 * is drawn, then each language's grammar when a field first asks for it, each
 * a dynamic import of its own. Monaco's CSS comes with its modules, so the
 * app's bundler must take CSS imported from JavaScript (Vite and webpack with
 * its CSS loaders do; esbuild writes it beside the bundle). Nothing here needs
 * a worker: Monarch grammars colour code on the page itself.
 */

/** Each grammar's registration, by its folder in monaco-editor/languages/definitions. */
export const DEFINITIONS: Record<string, () => Promise<unknown>> = {
  abap: () => import('monaco-editor/languages/definitions/abap/register'),
  apex: () => import('monaco-editor/languages/definitions/apex/register'),
  azcli: () => import('monaco-editor/languages/definitions/azcli/register'),
  bat: () => import('monaco-editor/languages/definitions/bat/register'),
  bicep: () => import('monaco-editor/languages/definitions/bicep/register'),
  clojure: () => import('monaco-editor/languages/definitions/clojure/register'),
  coffee: () => import('monaco-editor/languages/definitions/coffee/register'),
  cpp: () => import('monaco-editor/languages/definitions/cpp/register'),
  csharp: () => import('monaco-editor/languages/definitions/csharp/register'),
  css: () => import('monaco-editor/languages/definitions/css/register'),
  cypher: () => import('monaco-editor/languages/definitions/cypher/register'),
  dart: () => import('monaco-editor/languages/definitions/dart/register'),
  dockerfile: () => import('monaco-editor/languages/definitions/dockerfile/register'),
  elixir: () => import('monaco-editor/languages/definitions/elixir/register'),
  'freemarker2': () => import('monaco-editor/languages/definitions/freemarker2/register'),
  fsharp: () => import('monaco-editor/languages/definitions/fsharp/register'),
  go: () => import('monaco-editor/languages/definitions/go/register'),
  graphql: () => import('monaco-editor/languages/definitions/graphql/register'),
  handlebars: () => import('monaco-editor/languages/definitions/handlebars/register'),
  hcl: () => import('monaco-editor/languages/definitions/hcl/register'),
  html: () => import('monaco-editor/languages/definitions/html/register'),
  ini: () => import('monaco-editor/languages/definitions/ini/register'),
  java: () => import('monaco-editor/languages/definitions/java/register'),
  javascript: () => import('monaco-editor/languages/definitions/javascript/register'),
  julia: () => import('monaco-editor/languages/definitions/julia/register'),
  kotlin: () => import('monaco-editor/languages/definitions/kotlin/register'),
  less: () => import('monaco-editor/languages/definitions/less/register'),
  liquid: () => import('monaco-editor/languages/definitions/liquid/register'),
  lua: () => import('monaco-editor/languages/definitions/lua/register'),
  markdown: () => import('monaco-editor/languages/definitions/markdown/register'),
  mdx: () => import('monaco-editor/languages/definitions/mdx/register'),
  mips: () => import('monaco-editor/languages/definitions/mips/register'),
  msdax: () => import('monaco-editor/languages/definitions/msdax/register'),
  mysql: () => import('monaco-editor/languages/definitions/mysql/register'),
  'objective-c': () => import('monaco-editor/languages/definitions/objective-c/register'),
  pascal: () => import('monaco-editor/languages/definitions/pascal/register'),
  perl: () => import('monaco-editor/languages/definitions/perl/register'),
  pgsql: () => import('monaco-editor/languages/definitions/pgsql/register'),
  php: () => import('monaco-editor/languages/definitions/php/register'),
  powerquery: () => import('monaco-editor/languages/definitions/powerquery/register'),
  powershell: () => import('monaco-editor/languages/definitions/powershell/register'),
  protobuf: () => import('monaco-editor/languages/definitions/protobuf/register'),
  pug: () => import('monaco-editor/languages/definitions/pug/register'),
  python: () => import('monaco-editor/languages/definitions/python/register'),
  qsharp: () => import('monaco-editor/languages/definitions/qsharp/register'),
  r: () => import('monaco-editor/languages/definitions/r/register'),
  razor: () => import('monaco-editor/languages/definitions/razor/register'),
  redis: () => import('monaco-editor/languages/definitions/redis/register'),
  redshift: () => import('monaco-editor/languages/definitions/redshift/register'),
  restructuredtext: () => import('monaco-editor/languages/definitions/restructuredtext/register'),
  ruby: () => import('monaco-editor/languages/definitions/ruby/register'),
  rust: () => import('monaco-editor/languages/definitions/rust/register'),
  scala: () => import('monaco-editor/languages/definitions/scala/register'),
  scheme: () => import('monaco-editor/languages/definitions/scheme/register'),
  scss: () => import('monaco-editor/languages/definitions/scss/register'),
  shell: () => import('monaco-editor/languages/definitions/shell/register'),
  solidity: () => import('monaco-editor/languages/definitions/solidity/register'),
  sparql: () => import('monaco-editor/languages/definitions/sparql/register'),
  sql: () => import('monaco-editor/languages/definitions/sql/register'),
  st: () => import('monaco-editor/languages/definitions/st/register'),
  swift: () => import('monaco-editor/languages/definitions/swift/register'),
  systemverilog: () => import('monaco-editor/languages/definitions/systemverilog/register'),
  tcl: () => import('monaco-editor/languages/definitions/tcl/register'),
  twig: () => import('monaco-editor/languages/definitions/twig/register'),
  typescript: () => import('monaco-editor/languages/definitions/typescript/register'),
  typespec: () => import('monaco-editor/languages/definitions/typespec/register'),
  vb: () => import('monaco-editor/languages/definitions/vb/register'),
  wgsl: () => import('monaco-editor/languages/definitions/wgsl/register'),
  xml: () => import('monaco-editor/languages/definitions/xml/register'),
  yaml: () => import('monaco-editor/languages/definitions/yaml/register'),
};

/**
 * The language services, for an app that gives workers (`getWorker`): JSON's
 * checks against its own rules, TypeScript and JavaScript's, CSS's and HTML's
 * suggestions and checks, by Monaco's id for the language.
 */
export const SERVICES: Record<string, () => Promise<unknown>> = {
  json: () => import('monaco-editor/languages/features/json/register'),
  typescript: () => import('monaco-editor/languages/features/typescript/register'),
  javascript: () => import('monaco-editor/languages/features/typescript/register'),
  css: () => import('monaco-editor/languages/features/css/register'),
  scss: () => import('monaco-editor/languages/features/css/register'),
  less: () => import('monaco-editor/languages/features/css/register'),
  html: () => import('monaco-editor/languages/features/html/register'),
};

/** VS Code's editing every field has: find and replace, folding, comments, moving and copying lines, several cursors. */
const FEATURES: (() => Promise<unknown>)[] = [
  () => import('monaco-editor/features/find/register'),
  () => import('monaco-editor/features/folding/register'),
  () => import('monaco-editor/features/bracketMatching/register'),
  () => import('monaco-editor/features/comment/register'),
  () => import('monaco-editor/features/linesOperations/register'),
  () => import('monaco-editor/features/multicursor/register'),
  () => import('monaco-editor/features/wordOperations/register'),
  () => import('monaco-editor/features/indentation/register'),
  () => import('monaco-editor/features/cursorUndo/register'),
  () => import('monaco-editor/features/readOnlyMessage/register'),
  () => import('monaco-editor/features/placeholderText/register'),
];

/** What the language services show: suggestions, what a word is on hover, a call's parameters, formatting, the next problem. */
const SERVICE_FEATURES: (() => Promise<unknown>)[] = [
  () => import('monaco-editor/features/suggest/register'),
  () => import('monaco-editor/features/hover/register'),
  () => import('monaco-editor/features/parameterHints/register'),
  () => import('monaco-editor/features/format/register'),
  () => import('monaco-editor/features/gotoError/register'),
];

/** A load made once, and tried again after it fails. */
function once<T>(make: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () =>
    (loading ??= make().catch((error: unknown) => {
      loading = null;
      throw error;
    }));
}

const editor = once(async () => {
  const monaco = (await import('monaco-editor/editor')) as MonacoApi;
  await Promise.all(FEATURES.map((load) => load()));
  return monaco;
});
const withServices = once(async () => {
  const monaco = await editor();
  await Promise.all(SERVICE_FEATURES.map((load) => load()));
  return monaco;
});

/** monaco-editor's own modules, each imported when first needed. */
export const defaultLoader: MonacoLoader = {
  monaco: (services) => (services ? withServices() : editor()),
  async language(monaco: MonacoApi, name: unknown, services: boolean): Promise<string> {
    const found = monacoLanguage(name);
    if (!found || found.monaco === 'plaintext') return 'plaintext';
    const service = services ? SERVICES[found.monaco] : undefined;
    try {
      if (found.monaco === 'json' && !service) registerJson(monaco);
      if (found.definition) await DEFINITIONS[found.definition]();
      if (service) await service();
      return found.monaco;
    } catch {
      // Not fetched (offline, say): plain text this time.
      return 'plaintext';
    }
  },
};
