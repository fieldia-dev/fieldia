import { jsonProblem } from './json-problem';

describe('where JSON goes wrong', () => {
  it('finds nothing wrong in valid JSON, the same as JSON.parse', () => {
    for (const text of ['{}', '[]', '0', '-1.5e3', 'true', 'null', '"a\\u00e9\\n"', '{ "a": [1, 2, { "b": null }], "c": "x" }', '  [ ]  ']) {
      expect([text, jsonProblem(text)]).toEqual([text, null]);
      expect(() => JSON.parse(text)).not.toThrow();
    }
  });

  it('says the line and column of the first character that cannot be there', () => {
    // A comma after the last closing brace: line 7, column 2.
    const text = '{\n  "weekdays": "07:00-20:00",\n  "weekends": "closed",\n  "holidays": [\n    "2026-10-06"\n  ]\n},';
    expect(jsonProblem(text)).toEqual({ offset: text.length - 1, line: 7, column: 2, reason: 'char', char: ',' });
    // A key without quotes, on the second line.
    expect(jsonProblem('{\n  name: 1\n}')).toMatchObject({ line: 2, column: 3 });
    // A trailing comma inside an object: the closing brace is where it breaks.
    expect(jsonProblem('{"a": 1,}')).toMatchObject({ line: 1, column: 9 });
    expect(jsonProblem('[1 2]')).toMatchObject({ line: 1, column: 4 });
    expect(jsonProblem("{'a': 1}")).toMatchObject({ line: 1, column: 2 });
    expect(jsonProblem('01')).toMatchObject({ line: 1, column: 2 });
    expect(jsonProblem('"tab\there"')).toMatchObject({ line: 1, column: 5 });
  });

  it('says the end, when the text stops too soon', () => {
    const text = '{\n  "a": [1, 2';
    expect(jsonProblem(text)).toEqual({ offset: text.length, line: 2, column: 13, reason: 'end' });
    expect(jsonProblem('"open')).toMatchObject({ line: 1, column: 6 });
  });

  it('agrees with JSON.parse on what is valid, over many broken texts', () => {
    const texts = ['{', '}', '[,]', '[1,]', '{"a"}', '{"a":}', 'tru', 'nul', '--1', '1.', '.5', '1e', '"\\x"', '[1]]', '{"a":1 "b":2}', 'NaN', ' []'];
    for (const text of texts) {
      let valid = true;
      try {
        JSON.parse(text);
      } catch {
        valid = false;
      }
      expect([text, jsonProblem(text) === null]).toEqual([text, valid]);
    }
  });
});
