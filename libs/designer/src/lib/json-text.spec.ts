import { offsetOf, pathTo, placeAt, placeOf, readJson, type JsonRead } from './json-text';

const read = (text: string) => readJson(text) as Extract<JsonRead, { ok: true }>;
const problem = (text: string) => (readJson(text) as Extract<JsonRead, { ok: false }>).problem;

describe('reading JSON text', () => {
  it('reads what JSON.parse reads, to the same value', () => {
    const samples = [
      '{}',
      '[]',
      '{"a": 1, "b": [true, false, null], "c": {"d": "e"}}',
      '  [1, -2, 3.5, 4e2, -0.5E-3, 0]  ',
      '"text with \\"quotes\\", a \\\\ and \\u00e9 \\n\\t\\/\\b\\f\\r"',
      '{"a": {"b": {"c": [[], [{}], [[1]]]}}}',
      '{"same": 1, "same": 2}',
    ];
    for (const text of samples) expect(read(text).value).toEqual(JSON.parse(text));
  });

  it('keeps a key named __proto__ as a key, as JSON.parse does', () => {
    const value = read('{"__proto__": {"x": 1}}').value as Record<string, unknown>;
    expect(Object.keys(value)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });

  it('says what is wrong in words, with the line and column', () => {
    expect(problem('{\n  "a": 1\n  "b": 2\n}')).toEqual({ line: 3, column: 3, message: 'A comma is missing before this' });
    expect(problem('{\n  "a": 1,\n}')).toEqual({ line: 2, column: 9, message: 'Nothing follows this comma: take it away' });
    expect(problem('[1, 2,]')).toEqual({ line: 1, column: 6, message: 'Nothing follows this comma: take it away' });
    expect(problem('{ label: "x" }')).toEqual({ line: 1, column: 3, message: 'A key goes in double quotes, such as "label"' });
    expect(problem("{ \"a\": 'x' }")).toEqual({ line: 1, column: 8, message: 'Text goes in double quotes' });
    expect(problem('{ "a" 1 }')).toEqual({ line: 1, column: 7, message: 'A colon is missing after the key' });
    expect(problem('{ "a": "open }')).toEqual({ line: 1, column: 8, message: 'This text has no closing double quote' });
    expect(problem('{ "a": "one\ntwo" }')).toEqual({ line: 1, column: 12, message: 'A line break cannot sit inside text: write \\n' });
    expect(problem('{ "a": [1, 2 }')).toEqual({ line: 1, column: 14, message: 'A comma or a closing ] is missing here' });
    expect(problem('{ "a": 1')).toEqual({ line: 1, column: 9, message: 'The text ends too soon: a closing } is missing' });
    expect(problem('{ "a": 01 }')).toEqual({ line: 1, column: 8, message: 'A number cannot start with extra zeros' });
    expect(problem('{ "a": tru }')).toEqual({ line: 1, column: 8, message: 'This is not a value JSON knows: text in double quotes, a number, true, false, null, [ … ] or { … }' });
    expect(problem('{ "a": "\\q" }')).toEqual({ line: 1, column: 9, message: '"\\q" is not something JSON knows: write \\\\ for a backslash' });
    expect(problem('{} {}')).toEqual({ line: 1, column: 4, message: 'There is more after the end: one { … } is the whole page' });
    expect(problem('   ')).toEqual({ line: 1, column: 4, message: 'The box is empty: a page is a JSON object, { … }' });
    expect(problem('{ // a note\n}')).toEqual({ line: 1, column: 3, message: 'JSON has no comments' });
    expect(problem('{ "a": 1 } ]')).toEqual({ line: 1, column: 12, message: 'There is more after the end: one { … } is the whole page' });
  });

  it('turns a line and column back into a place in the text, kept inside it', () => {
    const text = 'ab\ncde\n\nf';
    expect(offsetOf(text, { line: 2, column: 2 })).toBe(4);
    expect(offsetOf(text, { line: 2, column: 99 })).toBe(6);
    expect(offsetOf(text, { line: 3, column: 1 })).toBe(7);
    expect(offsetOf(text, { line: 9, column: 1 })).toBe(text.length);
    expect(placeAt(text, 4)).toEqual({ line: 2, column: 2 });
    expect(placeAt(text, 8)).toEqual({ line: 4, column: 1 });
  });

  it('counts columns from 1 and lines after \\r\\n too', () => {
    expect(problem('{\r\n"a": 1\r\n"b": 2}')).toEqual({ line: 3, column: 1, message: 'A comma is missing before this' });
  });
});

describe('the place of a path in the text', () => {
  const text = [
    '{',
    '  "fieldia": "0.1",',
    '  "fields": {',
    '    "email": { "type": "char", "label": "Email" },',
    '    "a\\"b": { "type": "char", "label": "Quoted" }',
    '  },',
    '  "layout": {',
    '    "children": [',
    '      { "id": "s1", "children": [',
    '        { "id": "q1", "field": "email" },',
    '        { "id": "q2", "field": "nope", "invisible": "x == 1" }',
    '      ] }',
    '    ]',
    '  },',
    '  "translations": { "ar": { "Hello. World[0]": "x" } }',
    '}',
  ].join('\n');
  const { tree } = read(text);
  const at = (path: string) => placeOf(text, tree, path);

  it('finds a key in nested objects and arrays', () => {
    expect(at('fieldia')).toEqual({ line: 2, column: 3 });
    expect(at('fields.email')).toEqual({ line: 4, column: 5 });
    expect(at('fields.email.label')).toEqual({ line: 4, column: 32 });
    expect(at('layout.children[0]')).toEqual({ line: 9, column: 7 });
    expect(at('layout.children[0].children[1].field')).toEqual({ line: 11, column: 23 });
    expect(at('layout.children[0].children[1].invisible')).toEqual({ line: 11, column: 40 });
  });

  it('reads escaped keys as the keys they spell', () => {
    expect(at('fields.a"b.label')).toEqual({ line: 5, column: 31 });
  });

  it('finds a key with dots and brackets in it, the longest that fits', () => {
    expect(at('translations.ar.Hello. World[0]')).toEqual({ line: 15, column: 29 });
  });

  it('stops at the deepest part there is, when the rest is missing', () => {
    // A page with no id: the page itself.
    expect(at('id')).toEqual({ line: 1, column: 1 });
    expect(at('(page)')).toEqual({ line: 1, column: 1 });
    expect(at('fields.email.help')).toEqual({ line: 4, column: 5 });
    expect(at('layout.children[0].children[7]')).toEqual({ line: 9, column: 21 });
    expect(at('layout.children[3].field')).toEqual({ line: 8, column: 5 });
  });

  it('finds the path to a part by what it is, for a check that names its element', () => {
    const page = read(text).value;
    expect(pathTo(page, (v) => (v as { id?: unknown }).id === 'q2')).toBe('layout.children[0].children[1]');
    expect(pathTo(page, (v) => (v as { id?: unknown }).id === 's1')).toBe('layout.children[0]');
    expect(pathTo(page, (v) => (v as { id?: unknown }).id === 'none')).toBeNull();
    expect(at(pathTo(page, (v) => (v as { id?: unknown }).id === 'q2') as string)).toEqual({ line: 11, column: 9 });
  });
});
