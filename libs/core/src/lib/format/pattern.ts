/**
 * A field's `pattern`, as it is checked: about the whole answer, not a part
 * of it — "[0-9]{5}" takes "11511" and never "ab11511cd", as an answer
 * rule's pattern and the browser's own `pattern` attribute do — and read with
 * Unicode (`u`), so `\p{L}` is any letter. A pattern written before patterns
 * were read with Unicode, which only reads without it (an escaped "\-" outside
 * a class), is read as it was written. A pattern that does not read at all
 * is the reason why, for checkPage to name: a check never throws on one.
 */
export function fieldPattern(pattern: string): RegExp | Error {
  const found = compiled.get(pattern);
  if (found) return found;
  let made: RegExp | Error;
  try {
    made = new RegExp(`^(?:${pattern})$`, 'u');
  } catch (unicode) {
    try {
      made = new RegExp(`^(?:${pattern})$`);
    } catch {
      made = unicode as Error;
    }
  }
  compiled.set(pattern, made);
  return made;
}

const compiled = new Map<string, RegExp | Error>();
