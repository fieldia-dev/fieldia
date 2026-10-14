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
