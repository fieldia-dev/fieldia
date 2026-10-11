# @fieldia/code

[Fieldia](https://fieldia.dev) fields in a code editor: JSON, and text in
any of 44 languages, coloured as you type. CodeMirror 6, installed with the
package, so it works offline; each language's grammar loads only when a
field uses it.

```sh
npm install @fieldia/code
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { codeWidgets } from '@fieldia/code';

mountViewer(host, { page, dataSource, widgets: codeWidgets });
```

A node opts in with `"widget": "code"`; others keep their plain box.
In React pass `widgets={codeWidgets}`, in Vue `:widgets="codeWidgets"`, in
Angular `[widgets]="codeWidgets"` (spread it beside `gridWidgets` to use both).

## Code in a language

On a `text` field (or a `char` field, kept to one line), name the language:

```json
{ "type": "field", "field": "script", "widget": "code", "options": { "language": "python" } }
```

- JavaScript, TypeScript (and either with JSX), Python, SQL (and the
  PostgreSQL, MySQL, SQLite and SQL Server dialects), HTML, CSS, XML, YAML,
  Markdown, JSON, Java, C, C++, PHP, Rust and Go; and shell, PowerShell,
  Ruby, Perl, Lua, R, Swift, Kotlin, C#, Scala, Dart, Dockerfile, TOML, INI,
  diff, nginx, Protocol Buffers, Haskell, Clojure, Erlang, Groovy and Julia.
  `CODE_LANGUAGES` lists them, each with its other names (`py`, `bash`,
  `yml`, `c++`…); a name is read in any case.
- Each grammar is a dynamic import of its own, so your bundler makes it a
  file of its own: a page with one Python field loads Python's grammar and no
  other.
- A language not on the list, or none, is plain text.
- What is typed reaches the form as text; an empty editor as nothing (null).

## JSON

On a `json` field, `"widget": "code"` edits the value as JSON: valid JSON
reaches the form as it is typed; text that is not valid is said so, and the
last good value stays.

## Every editor

- Line numbers, bracket matching, undo.
- Tab moves to the next field, as in every field; Ctrl+] and Ctrl+[ indent.
- Read-only when the field is; required, invalid and its messages said to
  assistive technology, and named by the field's label.
- Code reads left to right, on an Arabic page too.
- Coloured in Fieldia's tokens: the box on the form's surface, comments in
  its quiet words; keywords, strings and the rest in colours that read at
  4.5:1 or more on every theme's surface, light and dark. Set your own with
  the `--fd-code-keyword`, `--fd-code-string`, `--fd-code-literal`,
  `--fd-code-function`, `--fd-code-type`, `--fd-code-tag` and
  `--fd-code-property` tokens.

For VS Code's editor instead, see `@fieldia/monaco`.

MIT. CodeMirror is MIT too.
