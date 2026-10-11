/**
 * The languages a field in VS Code's editor can be written in
 * (`options.language`): every name @fieldia/code takes, so a page reads alike
 * in either editor, and Monaco's other grammars besides. Each is Monaco's own
 * Monarch grammar, loaded when a field first asks for it (loader.ts); one
 * Monaco has none for is plain text.
 */

export interface MonacoLanguage {
  /** The name a page gives it: `{ "widget": "monaco", "options": { "language": "python" } }`. */
  id: string;
  /** Its name as people know it. */
  name: string;
  /** Other names a page may give it. */
  aliases: readonly string[];
  /** Monaco's id for it, as the editor's model is given it; `plaintext` for one Monaco has no grammar for. */
  monaco: string;
  /** The folder of monaco-editor's grammar that registers it, under languages/definitions; null for none. */
  definition: string | null;
}

const language = (id: string, name: string, monaco: string, definition: string | null, ...aliases: string[]): MonacoLanguage => ({ id, name, monaco, definition, aliases });

/** Every language, in the order a person picking one reads them: @fieldia/code's, then Monaco's own. */
export const MONACO_LANGUAGES: readonly MonacoLanguage[] = [
  language('javascript', 'JavaScript', 'javascript', 'javascript', 'js', 'mjs', 'cjs', 'node'),
  language('typescript', 'TypeScript', 'typescript', 'typescript', 'ts', 'mts', 'cts'),
  language('jsx', 'JavaScript with JSX', 'javascript', 'javascript'),
  language('tsx', 'TypeScript with JSX', 'typescript', 'typescript'),
  language('python', 'Python', 'python', 'python', 'py', 'python3'),
  language('sql', 'SQL', 'sql', 'sql'),
  language('postgresql', 'PostgreSQL', 'pgsql', 'pgsql', 'postgres', 'pgsql', 'psql'),
  language('mysql', 'MySQL', 'mysql', 'mysql', 'mariadb'),
  language('sqlite', 'SQLite', 'sql', 'sql'),
  language('mssql', 'SQL Server', 'sql', 'sql', 'tsql', 't-sql', 'sqlserver'),
  language('html', 'HTML', 'html', 'html', 'htm', 'xhtml'),
  language('css', 'CSS', 'css', 'css'),
  language('xml', 'XML', 'xml', 'xml', 'svg', 'xsl'),
  language('yaml', 'YAML', 'yaml', 'yaml', 'yml'),
  language('markdown', 'Markdown', 'markdown', 'markdown', 'md'),
  language('json', 'JSON', 'json', null, 'jsonc'),
  language('java', 'Java', 'java', 'java'),
  language('c', 'C', 'c', 'cpp', 'h'),
  language('cpp', 'C++', 'cpp', 'cpp', 'c++', 'cc', 'cxx', 'hpp'),
  language('php', 'PHP', 'php', 'php'),
  language('rust', 'Rust', 'rust', 'rust', 'rs'),
  language('go', 'Go', 'go', 'go', 'golang'),
  language('shell', 'Shell', 'shell', 'shell', 'sh', 'bash', 'zsh'),
  language('powershell', 'PowerShell', 'powershell', 'powershell', 'ps1', 'pwsh'),
  language('ruby', 'Ruby', 'ruby', 'ruby', 'rb'),
  language('perl', 'Perl', 'perl', 'perl', 'pl'),
  language('lua', 'Lua', 'lua', 'lua'),
  language('r', 'R', 'r', 'r'),
  language('swift', 'Swift', 'swift', 'swift'),
  language('kotlin', 'Kotlin', 'kotlin', 'kotlin', 'kt', 'kts'),
  language('csharp', 'C#', 'csharp', 'csharp', 'c#', 'cs'),
  language('scala', 'Scala', 'scala', 'scala'),
  language('dart', 'Dart', 'dart', 'dart'),
  language('dockerfile', 'Dockerfile', 'dockerfile', 'dockerfile', 'docker'),
  language('toml', 'TOML', 'ini', 'ini'),
  language('ini', 'INI', 'ini', 'ini', 'properties', 'conf'),
  language('diff', 'Diff', 'plaintext', null, 'patch'),
  language('nginx', 'nginx', 'plaintext', null),
  language('protobuf', 'Protocol Buffers', 'proto', 'protobuf', 'proto'),
  language('haskell', 'Haskell', 'plaintext', null, 'hs'),
  language('clojure', 'Clojure', 'clojure', 'clojure', 'clj'),
  language('erlang', 'Erlang', 'plaintext', null, 'erl'),
  language('groovy', 'Groovy', 'plaintext', null, 'gradle'),
  language('julia', 'Julia', 'julia', 'julia', 'jl'),
  language('graphql', 'GraphQL', 'graphql', 'graphql', 'gql'),
  language('scss', 'SCSS', 'scss', 'scss', 'sass'),
  language('less', 'Less', 'less', 'less'),
  language('bat', 'Batch', 'bat', 'bat', 'batch', 'cmd'),
  language('vb', 'Visual Basic', 'vb', 'vb', 'vbnet', 'vb.net'),
  language('fsharp', 'F#', 'fsharp', 'fsharp', 'f#', 'fs'),
  language('objective-c', 'Objective-C', 'objective-c', 'objective-c', 'objc', 'objectivec'),
  language('elixir', 'Elixir', 'elixir', 'elixir', 'ex', 'exs'),
  language('pascal', 'Pascal', 'pascal', 'pascal', 'delphi'),
  language('solidity', 'Solidity', 'sol', 'solidity', 'sol'),
  language('twig', 'Twig', 'twig', 'twig'),
  language('handlebars', 'Handlebars', 'handlebars', 'handlebars', 'hbs'),
  language('razor', 'Razor', 'razor', 'razor', 'cshtml'),
  language('pug', 'Pug', 'pug', 'pug', 'jade'),
  language('hcl', 'HCL', 'hcl', 'hcl', 'terraform', 'tf'),
  language('bicep', 'Bicep', 'bicep', 'bicep'),
  language('redis', 'Redis', 'redis', 'redis'),
  language('tcl', 'Tcl', 'tcl', 'tcl'),
  language('scheme', 'Scheme', 'scheme', 'scheme'),
  language('coffeescript', 'CoffeeScript', 'coffeescript', 'coffee', 'coffee'),
  language('apex', 'Apex', 'apex', 'apex'),
  language('abap', 'ABAP', 'abap', 'abap'),
  language('cypher', 'Cypher', 'cypher', 'cypher'),
  language('sparql', 'SPARQL', 'sparql', 'sparql'),
  language('wgsl', 'WGSL', 'wgsl', 'wgsl'),
  language('liquid', 'Liquid', 'liquid', 'liquid'),
  language('mdx', 'MDX', 'mdx', 'mdx'),
  language('restructuredtext', 'reStructuredText', 'restructuredtext', 'restructuredtext', 'rst'),
  language('systemverilog', 'SystemVerilog', 'systemverilog', 'systemverilog', 'sv'),
  language('verilog', 'Verilog', 'verilog', 'systemverilog', 'v'),
  language('qsharp', 'Q#', 'qsharp', 'qsharp', 'q#'),
  language('powerquery', 'Power Query', 'powerquery', 'powerquery', 'm'),
  language('dax', 'DAX', 'msdax', 'msdax', 'msdax'),
  language('redshift', 'Redshift', 'redshift', 'redshift'),
  language('structured-text', 'Structured Text', 'st', 'st', 'st', 'iec-61131'),
  language('mips', 'MIPS assembly', 'mips', 'mips'),
  language('freemarker', 'FreeMarker', 'freemarker2', 'freemarker2', 'ftl', 'freemarker2'),
  language('typespec', 'TypeSpec', 'typespec', 'typespec', 'tsp'),
  language('azcli', 'Azure CLI', 'azcli', 'azcli'),
];

const BY_NAME = new Map(MONACO_LANGUAGES.flatMap((found) => [found.id, ...found.aliases].map((name) => [name, found] as const)));

/** The language a page names, by its id or another of its names, in any case; null for one no editor knows. */
export function monacoLanguage(name: unknown): MonacoLanguage | null {
  return typeof name === 'string' ? BY_NAME.get(name.trim().toLowerCase()) ?? null : null;
}

/** Monaco's language services: each runs in a worker of its own, which the app gives (`getWorker`). */
export type MonacoService = 'json' | 'typescript' | 'css' | 'html';
export const MONACO_SERVICES: readonly MonacoService[] = ['json', 'typescript', 'css', 'html'];

const SERVICE_OF: Record<string, MonacoService> = { json: 'json', typescript: 'typescript', javascript: 'typescript', css: 'css', scss: 'css', less: 'css', html: 'html' };

/** The language service a language a page names has in Monaco, or null for one with none. */
export function serviceOf(name: unknown): MonacoService | null {
  const found = monacoLanguage(name);
  return found ? SERVICE_OF[found.monaco] ?? null : null;
}
