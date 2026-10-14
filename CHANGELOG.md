# Changelog

## Unreleased (0.21)

### Changed

- **A field's `pattern` now covers the whole answer.** It is checked as
  `^(?:pattern)$`, read with Unicode (`u`), as an answer rule's pattern and the
  browser's own `pattern` attribute are. Before, it was a substring test:
  `"[0-9]{5}"` let `"ab12345cd"` through. It is tested on the answer trimmed,
  with Arabic-Indic, Persian and fullwidth digits read as 0-9 and direction
  marks dropped, and a field with a pattern keeps its answer that way once
  its box is left (`"١١٥١١"` is kept as `"11511"`).
  - A pattern written to match part of an answer, such as `"@acme\\.com"`,
    must now say so: `".*@acme\\.com"`.
  - A pattern that only reads without Unicode (an escaped `\-` outside a
    class) is still read as it was written.
  - A pattern that does not read at all is reported by `checkPage`
    (`fields.<name>.pattern`), and the page is not shown; Save never fails on
    it.
- **`patternHint`**: a char field may say why an answer does not fit its
  pattern, in words (`"{label}: two letters, two digits, then the account"`),
  in place of "not in the expected format". It is translated with the page.
- **A number is never made of what was typed by dropping a key.** The keys
  typed after a refused one wait with it, its words staying under the box;
  Backspace takes them back. Left so, the box keeps all that was typed,
  marked, with why ("1.5" in a whole number is never 15, "-3" never 3,
  "1e5" never 15), and the field keeps what it held. The same in a table's
  cell, a list's filter, the designer's number settings and a map's
  coordinates.
- **Numbers are read as people write them, typed or pasted.** A 0 never
  leads a group ("0,500" and German "0.500" are a half, never 500); a
  number written the other way round can be typed key by key, as it could be
  pasted ("1.234,56" on an English page); trailing zeros are no places, so
  "12.50" pastes into a box of one place and "1,200.00" into a whole number.
- **A tax amount has its currency's places**: three for the Kuwaiti,
  Bahraini, Omani and Jordanian dinars and rials, shown as they are.
- **The designer's typed numbers use the shared reader**: a value set when
  ("Set to") is the designer's number box, never the browser's ("1,5" is 1.5,
  "٥٠" 50); a link's "has the value" reads Arabic and Persian digits, and
  keeps "0x10" and "1e3" as the words they are; a setting refused because of
  another ("From is not less than To") is said under its own box. A map's
  coordinates read Persian digits and drop direction marks, and a formula's
  list reads its numbers as the formula does (`qty in [٣, ٤]`).
- **A year of two digits is no longer read as 20xx.** "15/3/85" could be 1985
  or 2085, so a date box, a table's cell, a pasted block and a list's filter
  keep it unread and say both ("“85” could be 1985 or 2085; write the year in
  full"), in English, Arabic, French and German. Write the year in full.
- **A date written as Fieldia shows it at rest is read back**: its month in
  words in any of Fieldia's four languages ("15 Oct 2026", "15 أكتوبر 2026",
  "15 oct. 2026", "15. Okt. 2026", "Oct 15, 2026", with ", 14:30" for a date
  and time), and an instant with its zone ("2026-10-15T14:30:00Z"). Copied
  from a list, a read-only view or another box, a date now pastes.
  A date's box takes an instant's day; a date and time's keeps to the minute,
  so one with seconds is refused and says why, never cut short.
- **An email address has no ":", ";" or "," before its @.** A pasted
  "mailto:" link is taken as the address it links to, and zero-width
  characters a paste brings are dropped; a ":" typed before the @ is refused
  with words. An address saved with one of these marks before its @ no longer
  passes the email check.
