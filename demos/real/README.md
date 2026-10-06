# Real pages

Sherkety ERP's own screens (Flectra form views in
`amlak/sherketyerp/flectra`), rebuilt as Fieldia pages to learn whether
Fieldia covers what real pages need, from a small dialog to the largest record.

Each lane keeps its own files, so lanes never touch each other's:

| Where | What |
|---|---|
| `examples/pages/real-<page>.page.json` | the page, in Fieldia's format — checked by the JSON Schema test |
| `demos/shared/real/<lane>.ts` | its pages, sample records, server rules (onchange, warnings), lists, and the app's answers to its actions |
| `demos/real/<lane>.mjs` | its cards in the gallery (category `real`) |
| `demos/real/gaps/<lane>.json` | the gap log |
| `e2e/real-<lane>.spec.ts` | a person using each page, in every framework |

## The gap log

For every page, every feature of the Flectra view — each field, widget,
condition, button, smart button, tab, table, the chatter — and whether
Fieldia has it:

```json
{
  "lane": "sales",
  "pages": [
    {
      "id": "real-sale-order",
      "title": "Sales order",
      "flectra": { "module": "sale", "model": "sale.order", "view": "view_order_form", "file": "addons/sale/views/sale_order_views.xml" },
      "size": { "fields": 129, "tabs": 3, "tables": 1, "headerButtons": 14, "smartButtons": 1, "conditions": 81 },
      "features": [
        { "feature": "Order lines with sections and notes", "status": "covered", "how": "one2many lines with section/note kinds" },
        { "feature": "Tax totals block (account-tax-totals-field)", "status": "approximated", "how": "worked-out amounts under the grid; no per-tax breakdown" },
        { "feature": "Product configurator on a line", "status": "missing", "needs": "a dialog step from a line's product change" }
      ]
    }
  ]
}
```

`status` is `covered` (Fieldia does it as Flectra does), `approximated`
(Fieldia does it another way — say how), or `missing` (say what Fieldia
would need). Anything a real deployment does on the server (Flectra's
Python) is the app's — a data source's onchange or an action's answer —
and counts as covered when the page can call it.
