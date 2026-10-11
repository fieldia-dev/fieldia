import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODE_LANGUAGES } from '../../../code/src/lib/languages';
import { JSON_GRAMMAR } from './json';
import { DEFINITIONS, SERVICES, defaultLoader } from './loader';
import { MONACO_LANGUAGES, monacoLanguage } from './languages';
import type { MonacoApi } from './types';

const DEFINITIONS_DIR = join(__dirname, '../../../../node_modules/monaco-editor/esm/vs/languages/definitions');

describe('the languages a field in VS Code’s editor can be written in', () => {
  it('take every name @fieldia/code takes, so a page reads alike in either editor', () => {
    const missing = CODE_LANGUAGES.flatMap((language) => [language.id, ...language.aliases]).filter((name) => !monacoLanguage(name));
    expect(missing).toEqual([]);
  });

  it('are more than CodeMirror’s, Monaco having more grammars', () => {
    expect(MONACO_LANGUAGES.filter((language) => language.monaco !== 'plaintext').length).toBeGreaterThan(CODE_LANGUAGES.length);
    // No name taken twice.
    const names = MONACO_LANGUAGES.flatMap((language) => [language.id, ...language.aliases]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each name a grammar monaco-editor has, registered under the id the editor is given', () => {
    for (const language of MONACO_LANGUAGES) {
      if (!language.definition) continue;
      const file = join(DEFINITIONS_DIR, language.definition, 'register.js');
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain(`id: "${language.monaco}"`);
      // And a way to load it: a dynamic import of its own, so it is a file of its own.
      expect(DEFINITIONS[language.definition]).toBeInstanceOf(Function);
    }
    expect(Object.keys(DEFINITIONS).sort()).toEqual([...new Set(MONACO_LANGUAGES.map((l) => l.definition).filter(Boolean))].sort());
  });

  it('map a name to Monaco’s own: PostgreSQL is pgsql, JSX is JavaScript’s, C is the C++ grammar’s', () => {
    expect(monacoLanguage('postgresql')).toMatchObject({ monaco: 'pgsql', definition: 'pgsql' });
    expect(monacoLanguage('PY')).toMatchObject({ monaco: 'python', definition: 'python' });
    expect(monacoLanguage('jsx')).toMatchObject({ monaco: 'javascript', definition: 'javascript' });
    expect(monacoLanguage('tsx')).toMatchObject({ monaco: 'typescript', definition: 'typescript' });
    expect(monacoLanguage('c')).toMatchObject({ monaco: 'c', definition: 'cpp' });
    expect(monacoLanguage('bash')).toMatchObject({ monaco: 'shell', definition: 'shell' });
    expect(monacoLanguage('graphql')).toMatchObject({ monaco: 'graphql', definition: 'graphql' });
    // JSON is the widgets' own small grammar, or Monaco's service when the app gives workers.
    expect(monacoLanguage('json')).toMatchObject({ monaco: 'json', definition: null });
  });

  it('show a language Monaco has no grammar for as plain text, and know nothing of one no editor has', () => {
    expect(monacoLanguage('haskell')).toMatchObject({ monaco: 'plaintext', definition: null });
    expect(monacoLanguage('klingon')).toBeNull();
    expect(monacoLanguage(undefined)).toBeNull();
    expect(monacoLanguage(7)).toBeNull();
  });

  it('have language services, given workers, for JSON, JavaScript, TypeScript, CSS and HTML', () => {
    expect(Object.keys(SERVICES).sort()).toEqual(['css', 'html', 'javascript', 'json', 'less', 'scss', 'typescript']);
  });
});

/** The part of Monaco the loader touches for JSON, watched. */
function languagesOnly() {
  const registered: string[] = [];
  const tokenizers = new Map<string, unknown>();
  const api = {
    editor: {} as MonacoApi['editor'],
    languages: {
      register: ({ id }: { id: string }) => void registered.push(id),
      getLanguages: () => registered.map((id) => ({ id })),
      setMonarchTokensProvider: (id: string, grammar: unknown) => (tokenizers.set(id, grammar), { dispose: () => undefined }),
      setLanguageConfiguration: () => ({ dispose: () => undefined }),
    },
  } as MonacoApi;
  return { api, registered, tokenizers };
}

describe('the default loader', () => {
  it('gives JSON the widgets’ own grammar when there are no workers, once however many fields ask', async () => {
    const { api, registered, tokenizers } = languagesOnly();
    expect(await defaultLoader.language(api, 'json', false)).toBe('json');
    expect(await defaultLoader.language(api, 'JSON', false)).toBe('json');
    expect(registered).toEqual(['json']);
    expect(tokenizers.get('json')).toBe(JSON_GRAMMAR);
  });

  it('loads nothing for a language Monaco has no grammar for, or one no editor knows: plain text', async () => {
    const { api, registered } = languagesOnly();
    expect(await defaultLoader.language(api, 'haskell', false)).toBe('plaintext');
    expect(await defaultLoader.language(api, 'klingon', false)).toBe('plaintext');
    expect(await defaultLoader.language(api, undefined, false)).toBe('plaintext');
    expect(registered).toEqual([]);
  });
});

/** The grammar's root rules run over a line, as Monarch runs them: the first rule that matches where it stands. */
function tokens(line: string): string[] {
  const rules = JSON_GRAMMAR.tokenizer.root as [RegExp, string, string?][];
  const out: string[] = [];
  for (let at = 0; at < line.length; ) {
    const rule = rules.map(([pattern, token]) => [new RegExp(pattern.source, 'y'), token] as const).find(([sticky]) => ((sticky.lastIndex = at), sticky.test(line)));
    if (!rule) throw new Error(`nothing matches at ${at}: ${line.slice(at)}`);
    const [sticky, token] = rule;
    if (token !== 'white') out.push(`${line.slice(at, sticky.lastIndex)}=${token}`);
    at = sticky.lastIndex;
  }
  return out;
}

describe('JSON’s own grammar', () => {
  it('tells a key from a string value, and marks numbers, true, false and null', () => {
    expect(tokens('{"readers": 4, "name": "Lobby", "open": true, "zone": null, "rate": -1.5e3}')).toEqual([
      '{=@brackets', '"readers"=string.key', ':=delimiter', '4=number', ',=delimiter',
      '"name"=string.key', ':=delimiter', '"Lobby"=string.value', ',=delimiter',
      '"open"=string.key', ':=delimiter', 'true=keyword', ',=delimiter',
      '"zone"=string.key', ':=delimiter', 'null=keyword', ',=delimiter',
      '"rate"=string.key', ':=delimiter', '-1.5e3=number', '}=@brackets',
    ]);
  });

  it('keeps an escaped quote inside its string, and marks a string left open', () => {
    expect(tokens('["say \\"hi\\"", "open')).toEqual(['[=@brackets', '"say \\"hi\\""=string.value', ',=delimiter', '"open=string.invalid']);
  });
});
