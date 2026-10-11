import { StreamLanguage, type StreamParser } from '@codemirror/language';
import type { Extension } from '@codemirror/state';

/**
 * The languages a code field can be written in (`options.language`), each
 * grammar loaded only when a field asks for it: a dynamic import of its own,
 * so a bundler splits it off and a page with one Python field carries
 * Python's grammar alone. A name this list does not know is plain text.
 */

export interface CodeLanguage {
  /** The name a page gives it: `{ "widget": "code", "options": { "language": "python" } }`. */
  id: string;
  /** Its name as people know it. */
  name: string;
  /** Other names a page may give it: `py`, `bash`, `yml`. */
  aliases: readonly string[];
}

/** A grammar from @codemirror/legacy-modes, as a language the editor reads. */
const stream = (parser: StreamParser<unknown>): Extension => StreamLanguage.define(parser);

/** How each language's grammar loads: a dynamic import each, so each is a file of its own. */
const LOADERS: Record<string, () => Promise<Extension>> = {
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  jsx: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true })),
  tsx: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true, typescript: true })),
  python: () => import('@codemirror/lang-python').then((m) => m.python()),
  sql: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  postgresql: () => import('@codemirror/lang-sql').then((m) => m.sql({ dialect: m.PostgreSQL })),
  mysql: () => import('@codemirror/lang-sql').then((m) => m.sql({ dialect: m.MySQL })),
  sqlite: () => import('@codemirror/lang-sql').then((m) => m.sql({ dialect: m.SQLite })),
  mssql: () => import('@codemirror/lang-sql').then((m) => m.sql({ dialect: m.MSSQL })),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  xml: () => import('@codemirror/lang-xml').then((m) => m.xml()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
  markdown: () => import('@codemirror/lang-markdown').then((m) => m.markdown()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  java: () => import('@codemirror/lang-java').then((m) => m.java()),
  c: () => import('@codemirror/lang-cpp').then((m) => m.cpp()),
  cpp: () => import('@codemirror/lang-cpp').then((m) => m.cpp()),
  php: () => import('@codemirror/lang-php').then((m) => m.php()),
  rust: () => import('@codemirror/lang-rust').then((m) => m.rust()),
  go: () => import('@codemirror/lang-go').then((m) => m.go()),
  // The rest from CodeMirror 5's modes, each a small file of its own.
  shell: () => import('@codemirror/legacy-modes/mode/shell').then((m) => stream(m.shell)),
  powershell: () => import('@codemirror/legacy-modes/mode/powershell').then((m) => stream(m.powerShell)),
  ruby: () => import('@codemirror/legacy-modes/mode/ruby').then((m) => stream(m.ruby)),
  perl: () => import('@codemirror/legacy-modes/mode/perl').then((m) => stream(m.perl)),
  lua: () => import('@codemirror/legacy-modes/mode/lua').then((m) => stream(m.lua)),
  r: () => import('@codemirror/legacy-modes/mode/r').then((m) => stream(m.r)),
  swift: () => import('@codemirror/legacy-modes/mode/swift').then((m) => stream(m.swift)),
  kotlin: () => import('@codemirror/legacy-modes/mode/clike').then((m) => stream(m.kotlin)),
  csharp: () => import('@codemirror/legacy-modes/mode/clike').then((m) => stream(m.csharp)),
  scala: () => import('@codemirror/legacy-modes/mode/clike').then((m) => stream(m.scala)),
  dart: () => import('@codemirror/legacy-modes/mode/clike').then((m) => stream(m.dart)),
  dockerfile: () => import('@codemirror/legacy-modes/mode/dockerfile').then((m) => stream(m.dockerFile)),
  toml: () => import('@codemirror/legacy-modes/mode/toml').then((m) => stream(m.toml)),
  ini: () => import('@codemirror/legacy-modes/mode/properties').then((m) => stream(m.properties)),
  diff: () => import('@codemirror/legacy-modes/mode/diff').then((m) => stream(m.diff)),
  nginx: () => import('@codemirror/legacy-modes/mode/nginx').then((m) => stream(m.nginx)),
  protobuf: () => import('@codemirror/legacy-modes/mode/protobuf').then((m) => stream(m.protobuf)),
  haskell: () => import('@codemirror/legacy-modes/mode/haskell').then((m) => stream(m.haskell)),
  clojure: () => import('@codemirror/legacy-modes/mode/clojure').then((m) => stream(m.clojure)),
  erlang: () => import('@codemirror/legacy-modes/mode/erlang').then((m) => stream(m.erlang)),
  groovy: () => import('@codemirror/legacy-modes/mode/groovy').then((m) => stream(m.groovy)),
  julia: () => import('@codemirror/legacy-modes/mode/julia').then((m) => stream(m.julia)),
};

const language = (id: string, name: string, ...aliases: string[]): CodeLanguage => ({ id, name, aliases });

/** Every language a code field can be written in, in the order a person picking one reads them. */
export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  language('javascript', 'JavaScript', 'js', 'mjs', 'cjs', 'node'),
  language('typescript', 'TypeScript', 'ts', 'mts', 'cts'),
  language('jsx', 'JavaScript with JSX'),
  language('tsx', 'TypeScript with JSX'),
  language('python', 'Python', 'py', 'python3'),
  language('sql', 'SQL'),
  language('postgresql', 'PostgreSQL', 'postgres', 'pgsql', 'psql'),
  language('mysql', 'MySQL', 'mariadb'),
  language('sqlite', 'SQLite'),
  language('mssql', 'SQL Server', 'tsql', 't-sql', 'sqlserver'),
  language('html', 'HTML', 'htm', 'xhtml'),
  language('css', 'CSS'),
  language('xml', 'XML', 'svg', 'xsl'),
  language('yaml', 'YAML', 'yml'),
  language('markdown', 'Markdown', 'md'),
  language('json', 'JSON', 'jsonc'),
  language('java', 'Java'),
  language('c', 'C', 'h'),
  language('cpp', 'C++', 'c++', 'cc', 'cxx', 'hpp'),
  language('php', 'PHP'),
  language('rust', 'Rust', 'rs'),
  language('go', 'Go', 'golang'),
  language('shell', 'Shell', 'sh', 'bash', 'zsh'),
  language('powershell', 'PowerShell', 'ps1', 'pwsh'),
  language('ruby', 'Ruby', 'rb'),
  language('perl', 'Perl', 'pl'),
  language('lua', 'Lua'),
  language('r', 'R'),
  language('swift', 'Swift'),
  language('kotlin', 'Kotlin', 'kt', 'kts'),
  language('csharp', 'C#', 'c#', 'cs'),
  language('scala', 'Scala'),
  language('dart', 'Dart'),
  language('dockerfile', 'Dockerfile', 'docker'),
  language('toml', 'TOML'),
  language('ini', 'INI', 'properties', 'conf'),
  language('diff', 'Diff', 'patch'),
  language('nginx', 'nginx'),
  language('protobuf', 'Protocol Buffers', 'proto'),
  language('haskell', 'Haskell', 'hs'),
  language('clojure', 'Clojure', 'clj'),
  language('erlang', 'Erlang', 'erl'),
  language('groovy', 'Groovy', 'gradle'),
  language('julia', 'Julia', 'jl'),
];

const BY_NAME = new Map(CODE_LANGUAGES.flatMap((language) => [language.id, ...language.aliases].map((name) => [name, language] as const)));

/** The language a page names, by its id or another of its names, in any case; null for one not on the list. */
export function codeLanguage(name: unknown): CodeLanguage | null {
  return typeof name === 'string' ? BY_NAME.get(name.trim().toLowerCase()) ?? null : null;
}

/** Each grammar's load, once: every field in that language shares it. */
const loading = new Map<string, Promise<Extension | null>>();

/**
 * The grammar of the language a page names, ready for an editor: loaded the
 * first time a field asks for it. Null for a language not on the list, and
 * for one whose file could not be fetched — the field stays plain text.
 */
export function loadCodeLanguage(name: unknown): Promise<Extension | null> {
  const found = codeLanguage(name);
  if (!found) return Promise.resolve(null);
  let load = loading.get(found.id);
  if (!load) {
    load = LOADERS[found.id]().catch(() => {
      // Not fetched (offline, say): plain text this time, and another try next time.
      loading.delete(found.id);
      return null;
    });
    loading.set(found.id, load);
  }
  return load;
}
