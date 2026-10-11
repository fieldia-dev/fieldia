import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { CODE_LANGUAGES, codeLanguage, loadCodeLanguage } from './languages';

/** For each language, a line of it, a word in it, and what its grammar marks that word as: a keyword, a tag, a key. */
const SAMPLES: Record<string, [code: string, word: string, marked: string]> = {
  javascript: ['const total = 1;', 'const', 'tok-keyword'],
  typescript: ['interface Box { size: number }', 'interface', 'tok-keyword'],
  jsx: ['const card = <b>hi</b>;', 'const', 'tok-keyword'],
  tsx: ['type Size = number;', 'type', 'tok-keyword'],
  python: ['def total():\n    return 1', 'def', 'tok-keyword'],
  sql: ['SELECT name FROM people', 'SELECT', 'tok-keyword'],
  postgresql: ['SELECT name FROM people RETURNING id', 'RETURNING', 'tok-keyword'],
  mysql: ['SELECT name FROM people LIMIT 1', 'LIMIT', 'tok-keyword'],
  sqlite: ['SELECT name FROM people', 'SELECT', 'tok-keyword'],
  mssql: ['SELECT TOP 1 name FROM people', 'TOP', 'tok-keyword'],
  html: ['<p class="note">hi</p>', 'p', 'tok-typeName'],
  css: ['a { color: red; }', 'color', 'tok-propertyName'],
  xml: ['<note id="1"/>', 'note', 'tok-typeName'],
  yaml: ['name: Fieldia', 'name', 'tok-propertyName tok-definition'],
  markdown: ['# Title', 'Title', 'tok-heading'],
  json: ['{"name": 1}', '"name"', 'tok-propertyName'],
  java: ['public class Box {}', 'public', 'tok-keyword'],
  c: ['int main() { return 0; }', 'return', 'tok-keyword'],
  cpp: ['class Box {};', 'class', 'tok-keyword'],
  php: ['<?php echo 1;', 'echo', 'tok-keyword'],
  rust: ['fn main() {}', 'fn', 'tok-keyword'],
  go: ['func main() {}', 'func', 'tok-keyword'],
  shell: ['if true; then echo hi; fi', 'if', 'tok-keyword'],
  powershell: ['function Get-Box { return 1 }', 'function', 'tok-keyword'],
  ruby: ['def total\n  1\nend', 'def', 'tok-keyword'],
  perl: ['sub total { return 1; }', 'sub', 'tok-keyword'],
  lua: ['local total = 1', 'local', 'tok-keyword'],
  r: ['total <- function(x) x', 'function', 'tok-keyword'],
  swift: ['func total() {}', 'func', 'tok-keyword'],
  kotlin: ['fun total() = 1', 'fun', 'tok-keyword'],
  csharp: ['public class Box {}', 'public', 'tok-keyword'],
  scala: ['object Box {}', 'object', 'tok-keyword'],
  dart: ['class Box {}', 'class', 'tok-keyword'],
  dockerfile: ['FROM node:22', 'FROM', 'tok-keyword'],
  toml: ['[server]\nport = 80', 'port', 'tok-propertyName'],
  ini: ['[server]\nport = 80', '[server]', 'tok-heading'],
  diff: ['+ added line', '+ added line', 'tok-inserted'],
  nginx: ['server { listen 80; }', 'server', 'tok-keyword'],
  protobuf: ['message Box { int32 size = 1; }', 'message', 'tok-keyword'],
  haskell: ['main = do return ()', 'do', 'tok-keyword'],
  clojure: ['(defn total [] 1)', 'defn', 'tok-keyword'],
  erlang: ['-module(box).', 'module', 'tok-propertyName'],
  groovy: ['def total = 1', 'def', 'tok-keyword'],
  julia: ['function total() end', 'function', 'tok-keyword'],
};

/** The highlight classes on the word, as the grammar parses the line. */
async function classesOf(id: string, code: string, word: string): Promise<string> {
  const support = await loadCodeLanguage(id);
  if (!support) throw new Error(`${id} did not load`);
  const state = EditorState.create({ doc: code, extensions: [support] });
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error(`${id} did not parse`);
  const at = code.indexOf(word);
  const found: string[] = [];
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    if (from <= at && to >= at + word.length) found.push(classes);
  });
  return found.join(' ');
}

describe('the languages a code field can be written in', () => {
  it('are many, each named, with a line of it to try here', () => {
    expect(CODE_LANGUAGES.length).toBeGreaterThanOrEqual(40);
    for (const language of CODE_LANGUAGES) {
      expect(language.name.trim()).not.toBe('');
      expect(SAMPLES[language.id]).toBeDefined();
    }
    // No name taken twice, as an id or another name for one.
    const names = CODE_LANGUAGES.flatMap((language) => [language.id, ...language.aliases]);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(Object.keys(SAMPLES))('%s loads, and marks its words as that language does', async (id) => {
    const [code, word, marked] = SAMPLES[id];
    expect(await classesOf(id, code, word)).toBe(marked);
  });

  it('knows a language by its other names, in any case', () => {
    expect(codeLanguage('PY')?.id).toBe('python');
    expect(codeLanguage('js')?.id).toBe('javascript');
    expect(codeLanguage('ts')?.id).toBe('typescript');
    expect(codeLanguage('bash')?.id).toBe('shell');
    expect(codeLanguage('yml')?.id).toBe('yaml');
    expect(codeLanguage('md')?.id).toBe('markdown');
    expect(codeLanguage('c++')?.id).toBe('cpp');
    expect(codeLanguage('golang')?.id).toBe('go');
    expect(codeLanguage(' Python ')?.id).toBe('python');
  });

  it('knows nothing of a language it does not have, and loads nothing for it', async () => {
    expect(codeLanguage('klingon')).toBeNull();
    expect(codeLanguage(undefined)).toBeNull();
    expect(codeLanguage(42)).toBeNull();
    expect(codeLanguage('')).toBeNull();
    await expect(loadCodeLanguage('klingon')).resolves.toBeNull();
    await expect(loadCodeLanguage(null)).resolves.toBeNull();
  });

  it('loads a language once, however many fields are written in it', async () => {
    const [first, second] = await Promise.all([loadCodeLanguage('python'), loadCodeLanguage('py')]);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
});
