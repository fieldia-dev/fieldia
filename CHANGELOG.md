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
- **Fieldia's own date box comes in a part of its own.** A date, a date and
  time, a time of day and a range of dates are drawn by the date part, loaded
  the first time a page shows one — `fieldia.date.js` beside `fieldia.js`, or
  a chunk an app's bundler makes — so a page with no date never downloads the
  box, its calendar or a range's (7 KB gzipped). The viewer waits for it
  before it draws a page with a date, a table whose lines have one, or
  properties, as it waits for 0.20's parts: nothing moves as it comes. A
  saved form placed in a page waits for its own parts the same way, under its
  placeholder. React's and Vue's `<FieldiaForm>` render their fields and
  slots when such a page is drawn after the component mounted (Vue's left
  them out). The reader stays in the main script for every box that reads a
  date (`readDateText`, `dateOrderOf`, `dateShape`, `dateExample`,
  `isoWeek`), and a date drawn before its part came is a plain box on that
  reader (`plainDateWidget`). `withCalendar` now comes from the part:
  `(await datePart.load()).withCalendar(…)`.
- **The designer's dates and times are Fieldia's own box**, never the
  browser's date or time box: a date's earliest or latest day, a time's
  earliest and latest, and the value a rule sets a date or a date and time to
  ("Set to") are typed in the page's order (15/10/2026), Arabic and Persian
  digits read, am and pm too. What does not read (31/02) keeps the setting and
  says why under its box; at rest a day shows in words (15 Oct 2026). A day
  and time set by a rule is still kept as the browser's box kept it,
  2026-10-15T14:30. The date box's input rules are the date part's
  `dateRules`, for any box a date is typed into, and `typingText` and
  `restingText` write a date as a box shows it while typed and at rest.
- **A date is never made of the keys around a refused one.** In a date, a
  date and time or a time box — a field's, a table's cell, a designer's
  setting — the keys typed after a refused letter wait with it, as a
  number's do: "1x5/10/2026" is never 15 October. Backspace takes them back;
  left so, the box keeps all that was typed, marked, with why, and the field
  keeps its day.
- **Enter saves from every one-line box again, as in 0.20.** The input
  rules took Enter in a number, an email or a box at its most characters for
  a typed line break: it was refused with false words ("several were
  pasted", "no spaces", "at most 120 characters") and the form was not sent.
  Enter in one line is now never judged, held or stopped: it sends the form,
  or moves to the next field where the page asks.
- **A save reads what is still typed first.** Ctrl+Enter, a button's key,
  the app's own `form.save()`, a check, a wizard's step forward and the
  record pager read the box being typed in before anything is saved, as
  leaving it would: a number, hours or a per cent passed on the way ("1" of
  "1.5", 12.3 of "12.34") is never saved; what does not read is refused with
  its words under its box. Every form has `settling(read)`, for a box that
  reads its text as it is left to say how to read it now, and `settle()`.
- **A phone number, an email and a colour's code hold the keys typed after a
  refused one**, as numbers and dates do: "+20 1oo 123 4567" is never the
  number "+20 1 123 4567", "ahmed ali@example.com" never
  "ahmedali@example.com", "#1x23" never #112233. Left so, all that was typed
  stays, and the field says why.
- **A time's one-digit minute is never quietly :03.** "14:3" could be 14:03
  or 14:30, and "14.5" 14:05, half past two or 14:50: a time, a date and
  time, hours and a pasted cell keep it unread and name each time it could be
  ("“14:3” could be 14:03 or 14:30; write the minutes with two digits"),
  joined as the page's language offers a choice. "14:7" can only be 14:07,
  and is read.
- **A date and time pasted into a date says its time was left out**, and a
  pasted cell of a date never takes an instant's day in silence.
- **A block pasted into a per cent or hours column keeps to its places and
  least**, as its box does: "12.555" in a column of two places is not pasted,
  never shown as 12.56 %. "Pasted into 1 cell", "1 character too many": a
  count of one is said in the singular, by the language's own rules.
