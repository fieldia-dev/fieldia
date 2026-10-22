import type { ValueKind } from '@fieldia/core';
import type { DesignerWords } from '../../designer-words';
import { listOf, plural } from '../speak';

/** The kinds of value, as a sentence names them. */
const KINDS: Record<ValueKind, string> = { number: 'un número', text: 'texto', date: 'una fecha', boolean: 'sí o no', list: 'una lista', any: 'cualquier valor' };
/** The formula's own words, said in Spanish; "not in" is one piece. */
const KEYWORDS: Record<string, string> = { and: 'y', or: 'o', not: 'no', in: 'está en', 'not in': 'no está en' };

const lower = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);
/** A length counts characters, as Spanish software says it. */
const letters = (n: number) => plural('es', n, { one: '# carácter', other: '# caracteres' });
const andWords = (words: readonly string[]) => listOf('es', words, 'and');
const quoted = (text: string) => `“${text}”`;

/**
 * The designer's words in Spanish: rules as sentences — "Se muestra cuando Estado es Activo", "Calculado a partir de
 * Precio × Cantidad", "Termina en @acme.com — solo advierte" — and a formula in words: its signs, what is wrong with it,
 * what it gives on made-up values. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const rules: DesignerWords['rules'] = {
  kinds: {
    length: 'Una longitud',
    ending: 'Una terminación',
    pattern: 'Un patrón',
    range: 'Un rango',
    count: 'Cuántas se marcan',
    past: 'Una fecha en el pasado',
    future: 'Una fecha en el futuro',
    across: 'Una regla entre campos',
    distinct: 'Ningún valor repetido en una columna',
  },
  patterns: { letters: 'Solo letras', digits: 'Solo dígitos', lettersAndDigits: 'Solo letras y dígitos' },
  exactlyLetters: (n) => `Exactamente ${letters(n)}`,
  mustExactlyLetters: (n) => `Debe tener exactamente ${letters(n)}`,
  betweenLetters: (a, b) => `Entre ${a} y ${letters(b)}`,
  mustBetweenLetters: (a, b) => `Debe tener entre ${a} y ${letters(b)}`,
  atLeastLetters: (n) => `Al menos ${letters(n)}`,
  mustAtLeastLetters: (n) => `Debe tener al menos ${letters(n)}`,
  atMostLetters: (n) => `Como máximo ${letters(n)}`,
  mustAtMostLetters: (n) => `Debe tener como máximo ${letters(n)}`,
  mustNamed: { letters: 'Debe contener solo letras', digits: 'Debe contener solo dígitos', lettersAndDigits: 'Debe contener solo letras y dígitos' },
  matches: (pattern) => `Coincide con el patrón ${pattern}`,
  mustMatch: (pattern) => `Debe coincidir con el patrón ${pattern}`,
  endsWith: (end) => `Termina en ${end}`,
  mustEndWith: (end) => `Debe terminar en ${end}`,
  exactly: (n) => `Exactamente ${n}`,
  mustExactly: (n) => `Debe ser exactamente ${n}`,
  between: (a, b) => `Entre ${a} y ${b}`,
  mustBetween: (a, b) => `Debe estar entre ${a} y ${b}`,
  atLeast: (n) => `Al menos ${n}`,
  mustAtLeast: (n) => `Debe ser al menos ${n}`,
  atMost: (n) => `Como máximo ${n}`,
  mustAtMost: (n) => `Debe ser como máximo ${n}`,
  tickBetween: (a, b) => `Marcar entre ${a} y ${b}`,
  mustTickBetween: (a, b) => `Debe marcar entre ${a} y ${b}`,
  tickAtLeast: (n) => `Marcar al menos ${n}`,
  mustTickAtLeast: (n) => `Debe marcar al menos ${n}`,
  tickAtMost: (n) => `Marcar como máximo ${n}`,
  mustTickAtMost: (n) => `Debe marcar como máximo ${n}`,
  past: 'Una fecha en el pasado',
  mustPast: 'Debe ser una fecha en el pasado',
  future: 'Una fecha en el futuro',
  mustFuture: 'Debe ser una fecha en el futuro',
  mustHold: (formula) => `Debe cumplirse: ${formula}`,
  // "No Customer twice": said of the column's values, so nothing agrees with the column's own noun.
  distinct: (column) => `Ningún valor de ${column} repetido`,
  mustDistinct: (column) => `Cada valor de ${column} debe aparecer una sola vez`,
  joinAsks: (asks) => [asks[0], ...asks.slice(1).map(lower)].join(', '),
  onlyWarns: 'solo advierte',
  neverChecked: 'nunca se comprueba',
  onlyWhen: (condition) => `solo cuando ${condition}`,
  sentence: (said, notes) => (notes.length ? `${said} — ${notes.join(', ')}` : said),
  must: (said, notes) => (notes.length ? `${said} (${notes.join(', ')})` : said),
  asksNothingYet: 'Aún no pide nada',
  asksNothing: 'No pide nada',
  is: 'es',
  isNot: 'no es',
  test: (field, op, value) => `${field} ${op} ${value}`,
  allOf: (tests) => tests.join(' y '),
  anyOf: (tests) => tests.join(' o '),
  text: (text) => quoted(text),
  yes: 'Sí',
  no: 'No',
  nothing: 'nada',
  untitledPage: 'Página sin título',
  alwaysHidden: 'Siempre oculto',
  hiddenWhen: (formula) => `Oculto cuando ${formula}`,
  showsWhen: (condition) => `Se muestra cuando ${condition}`,
  requiredWhen: (formula) => `Obligatorio cuando ${formula}`,
  readonlyWhen: (formula) => `Solo lectura cuando ${formula}`,
  workedOutFrom: (formula) => `Calculado a partir de ${formula}`,
  setTo: (value, when) => `Se establece en ${value} cuando ${when}`,
  // After "cuando": the verb first, singular with "o" — "cuando cambia “Precio” o “Cantidad”".
  onChange: (labels, condition) => `cambia ${listOf('es', labels.map(quoted), 'or')}${condition ? `, si ${condition}` : ''}`,
  signs: { is: 'es', isNot: 'no es' },
  keyword: (word) => KEYWORDS[word.toLowerCase().split(/\s+/).join(' ')] ?? word,
  quoteName: (label) => quoted(label),
  typeAFormula: 'Escriba una fórmula',
  cannotBeIn: (sign) => `“${sign}” no puede estar en una fórmula,`,
  unknownField: (name) => `Campo desconocido “${name}”`,
  personHas: (part) => `La persona tiene un identificador, un nombre o roles, no “${part}”`,
  unknownFunction: (name) => `Función desconocida “${name}”`,
  wrongKind: (name, wants, given, got) => `“${name}” admite ${listOf('es', wants.map((kind) => KINDS[kind]), 'or')}: ${given} es ${KINDS[got]}`,
  takes: (name, rest) => {
    // The formula reader's own words after the name, said again in Spanish; an example formula stays as written.
    let said: string;
    let m: RegExpExecArray | null;
    if (/^ takes no values/.test(rest)) said = 'no admite valores';
    else if ((m = /^ takes (\d+) or more values/.exec(rest))) said = `admite ${m[1]} o más valores`;
    else if ((m = /^ takes (\d+) or (\d+) values/.exec(rest))) said = `admite ${m[1]} o ${m[2]} valores`;
    else if ((m = /^ takes (\d+) values?/.exec(rest))) said = `admite ${plural('es', Number(m[1]), { one: '# valor', other: '# valores' })}`;
    else if ((m = /^ takes the name of a field[^:]*: (.*)$/.exec(rest))) said = `admite el nombre de un campo, entre comillas, después de las líneas: ${m[1]}`;
    else if ((m = /^ takes a condition[^:]*: (.*)$/.exec(rest))) said = `admite una condición, entre comillas, sobre las líneas: ${m[1]}`;
    else said = 'no admite estos valores';
    return `“${name}” ${said},`;
  },
  neverClosed: 'Un “(” nunca se cierra',
  missingAfter: (piece) => `Falta algo después de “${piece}”`,
  outOfPlace: (piece) => `“${piece}” está fuera de lugar`,
  at: (words, place) => `${words} en la posición ${place}`,
  fromItself: (label) => `“${label}” no se puede calcular a partir de sí mismo`,
  circle: (label, path) => `“${label}” se calcularía a partir de sí mismo: ${path.join(' → ')}`,
  cannotWorkOut: 'nada — no se puede calcular',
  always: (value) => `Siempre ${value}`,
  given: (name, value) => `${name} ${value}`,
  withValues: (given, result) => `Con ${andWords(given)}: ${result}`,
  alwaysHolds: 'Siempre se cumple',
  neverHolds: 'Nunca se cumple',
  checkedOnce: (names) => `Se comprueba una vez que ${names.length === 1 ? 'se completa' : 'se completan'} ${andWords(names)}`,
  holds: 'se cumple',
  doesNotHold: 'no se cumple',
  asks: {
    minLength: 'una longitud',
    maxLength: 'una longitud',
    endsWith: 'una terminación',
    pattern: 'un patrón',
    min: 'un rango',
    max: 'un rango',
    atLeast: 'cuántas se marcan',
    atMost: 'cuántas se marcan',
    date: 'una fecha en el pasado o en el futuro',
    holds: 'una regla entre campos',
    distinct: 'ningún valor repetido en una columna',
  },
  computeFromModel: (label) => `Cómo se calcula “${label}” viene del modelo de datos`,
  notALineField: (name, table) => `“${name}” no es un campo de las líneas de ${table}`,
  setFromModel: (label) => `Lo que establece “${label}” viene del modelo de datos`,
  cannotBeWorkedOut: (label, stored) => `“${label}” contiene ${stored}, que no se puede calcular a partir de otros campos`,
  cannotBeSet: (label, stored) => `“${label}” contiene ${stored}, que una regla no puede establecer`,
  inWhen: (problem) => `Cuando: ${problem}`,
  inSetTo: (problem) => `Establecer en: ${problem}`,
  holdsNot: (label, stored, value) => `“${label}” contiene ${stored}, no ${value}`,
  offersNot: (label, offered, value) => `“${label}” ofrece ${andWords(offered)}, no ${value}`,
  askSomething: 'Una regla pide algo: una longitud, una terminación, un patrón, un rango, cuántas se marcan, una fecha o una regla entre campos',
  askMisfit: (label, stored, ask) => `“${label}” contiene ${stored}: ${ask} no le corresponde`,
  patternUnreadable: (pattern) => `El patrón “${pattern}” no se puede leer`,
  lengthWhole: 'Una longitud es un número entero de caracteres',
  tickedWhole: 'Cuántas se marcan es un número entero',
  rangeNumbers: 'Un rango va de un número a otro',
  shortestLonger: (a, b) => `La longitud mínima, ${a}, es mayor que la máxima, ${b}`,
  smallestMore: (a, b) => `El mínimo, ${a}, es mayor que el máximo, ${b}`,
  atLeastMore: (a, b) => `“Al menos ${a}” es más que “Como máximo ${b}”`,
  inMustHold: (problem) => `Debe cumplirse: ${problem}`,
  inOnlyWhen: (problem) => `Solo cuando: ${problem}`,
  noRule: (label, n) => `“${label}” no tiene la regla ${n}`,
};
