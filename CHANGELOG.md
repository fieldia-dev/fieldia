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
