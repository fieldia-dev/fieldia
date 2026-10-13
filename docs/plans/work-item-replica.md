# The work item replica — measured, mapped, split

The user's words: *"i thought it will be in a popup exact look and feel this isn't like the screenshot i provided to you"*.

The goal is a Fieldia page that reproduces the twelve screenshots in `/home/rthm/Downloads/fieldia-screens`: a bug's edit window, a large popup over the backlog, with the same layout, spacing, type, colours, controls and behaviour. The demo `page=work-item` (the "Work item, quiet" demo) only borrows the quiet field look. Every piece a real app would need is built as a general Fieldia feature: a page-format option with its zod schema and spec tests, designer support, words in en/ar/fr/de, right-to-left, dark scheme, keyboard, and no axe findings. The demo only puts those features together.

Every builder reads this file first, then opens the screenshots with the Read tool and looks at them again. **A passing test is not a look:** screenshot what you build and compare it with the user's screenshot of the same state, side by side.

---

## 0. Rules that win over the screenshots

1. **No disabled-looking control without a reason.** DevOps greys out *Save and Close*, *Undo* (revert), the comment's *Save*, the toolbar's *Remove link* and the backlog's *New Work Item* until they can act. In Fieldia they look usable:
   - *Save and Close* with nothing changed simply closes.
   - *Undo* with nothing changed says "Nothing has changed." in the live region.
   - The comment's *Save* with nothing typed keeps the box open and says "Write a comment first." under it.
   - *Remove link* with no link in the selection says "Put the cursor in a link first."
   - *New Work Item* opens a new bug.
2. **Icon-only buttons keep a name** (`aria-label` and a tooltip `title`). This covers ⤢, ×, refresh, undo, ⋮, Follow's gear, the History tab, the Links and Attachments tabs (named with their count, e.g. "Links, 0"), every toolbar tool, every group heading tool, Copy title, and the tree chevrons.
3. **Nothing is reachable only by hover.** Some tools appear on hover: the heading tools (⤢ ^ ✎), Copy title, a quiet field's chevron, and the list's column resizers. Each of them also shows on keyboard focus (`:focus-within` / `:focus-visible`), is in the Tab order or on an arrow-key path, and always shows where no pointer can hover (`@media (hover: none)`).
4. **Content is invented.** Do not use real people, real bug titles or real URLs. Do not use "sherkety", "Pams", "Youssef", "Heba" or "Ramy". The demo's chrome has no Microsoft logos and no product names (no "Azure", no "DevOps", no "Contoso", "Northwind" or "Fabrikam"). The UI's own words stay exactly as the screenshots show them:
   - "Save and Close", "Follow", "Add Tag", "No one selected", "Comment"
   - "Repro Steps", "System Info", "Discussion", "Planning", "Effort (Hours)", "Deployment", "Development", "Related Work"
   - "Add link", "Existing item", "New item", "Add an existing work item as a parent"
   - "Click to add System Info.", "switch to Markdown editor", "Markdown supported.", "Paste or select files to insert.", "Preview", "Suggestions"
   - "Updated by", "Details", "State Graph", "History", "Older"
   - "Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request.", "Cancel", "Save"
   - "Category", "Resolved Reason", "Story Points", "Priority", "Severity", "Activity", "Original Estimate", "Remaining", "Completed", "Found in Build", "Integrated in Build"
   - The backlog's "Filter by keyword", "New Work Item", "View as Board", "Column Options", "Backlog", "Analytics", "Order", "Title", "State", "Story Points", "Value Area", "Iteration Path", "Tags"
5. **Fieldia's existing behaviour stays.** The existing `work-item` page and `e2e/quiet-look.spec.ts` are not changed. The replica gets new pages.

---

## 1. The twelve screenshots

All popup screenshots are 1920×1080 macOS captures of Chrome at 100%, so 1 screenshot px = 1 CSS px. Chrome's own UI takes y 0–150. The page starts at y=150, and the popup (the "dialog") sits at **x 96–1823, y 197–1033**. Below, coordinates are absolute screenshot px, with dialog-relative values in brackets: `(+dx,+dy)` from the dialog's top-left, or `right−n` from its right edge (x=1823).

| File | What it shows |
|---|---|
| `Screenshot … 20.20.45 (3).png` | **State list open** (✓ on Active) **and the Area picker open** ("Suggestions" heading, Pams highlighted, divider, tree root). The State text box shows a caret. |
| `Screenshot … 20.21.54 (3).png` | **Repro Steps in Markdown edit**: a card with a shadow, a text box, a hint, a 13-tool toolbar and the Preview switch. Heading tools ⤢ ^ ✓. |
| `Screenshot … 20.22.23 (3).png` | **At rest**, the reference state. Discussion with an empty comment box and one posted comment. |
| `Screenshot … 20.22.25 (3).png` | **System Info pointed at**: a 1px #eaeaea box, heading tools ⤢ ^. |
| `Screenshot … 20.22.28 (3).png` | **System Info focused**: an accent box with the 20-tool rich-text toolbar at its bottom, and "switch to Markdown editor" under it. |
| `Screenshot … 20.22.36 (3).png` | **The new comment box focused**: the rich toolbar ending in "…", "switch to Markdown editor", Cancel and Save. |
| `Screenshot … 20.23.03 (3).png` | **Related Work's "Add link ▾" open**: the menu "Existing item" / "New item". Effort (Hours) is folded (⌄). |
| `Screenshot … 20.24.05 (3).png` | **The Iteration picker open**: suggestions with right-aligned date ranges, a divider, the tree "⌄ Pams" expanded with its children, and a scrolling callout. Here Repro Steps is empty, so the groups below it moved up. |
| `Screenshot … 20.24.46 (3).png` | **The History tab**: the State Graph, the history list grouped "Older" with one row selected, and that change's before/after in the right pane. |
| `Pams-…Backlog…08_18_PM.png` (2044×929) | **The backlog list** with no popup: the page header, pivots, filter bar and table. |
| `Pams-…Backlog…08_19_PM.png` (1920×983, page only) | **The popup over the backlog**, the title being pointed at (a 1px box and the copy button). Dialog at x 96–1823, y 46–936. |
| `Pams-…Board…08_17_PM.png` (1920×2664) | **The Kanban board.** Out of scope for this replica: the board is Grafloria's Kanban. It is listed only so nobody builds it here. |

---

## 2. Measurements

### 2.1 Type

Measured cap heights:
- title "5" = 13 rows
- group heading "R" = 12 rows
- "Follow"'s "F" = 10 rows
- "Details"'s "D" = 10 rows
- labels' "S" = 9 rows
- badge "B" = 9 rows

On a Mac, the font renders as the system font. Use this stack: `"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif`. It is a font stack, not product chrome.

| Use | Size / weight | Colour (light) |
|---|---|---|
| Title and its number ("5140" → ours "4127") | 18px / 400 | title #1a1a1a, number #000 |
| Group headings ("Repro Steps", "Planning", "State Graph", "History") | 16px / 600 | #000 |
| Values, body text, comment text, menu items, list cells | 14px / 400 | #1a1a1a |
| Buttons ("Follow", "Add Tag", "Add link", "Cancel"), the selected tab, a comment's author, "Suggestions" | 14px / 600 | #191919; author #7e7e7e |
| Field labels, "Updated by…", the badge "BUG 5140", "commented Jun 14", dates in History, list headers | 12px / 400 (list headers 600) | labels #7a7a7a on the band and #7e7e7e on white; badge #005a9e |
| "switch to Markdown editor" | 12px / 400, underlined | link colour |
| Placeholder ("Click to add System Info.", the comment hint) | 14px *italic* | #7e7e7e |

### 2.2 Colours (light; the dark values are derived, not measured)

Neutral greys are exact pixel samples. Two kinds of blue were measured:
- the theme blue (focus and selection) at #1d78d4, which is presumed to be the source colour #0078d4;
- the link blue at #135a9e, which is presumed to be #005a9e.

The measured value is shown, with the value to use in brackets.

| Token (proposed `--fd-…`) | Light | Dark (derived) | Where |
|---|---|---|---|
| `surface` | #ffffff | #252423 | dialog, body, cards, menus |
| `band` *(new token)* | #f8f8f8 | #2d2c2b | the head's field band, the History group headers |
| `fill` | #f2f2f2 | #3b3a39 | subtle buttons (Save and Close, Follow, Add Tag, Cancel), Copy title |
| pressed / expanded | #d2d2d2 | #484644 | "Add link ▾" while its menu is open |
| `border` (hairline) | #eaeaea | #3b3a39 | group rules, list row lines, the comment box edge, a hovered rich text box |
| `border-strong` (hover edge) | #7e7e7e | #8a8886 | a text box pointed at (title, Area) |
| tabs edge | #dadada | #484644 | the tab group's frame and dividers |
| count pill | #ebebeb | #3b3a39 | "0", "1" by Links and Attachments |
| `help` *(new token)* | #f4f4f4 | #2d2c2b | the Deployment, Development and Related Work help boxes |
| `text` | #1a1a1a (headings #000) | #f3f2f1 | |
| `muted` | #7e7e7e on white, #7a7a7a on band | #a19f9d | labels, hints, dates |
| disabled-looking text (DevOps only) | #9f9f9f / #a3a3a3 | — | **not used in Fieldia** except for a locked value's words, which Fieldia already mutes |
| `accent` / `focus` | #1d78d4 (#0078d4) | #2899f5 | focus edge, selected tab underline, focus rectangle in lists |
| `accent-soft` (selection) | #deecf9 | #0e2d4a | the highlighted list row, the State Graph state chips |
| `link` *(new token)* | #135a9e (#005a9e) | #6cb8f6 | links, "1 Comment", the badge text |
| focused menu item | #f6f6f6 with a 1px focus rectangle (#0078d4 outside, #c7dcef inside) | #323130 | the "New item" row |
| kind: bug | #cc293d | #e05a6a | strip, bug icon |
| kind: task | #f2cb1d | same | (not in the screenshots: the DevOps default) |
| kind: story | #009ccc | same | (not in the screenshots: the DevOps default) |
| state New | #b2b2b2 | same | dots |
| state Active | #1f7acc (#007acc) | #3399e6 | dots |
| state Resolved / Closed | #ff9d00 / #339933 | same | (the DevOps defaults; not measured) |
| history: new value | #dff6dd | #1e3b1e | the after chip |
| history: old value | #eaeaea, struck through | #3b3a39 | the before chip |
| history arrow | #2b88d8 | #479ef5 | State Graph |
| avatar with initials | #0078d4 with white "HS" (ours: invented initials) | same | History rows |

**Shadows (Fluent depths):**
- Dialog: `0 25.6px 57.6px rgba(0,0,0,.22), 0 4.8px 14.4px rgba(0,0,0,.18)`. Measured: about 45px of soft shade above, and a dark band of about 16px below.
- Callouts (menus, the picker's list): `0 3.2px 7.2px rgba(0,0,0,.132), 0 .6px 1.8px rgba(0,0,0,.108)`.
- Cards (comment cards, the Markdown edit card): `0 1.6px 3.6px rgba(0,0,0,.132), 0 .3px .9px rgba(0,0,0,.108)`.

**Corners:**
- Dialog: 4px. The strip follows the dialog's top-start corner.
- Cards and callouts: 4px.
- Buttons and boxes: 2px.
- Pills: round.

### 2.3 The dialog

| What | Measure |
|---|---|
| Size **`inset`** | 96px from the window's inline edges and 46px from its top and bottom. Measured: x 96–1823 in a 1920px window, y 46–936 in a 983px one. Under 760px wide it fills the window. |
| Backdrop | **None.** The backlog behind is not dimmed: the left nav measures #e9e9e9 behind the dialog and #eaeaea without it. Clicks outside do nothing. |
| Window buttons | ⤢ Maximise centred at (1768,218) `(right−55,+21)`, × Close at (1803,218) `(right−20,+21)`. Icons 16px #333 in 32×32 hit areas. ⤢ toggles to Restore. |
| Resize grip | ◢ at the end-bottom corner (1815,1027). Drag to resize. Keyboard: the grip is focusable, and the arrow keys resize by 16px. |
| Scrolling | The head (strip, title, rows, band, tabs) stays put. Only the body scrolls, and the scrollbar is inside it (track x 1809–1823 when shown). |

### 2.4 The head — white part (y 197–318, 122px tall)

| Element | Measure (absolute, then dialog-relative) | Behaviour |
|---|---|---|
| Type strip | x 96–105 (10px wide, #cc293d), y 197–318: the whole white part, stopping at the band. It runs along the start edge and takes the dialog's corner. | Colour by the kind field's value. |
| Badge | Bug icon 12×12 at x 116 `(+20)`. "BUG 5140" (ours "BUG 4127") at x 135 `(+39)`, centre y 218 `(+21)`, 12px, link colour; the icon is in the kind colour. | Words = the kind's label, upper-cased with `toLocaleUpperCase(locale)`, then a space and the number. Not focusable. |
| Title line | Number "4127" at x 115 `(+19)`, centre y 256 `(+59)`, 18px. Title box x 160 `(+64)` to 1781 `(right−42)`, 32px tall (y 240–272), text 12px in (x 173). | At rest: words only, no edge. Pointed at or focused: a 1px #7e7e7e edge (accent on focus) and a **Copy title** button (#f2f2f2, x 1782–1815, 34px wide, copy icon) at its end. The quiet look applies. |
| Meta row, start | Centre y 296 `(+99)`:<br>• Assignee: person-outline icon x 129–138 `(+33)` and "No one selected" at x 150 `(+54)`, 14px muted.<br>• Comment icon x 392 `(+296)` and "1 Comment" at x 410, link colour 14px.<br>• "Add Tag" button x 491–547 `(+395..+451)`, y 288–306 (19px), #f2f2f2, 14px/600, #191919. | The assignee is a people picker with an avatar once set. "1 Comment" takes you to the Discussion group (scroll it into view, focus the comment box). "Add Tag" turns into a tag box. |
| Meta row, end | All 32px tall, y 281–312:<br>• **Save and Close** split: x 1360–1544 (main part 154px, divider #e8e8e8 at 1514, chevron part 30px), save icon, #f2f2f2.<br>• **Follow** split: x 1555–1685 (eye icon and "Follow" 14px/600 #191919, divider #d2d2d2 at 1651, gear part 34px).<br>• Refresh centred at 1712 `(right−111)`.<br>• Undo at 1757 `(right−66)`.<br>• ⋮ at 1800 `(right−23)`.<br>Icon buttons are 32×32 with no fill and #4a4a4a icons. | Save and Close: save then close. Its chevron opens a menu holding "Save". It is **primary (accent fill, white words) while the record has changes**, and subtle but usable otherwise. Follow toggles to "Following"; its gear opens notification choices. Refresh reloads. Undo puts back every change. ⋮ is the record's menu. |

### 2.5 The head — the band (y 319–396, 78px tall, `band` #f8f8f8)

| Element | Measure | Behaviour |
|---|---|---|
| Row 1 | Centre y 342 `(+145)`; boxes y 326–357 | |
| Row 2 | Centre y 375 `(+178)`; boxes y 359–390 | |
| Column 1 | Labels at x 112 `(+16)`, 12px muted; label track 76px (x 112–188). **Lead icon** (State's dot, Reason's lock) centred at x 176 `(+80)`, in the last 24px of the label track. Value box x 188–386 `(+92..+290)`, text at x 200 `(+104)`. | The dot is 10px, #1f7acc for Active. The lock is 12px, #666. A locked value's words are muted (#a3a3a3). |
| Column 2 | Labels at x 394 `(+298)`; label track 76px. Value box x 470 `(+374)` to 1577 (it fills to the tabs), text at x 482. | Area and Iteration are path pickers (§2.9). |
| Access keys | "Stat**e**", "**A**rea", "Ite**r**ation" have that letter underlined (1px). Reason has none. | Alt+letter focuses the field. |
| Updated by | "Updated by Heba Said: Aug 25" (ours "Updated by Mona Adel: Aug 25"), 12px muted, right edge at x 1815 `(right−8)`, centre y 331 `(+134)`. | A press shows the History tab. |
| Tabs | A group framed in #dadada, x 1586–1815 `(right−237..right−8)`, y 361–396 (36px; open at the bottom, meeting the body).<br>• **Details** x 1587–1649 (63px): 14px/600 when selected, with a 2px accent underline under its words at y 391–392.<br>• **History** x 1652–1689 (38px): icon only.<br>• **Links** x 1692–1752: link icon and a count pill "0" (#ebebeb, about 25×19, 12px/600).<br>• **Attachments** x 1755–1814: paperclip icon and pill "1".<br>Dividers 1px #dadada. | Arrow keys move between tabs (flipped right to left). The selected tab's background meets the white body. |

### 2.6 The body — Details tab (from y 397, white)

| Element | Measure |
|---|---|
| Padding | 12px at both inline ends (x 108 → 1811, or 1796 with the scrollbar) |
| Columns | `grid-template-columns: 50% 1fr 1fr; column-gap: 16px`. Measured: 852 / 410 / 410 with a 16px gap in a 1704px body, and 845 / 406 / 406 when the scrollbar takes 15px. |
| Left column | Repro Steps (html, Markdown), System Info (html, rich), Discussion (comments) |
| Middle column | Planning (Category, Resolved Reason 🔒, Story Points, Priority, Severity, Activity); Effort (Hours) (Original Estimate, Remaining, Completed) |
| Right column | Deployment (help box), Development (Add link, help box with an icon), Related Work (Add link ▾, empty box with a link), System Info (Found in Build, Integrated in Build) |
| Group heading block | 50px: title centre at +25 (y 422) at the column's start, 16px/600. A 1px #eaeaea rule at +50 (y 447) across the full column. Tools at the heading's end, 32px apart (⤢ at x 867/901, ^ at 901/935, ✎/✓ at 935 in the left column). |
| Group spacing | 12px between a group's last content and the next heading block |
| Fields in a group | Inset 8px from the heading start. Label 12px muted on a 16px line, then the value box (32px tall, words 6–7px in), then 7px: **55px from one label to the next**. An empty field shows nothing at rest (no "Add …" hint). A locked one shows only the lock (x 983, y 538). |
| Repro Steps at rest | The rendered Markdown: a link at x 128, y 465, link colour, underlined, followed by an external-link icon (#595959). It opens in a new tab. |
| System Info at rest / pointed at / focused | At rest: "Click to add System Info." italic muted at x 124, y 584. Pointed at: a 1px #eaeaea box x 118–942, y 569–618 (50px; inset 10px from the column). Focused: a 1px accent box growing to y 569–692, with the toolbar row inside at its bottom (centre y 671) and "switch to Markdown editor" under it at the end (y 704). |
| Repro Steps in Markdown edit (20.21.54) | A card with depth-4 shadow, x 108–953, y 464–645. Inside it:<br>• a text box x 124–936, y 484–567 (84px, 1px #eaeaea, 4px corners);<br>• the hint row y 583: "ⓘ **Markdown supported.** Paste or select files to insert." ("Markdown supported." in link colour);<br>• the toolbar row y 609: @ # pull-request 📎 highlight heading▾ B I </> link • 1. ☑;<br>• at its end the **Preview** switch (40×20, #7e7e7e edge) and "Preview" 14px.<br>Heading tools ⤢ ^ ✓. |
| Rich toolbar order (20.22.28) | B I U • 1. highlight▾ colour▾ 🙂 outdent indent ~~S~~ size▾ </> @ # pull-request clear-format image link remove-link. In the comment box, the overflow goes to "…" when narrow. |
| Discussion | Heading y 672, rule y 697.<br>**Composer card**: depth-4, x 108–953, y 714–874. Avatar 24px round at x 132 `(card+24)`, centre y 753. Box x 168–932, y 744–837 (94px, 1px #eaeaea; accent when focused). Placeholder italic muted. "switch to Markdown editor" right-aligned to x 932, y 848.<br>**Focused**: the toolbar inside the box (y 816), Cancel x 795–866 and Save x 874–932 (31px tall, #f2f2f2, 14px/600) under it at y 863–893.<br>**Comment cards**, 16px apart: card y 891–1000. Avatar at x 132, centre y 930. Author "Ramy Othman" (ours invented) at x 168, 14px/600 muted. "commented Jun 14" 12px muted underlined, a link to the comment. Body text at x 168, y 966, 14px. |
| Deployment box | `help` #f4f4f4, x 1399–1788 (inset 8px from both column edges), y 452–556. Words start at x 1449 (50px: room for an icon), 14px on a 17px line, about 10px vertical padding. Links in link colour, underlined. |
| Development | "Add link" text button at x 1399, y 791-equivalent (words at x 1412, 14px/600 #1a1a1a, 31px tall). Help box y 654–724 with a 28×30 icon at x 1410 and words at x 1449. **Our icon is the generic `branch` icon in a neutral colour, never the DevOps one.** |
| Related Work | "Add link ▾" (words at x 1412, chevron at 1483). Box y 822–858 with the link "Add an existing work item as a parent" at x 1409. |
| Right-hand System Info | Labels "Found in Build" (y 932) and "Integrated in Build" (y 987); values empty |

### 2.7 Menus (20.23.03, 20.20.45)

- **"Add link ▾" menu**:
  - The callout's end edge lines up with the button's end edge: button x 1399–1500, menu x 1278–1500 (223px), y 822–899.
  - Rows are 31px: "Existing item" (link icon), then "New item" (pencil icon). Icons 16px at the row start plus 14px; words at plus 42px.
  - The focused row is #f6f6f6 with a focus rectangle.
  - While open, the button shows the pressed fill #d2d2d2.
- **State list**:
  - Callout x 188–386 (it starts at the value box's start; 199px wide), y 357–494, about 8px padding.
  - Rows are 30px: New, Active, Resolved, Closed.
  - The chosen row gets ✓ at x 200, words at x 214, row background #deecf9, and a focus rectangle around the words cell (x 214–365).
  - **No dots in the list**: the dot stays before the value.

### 2.8 History tab (20.24.46)

- **State Graph** (heading y 422, rule 447, tools ⤢ ^):
  - Transitions run left to right. Each arrow is about 84px plus its head, with an 8px shaft #2b88d8 (y 485–492).
  - The reason sits above the arrow, 12px muted ("New", "Approved", "Investigation Complete").
  - Below the arrow: a 16px avatar, the name and the date ("Jun 10"), 12px muted, on two lines.
  - Between arrows sit state chips: #deecf9, 33px tall, an 8px dot, the state name 14px #000, and about 8px padding.
  - The graph wraps when it runs out of room.
- **History** (heading y 555, rule 580; filter icon at the heading's end):
  - The list pane runs x 108–940 and scrolls on its own. Its group header ("⌄ Older") is #f8f8f8, 33px tall, chevron and 14px words.
  - Rows are 51px, divided by #eaeaea. Each row has:
    - a 32px avatar at x 118;
    - the summary at x 158, 14px, in one of these forms: "X changed Stack Rank to 1999964430", "X changed Iteration Path to Pams\Tickets shotec", or "X changed State from ● New to ● Active and made field changes" (with dots inline);
    - the date right-aligned at x 940, 12px muted ("8/25/2026").
  - The selected row is #eaeaea. A row whose change includes a State change shows a 10px state-coloured dot at its end (x 929).
  - A 1px #9e9e9e divider at x 958.
- **Detail pane** (x 959–1812):
  - Header y 585–640: a 40px avatar, the name 14px/600, the summary 14px, and the date at the end "Wed 7/22/2026 12:59 PM" in 12px muted. A rule at y 641.
  - Below it, each field change: the label at x 976 (14px); the new value as a chip #dff6dd (25px tall, padding 8px); then the old value as a #eaeaea chip, struck through.

### 2.9 Path pickers (20.20.45 Area, 20.24.05 Iteration)

- **The box**:
  - At rest: words only, at x 482.
  - Pointed at: a 1px #7e7e7e edge and a chevron (⌄) at the end (x 1559).
  - Open: the edge is accent and the box is typed into (x 470–1577, 32px).
- **The callout**:
  - It sits right under the box, **as wide as the box** (x 470–1577), with callout shadow.
  - It is at most 268px tall (y 398–666) and scrolls with a thin scrollbar.
- **Suggestions**:
  - The heading "Suggestions" is 14px/600 at x 513 (the box start plus 43).
  - Rows are 25–26px, words at x 513. The aside (the dates) is right-aligned to x 1542, 14px.
  - The current value is highlighted with #deecf9 and a focus rectangle. With an aside, there are two rectangles: name cell x 478–1195 and aside cell x 1197–1553.
- **Divider**: 1px #eaeaea, x 490–1565.
- **Tree**:
  - The root shows "⌄ Pams" (ours "⌄ Portal"): chevron at x 497, words at x 513.
  - Children are indented 16px (words at x 529), each with its aside.
  - In the Area picker the root has no children, so no chevron.

### 2.10 The backlog (08_18_PM)

This is the demo app's page behind the dialog. 2044px wide at capture.

**The app's own chrome** (demo HTML, no Fieldia):
- A top bar 48px tall, white, holding:
  - a breadcrumb "Harbor Supply / Portal / Boards / Backlogs";
  - a search box at the end;
  - an avatar.
- A left nav 255px wide (#eaeaea; the selected item #dcdcdc) with a project tile "P Portal" and generic items: Overview, Boards (Work items, Boards, Backlogs, Sprints, Queries, Delivery Plans, Analytics views), Code, Builds, Tests, Packages, and "Project settings" at the foot.
- A page header on #f8f8f8:
  - "Portal Team ▾" (20px/600), ☆, a team icon;
  - the buttons "+ New Work Item", "View as Board", "Column Options" (#f2f2f2, 14px/600, 32px) and ⋮;
  - the pivots "Backlog" (selected: 2px accent underline) and "Analytics";
  - at the end: "Stories ▾", view options, filter, settings and full screen.

**Fieldia's list:**
- **Filter bar card**:
  - White, callout shadow, 4px corners, 45px tall (y 176–221).
  - "⫶ Filter by keyword" at the start, muted.
  - At the end, a dropdown per field: "Bug ▾", "Active ▾" (14px/600 #1a1a1a while values are picked), and "Area ▾", "Iteration ▾", "Tags ▾" (14px muted with nothing picked).
  - Then a gear and ×.
- **Table card**: white, 4px corners.
  - Header row, 12px/600 muted, 1px #eaeaea column separators: [+][−] (expand / collapse all, 24px boxes), Order, W… (Work Item Type, cut with an ellipsis), Title, State, Story … (cut), Value Area, Iteration Path, Tags.
  - Rows are 35px, 14px #1a1a1a.
  - Order is right-aligned. Type is "Bug". The title has the bug icon (12px, kind colour) before it. The state has its 8px dot before its words.

---

## 3. Every element, against Fieldia today

Mapping legend: **✓ exists as is**, **◐ exists, needs an option**, **✗ missing**. The code is in `libs/`.

| # | Element | Today | Where it lives | Lane |
|---|---|---|---|---|
| 1 | Dialog of size `inset`, no backdrop dim, a shadow | ◐ `openFormDialog` sizes small/medium/large/full; always a dim backdrop | `viewer/dialog.ts`, `widgets/styles.ts` (.fd-form-dialog) | wi-header |
| 2 | Maximise / restore, resize grip | ✗ | dialog.ts | wi-header |
| 3 | The dialog's own head bar and foot replaced by the page's record head | ✗ (the dialog always draws title + × and Discard / Save & Close) | dialog.ts | wi-header |
| 4 | Type strip and badge from a kind field | ✗ (sheet `badges`, `ribbons` are different) | `core/format/layout.ts` SheetNode; `viewer/viewer.ts` sheetLayout | wi-header |
| 5 | Number before the title | ◐ `title.before` takes field nodes | viewer.ts sheetLayout | wi-header (look), wi-demo (page) |
| 6 | Title edited in place, quiet, Copy title | ◐ the title is a field and the quiet skin applies; ✗ copy | viewer.ts | wi-header |
| 7 | Meta row: assignee, comment count link, tags | ◐ `title.below` takes field nodes; ✗ count link | layout.ts, viewer.ts | wi-header (row, link); wi-picker (assignee and tags widgets) |
| 8 | "No one selected" with a person icon, a picture once set | ◐ many2one `avatar: true` | `widgets/relations.ts` | wi-picker |
| 9 | "Add Tag" button that opens the tag box | ✗ (tags always show a box) | relations.ts (tagsWidget, charTagsWidget) | wi-picker |
| 10 | Split button (Save and Close ▾, Follow ⚙), toggle button, icon-only button, primary while changed | ✗ (ButtonNode: label, steps, style, icon, hotkey) | layout.ts ButtonNode; viewer.ts buttonItem | wi-header |
| 11 | Refresh / Undo-all / Save / Close as steps | ✓ steps `reload`, `reset`, `save`, `close` | core/format/actions.ts | (used by wi-demo) |
| 12 | ⋮ record menu | ◐ `toolbar.menu` drawn as a gear with words | `viewer/record-bar.ts` | wi-header |
| 13 | Values the server keeps written without counting as changes (Follow's state, the comment count) | ✗ | `core/record/form.ts`, `run.ts` ActionResult | wi-header |
| 14 | Band of header fields, labels beside, 76px label track, lead icon in the track | ◐ sections with `labels: beside`, `labelWidth` (60–320); ✗ band, lead slot | layout.ts, viewer.ts | wi-header |
| 15 | Lock at the value's start instead of by the label | ✗ (lock by the label) | viewer.ts fieldItem, `widgets/styles-quiet.ts` | wi-header |
| 16 | Access key underlined in a label, Alt+letter focuses the field | ✗ for fields (buttons have `hotkey`) | layout.ts FieldNode, viewer.ts | wi-header |
| 17 | "Updated by X: date", a press shows History | ✗ | viewer.ts | wi-header |
| 18 | Tabs in the head band, icon-only tabs, count pills | ◐ TabsNode/TabNode (label, icon) | layout.ts, viewer.ts tabsItem, tab-strip.ts | wi-header |
| 19 | State with a coloured dot before the value | ◐ `selection.dot` (`options.label`, `tones`) | `widgets/state-dot.ts` | wi-picker |
| 20 | State list: ✓ on the chosen value, no dots, Fluent callout | ◐ the dot menu has dots and aria-checked | state-dot.ts | wi-picker |
| 21 | Exact state colours by value | ✗ (tones only) | state-dot.ts | wi-picker |
| 22 | Selection list of Fieldia's own (Priority, Severity, Activity) | ✗ (native `<select>`) | `widgets/widgets.ts` selectWidget | wi-picker |
| 23 | Path picker: "A\B", Suggestions, a tree folded to the branch, right-aligned aside, tree keys | ✗ (flat combobox, `details` lines under the name) | relations.ts combobox; `core/record/values.ts` RelatedRecord; memory-data-source.ts | wi-picker |
| 24 | Group heading look (16px/600, rule), fold control at the heading's end, ⤢ maximise | ◐ `style: line`, `collapsible` (chevron before the title) | viewer.ts sectionItem | wi-text |
| 25 | Columns 50% / 1fr / 1fr, 16px gap | ✗ (even columns or twelfths, the skin's gap) | layout.ts SectionNode, viewer.ts grid | wi-text |
| 26 | Rich text "Click to add …" at rest, a box on hover, toolbar only on focus, at its bottom, the full tool set | ◐ html widget: toolbar always on top, 10 tools | `widgets/extras.ts` | wi-text |
| 27 | Markdown editing with hint, toolbar and Preview; switch between rich and Markdown | ✗ | extras.ts | wi-text |
| 28 | A field's tools in its group's heading (✎ / ✓) | ✗ | viewer.ts, widgets.ts Widget | wi-text |
| 29 | Rendered links with an external icon, opening in a new tab | ✗ | extras.ts | wi-text |
| 30 | Discussion inside a column: composer card with avatar and hint, editor on focus, Cancel and Save; comment cards | ◐ the chatter is a slot placeable anywhere; its look is Odoo's (Send message / Log note bar) | `chatter/chatter.ts`, slot.ts | wi-text |
| 31 | Mentions (@), record links (#, !) | ◐ chatter @mentions in a textarea | `chatter/mentions.ts`, extras.ts | wi-text |
| 32 | "Add link" / "Add link ▾" with Existing item / New item, help box with an icon, empty-state link | ✗ (many2many tags or table) | relations.ts / a new widget | wi-text |
| 33 | Help box (Deployment) with links in its words | ◐ TextNode `style: note/alert`, plain words | layout.ts TextNode, viewer.ts | wi-text |
| 34 | History tab: State Graph, change list grouped by age, before/after | ◐ the chatter lists tracked changes as "Label: from → to" | chatter | wi-history |
| 35 | Backlog list: no checkbox column, cell widgets (dot, kind icon), filter bar by field, expand / collapse all, column separators | ◐ list: checkbox always, text cells, Odoo search bar | `viewer/list.ts`, search-bar.ts, list-styles.ts | wi-demo |
| 36 | Empty quiet fields show nothing at rest | ✗ (quiet hint "Add …" always) | viewer.ts fieldItem | wi-demo |
| 37 | Tokens `link`, `band`, `help` | ✗ | `viewer/look.ts` TOKEN_NAMES | wi-demo |
| 38 | The demo app: backlog shell, the list page, the bug page, data, opening the dialog from a row, `?workitem=` | ✗ | demos/ | wi-demo |

---

## 4. Lanes and what each may touch

Five lanes are built in parallel from main (0.19.0), one worktree each, and the join merges them.

**How to keep the merges clean:**
- Put new code in **new files**.
- Touch a shared file only at the **anchor** named below, inserting your lines **after** the anchor line.
- When two lanes need the same thing, one lane owns it, and the other writes against the contract below.

### 4.1 Shared files and their anchors

| File | wi-header | wi-picker | wi-text | wi-history | wi-demo |
|---|---|---|---|---|---|
| `core/format/layout.ts` | SheetNode `head`; new `SheetHead`, `SheetKind`, `HeadLink`, `HeadBand`; ButtonNode keys; TabNode/TabsNode keys; FieldNode `hotkey` | — | SectionNode keys; TextNode keys | — | ListNode keys and `ListCell` |
| `core/format/page.ts` (PageLook and its schema) | `lockAt`, after `helpShown` | — | — | — | `quietHints`, after `readonlyShown` |
| `core/record/values.ts` RelatedRecord | — | `path`, `aside` | — | — | — |
| `core/record/form.ts`, `run.ts` | `setValues(values, { stored })`, `ActionResult.stored` | — | — | — | — |
| `core/record/memory-data-source.ts` | — | `shows[model].path / aside` | — | — | — |
| `core/format/references.ts` (page checks) | one call `checkHead(...)` after the sheet checks | — | one call `checkSectionTracks(...)` after the section checks | — | one call `checkListCells(...)` after the list checks |
| `viewer/viewer.ts` | hook in `sheetLayout`, `tabsItem` (`place: head`), `fieldItem` label (hotkey, lock at value); new file `record-head.ts` | — | hook in `sectionItem` (heading tools, fold at end, ⤢, tracks, gap) and `textItem` (help); new file `section-head.ts` | — | — |
| `viewer/dialog.ts` | ✔ (owner) | — | — | — | — |
| `viewer/record-bar.ts` | ✔ (⋮ in the head) | — | — | — | — |
| `viewer/list.ts`, `search-bar.ts`, `list-styles.ts` | — | — | — | — | ✔ (owner) |
| `viewer/look.ts` TOKEN_NAMES | — | — | — | — | `link`, `band`, `help` (CSS elsewhere reads `var(--fd-link, var(--fd-accent))`, `var(--fd-band, var(--fd-page))`, `var(--fd-help, var(--fd-fill))`, so every lane works before the join) |
| `viewer/labels.ts` and `locales/{ar,de,fr}.ts` | after `close` | — | — | — | after `loadMore` |
| `widgets/labels.ts` and `locales/{ar,de,fr}.ts` | — | after `searchMore` | after `removeLink` | — | — |
| `chatter/labels.ts` | — | — | after `couldNotSend` | after `conversation` | — |
| `widgets/relations.ts`, `state-dot.ts`, `widgets.ts` selectWidget, `popup.ts` | — | ✔ (owner) | `widgets.ts`: only the `Widget` interface (`tools?`) and one registry line `'many2many.links'` after `'many2many.table'` | — | — |
| `widgets/extras.ts` | — | — | ✔ (owner) | — | — |
| `widgets/styles*.ts` | dialog and head CSS in a new `styles-head.ts`, included once | picker CSS in `styles-picker.ts` | text CSS in `styles-text.ts` | — | list CSS stays in `viewer/list-styles.ts` |
| `widgets/icons.ts` | **every lane that needs a new icon** adds the shared file (§4.2) byte for byte and the same two lines | (same) | (same) | (same) | (same) |
| `chatter/chatter.ts`, `slot.ts`, `source.ts` | — | — | ✔ (discussion look, `me`, `onCount`) | new file `history.ts` and an export line in `index.ts` | — |
| `demos/shared/sample-data.ts` | import after `import { customPage } …`; page entry after `'quick-order': …`; records spread after `...READING,` | import after `import { real } …`; page after `'map-address': …`; records after `home: linkedHomes(…),`; `shows` line | import after `import { templatePages } …`; page after `'map-homes': …`; records after `'food.order': …` | import after `import { sampleKitchen, … } …`; page after `'map-round': …`; records after `'shop.order': …` | — (its data is its own: `demos/backlog/`) |
| `demos/plain/main.ts` | `?open=dialog`: after `opened();` it opens the page in `openFormDialog({ size: 'inset', backdrop: 'clear', maximise: true, resizable: true })` | — | slot `discussion:` after the `chatter:` line | slot `history:` after the `note:` block | — |
| `tools/build-demos.mjs` | — | — | — | — | add `'backlog'` to `variants` |
| `demos/catalog.mjs` | — | — | — | — | new entry `backlog` (§6.6) |
| designer | head panels in new files; one hook each in the sheet panel / canvas-header | kind settings for the new widget options | section and text panels, html and links widget settings | — | list panels, the look panel's "Empty quiet fields" |

Each lane tests on **its own small page and model** (`wi.head`, `wi.picker`, `wi.text`, `wi.history`), registered in `demos/shared/sample-data.ts` at its anchors, with its own data and chatter in new files (`demos/shared/wi-<lane>.ts`). Lanes never edit `sample-chatter.ts`: wi-text and wi-history each make their own memory chatter in their own file.

### 4.2 The shared icon file (identical in every lane that adds it)

Create `libs/widgets/src/lib/icons-work.ts` with **exactly** this content. If two lanes add the identical file, the merge sees it as one change.

```ts
import type { IconSet } from './icons';

/**
 * Icons a work item's screen needs, drawn as Fieldia draws icons: the inside
 * of a 24×24 SVG in lines of the text colour.
 */
export const WORK_ICONS: IconSet = {
  attach: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 4-5 4-11 8.5"/>',
  bug: '<path d="M9 7.5a3 3 0 0 1 6 0"/><rect x="6.5" y="7.5" width="11" height="13" rx="5.5"/><path d="M12 11v9.5M6.5 12.5H3M21 12.5h-3.5M6.8 17l-2.8 2M17.2 17l2.8 2M8 8.5L5.5 6M16 8.5L18.5 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.01M15 9.5v.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  hash: '<path d="M10 3L8 21M16 3l-2 18M4 8.5h16M3.5 15.5h16"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5V9H9M12 8v4.5l3 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4.5 4.5 3-3L21 18"/><circle cx="15.5" cy="9.5" r="1.5"/>',
  maximise: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
  mention: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 8.5V13a2.5 2.5 0 0 0 5 0v-1a8.5 8.5 0 1 0-3.4 6.8"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  'pull-request': '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17v-8a3 3 0 0 0-3-3h-3.5M13.5 3.5L11 6l2.5 2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>',
  restore: '<path d="M19 5l-5 5M14 6v4h4M5 19l5-5M10 18v-4H6"/>',
  save: '<path d="M5 4h11.5L20 7.5V20H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  story: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19"/>',
  task: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 12.5l2 2 4-4"/>',
  undo: '<path d="M9 6L4.5 10.5 9 15"/><path d="M4.5 10.5H15a5 5 0 0 1 0 10h-3"/>',
};
```

In `libs/widgets/src/lib/icons.ts`, make exactly two edits:
1. Add the line `import { WORK_ICONS } from './icons-work';` directly above `export type IconSet = …`.
2. Add the line `  ...WORK_ICONS,` directly after the `thumb: …` line inside `ICONS`.

The type-only import breaks the cycle. The existing names `edit` (pencil), `link`, `user`, `lock`, `chat`, `check`, `filter` and `info` are reused as they are.

---

## 5. The API contract

The names follow the format's own style: data as nouns, `…Field` for a field name, `Modifier` for a condition, `tone`/`colour` as `#rrggbb`, words that a page's `translations` reach. Every new key is optional and validated with zod (`strictObject`). Each gets a spec test (valid, invalid, and its reference checks), its docs comment in plain words, and its entry in `layout.types.ts` (the type proofs).

### 5.1 wi-header

```ts
// layout.ts — SheetNode gains:
/** A record's head drawn as a work item's: its kind's strip and badge, the title line, a row of people and actions, a band of fields, and the tabs. When given, the classic header bar, `statusbar`, `badges` and stat buttons are not drawn above it. */
head?: SheetHead;

export interface SheetHead {
  /** The record's kind: a strip of its colour along the head's start edge, and a badge — its icon, its name in capitals and the record's number — over the title. */
  kind?: SheetKind;
  /** The row under the title, from its start: fields (their labels hidden and read out) and links such as "1 Comment". */
  meta?: (FieldNode | HeadLink)[];
  /** The row's end: the record's buttons, as Save and Close, Follow, Refresh and Undo; the menu (`toolbar.menu`) last, as ⋮. */
  actions?: ButtonNode[];
  /** Fields on a band under the head, their labels beside them. */
  band?: HeadBand;
  /** "Updated by Mona Adel: Aug 25" at the band's top end; a press shows the tab `opens`. */
  updated?: { byField: string; atField: string; opens?: string };
  /** A Copy title button at the title's end while it is pointed at or focused; on unless false. */
  copyTitle?: boolean;
}

export interface SheetKind {
  /** The field that holds the kind: a selection, or a many2one. Without it, `label` names the one kind. */
  field?: string;
  label?: string;
  /** The record's number in the badge and before the title; the record's id when left out. */
  numberField?: string;
  /** The colour and icon of the kind with no look of its own. */
  colour?: string;            // #rrggbb
  icon?: string;
  /** Each kind's colour and icon, by the field's value. */
  looks?: { [value: string]: { colour: string; icon?: string } };
}

export interface HeadLink {
  type: 'link';
  id: string;
  icon?: string;
  /** A number field: its value leads the words. */
  field: string;
  /** The words after the number, in the plural it needs: { "one": "Comment", "other": "Comments" }. */
  words: PluralWords;
  /** The part it takes the reader to: its tab shown, its group unfolded, scrolled into view, its first box focused. */
  target?: string;
  steps?: ActionStep[];
  invisible?: Modifier;
  roles?: Roles;
}

export interface HeadBand {
  /** Its columns' widths: pixels ("274px"), a share of the row ("50%") or of what is left ("1fr"). Two even columns unless said. */
  tracks?: string[];          // each matches /^\d+(\.\d+)?(px|%|fr)$/; 1 to 4
  /** How wide its labels are, beside their values: 76 unless said. */
  labelWidth?: number;        // 48–320
  children: LayoutNode[];     // fields; each in the quiet look unless it says otherwise
}

// ButtonNode gains:
/** Its icon alone; its label is its name and its tooltip. */
iconOnly?: boolean;
/** A toggle: pressed while this holds (aria-pressed); `pressedLabel` shown and read meanwhile ("Following"). */
pressed?: Modifier;
pressedLabel?: string;
/** More choices beside it, under a chevron: a split button when it has steps or an action, a menu button when it has neither. */
menu?: MenuItem[];
/** The chevron's own icon and name, as Follow's gear: "Notification settings". */
menuIcon?: string;
menuLabel?: string;
/** Primary while the record has changes; quiet but usable otherwise (Save and Close). */
primaryWhenChanged?: boolean;

// TabsNode gains:
/** `head`: its tabs at the end of the record head's band, its panels as the sheet's body. Only for a tabs node directly in a sheet with `head`. */
place?: 'head';
// TabNode gains:
/** Its icon alone; its label is its name and its tooltip. */
iconOnly?: boolean;
/** A field whose count shows in a pill after it: a number's value, a table's or links' lines, a field of files' files. Shown at 0 too. */
count?: string;

// FieldNode gains:
/** A letter of its label: Alt with it focuses the field; the letter is underlined in the label. */
hotkey?: string;              // one letter or digit, as ButtonNode.hotkey (no shift)

// page.ts PageLook gains (after helpShown):
/** Where a field locked by a rule shows its lock: by its label (the default), or at its value's start, as a work item does. */
lockAt?: 'label' | 'value';
```

**Core runtime:**
- `Form.setValues(values, how?: { stored?: boolean })`. With `stored`, the values are written as the record already holds them where it is kept: they are not added to `dirty`, and no change steps run.
- `ActionResult.stored?: Values`, applied that way. The Follow pattern: the app answers `{ stored: { following: true } }`.

**The dialog** (`viewer/dialog.ts`, `FormDialogOptions`):

```ts
size?: 'small' | 'medium' | 'large' | 'full' | 'inset';   // inset: 96px from the window's sides, 46px from its top and bottom; the whole window under 760px
backdrop?: 'dim' | 'clear';                                 // dim unless said
maximise?: boolean;                                         // ⤢ by ×: the whole window, and back (Restore)
resizable?: boolean;                                        // a grip at the end-bottom corner; arrows resize by 16px while it is focused
```

**Behaviour:**
- **When the page's sheet has a `head`**, the dialog draws no title bar and no foot. Its ⤢ and × sit at the end of the badge row. Its name is the badge plus the title (`aria-labelledby`). Escape and × ask "Discard your changes?" when there are changes, as a panel does.
- A head button whose steps saved, and then ran `close`, closes the dialog with `saved: true`.
- On a page (not in a dialog), the head is drawn the same way without ⤢ and ×.
- **Look:** §2.3–2.5. RTL mirrors everything: the strip on the right, the actions at the left, the tabs at the band's left end.
- **Words** (VIEWER_LABELS, after `close`): `maximise` "Maximise", `restoreSize` "Restore", `resize` "Resize", `copyTitle` "Copy title", `titleCopied` "Title copied", `moreActions` "More actions", `updatedBy` "Updated by {name}: {date}", `nothingChanged` "Nothing has changed.", `countOf` "{label}, {count}". Translate them into ar, de and fr.
- **Designer:**
  - A "Record head" group in the sheet's properties: the kind field and its looks (a colour and an icon per value), the number field, the meta parts (add a field or a link), the actions (as buttons), the band's fields with their tracks and label width, and "Updated by" with its two fields and the tab it opens.
  - Button properties: icon only, toggle (`pressed`) with its words, the menu items, primary while changed.
  - Tab properties: icon only and count field.
  - Tabs: in the head.
  - Field properties: the access key.
  - The canvas draws the head as the viewer does: `canvas-header.ts`.

### 5.2 wi-picker

```ts
// core/record/values.ts — RelatedRecord gains:
/** For a record of a tree (an area, an iteration): the names from the top down to it, its own last — ["Portal", "Sprint 14"]. */
path?: string[];
/** Words at the end of its row in a picker, such as an iteration's dates "3/25/2026 - 4/16/2026". */
aside?: string;

// memory-data-source.ts — `shows[model]` gains `path?: string` (a field holding the names, top down) and `aside?: string` (a field whose words go at the row's end).
```

**Widgets** (the options are free-form JSON on the node, documented on the widget):
- **`many2one.path`** — a path picker. Options:
  - `separator` ("\\" unless said);
  - `suggestions` (how many, 5 unless said; 0 for none);
  - `tree` (true unless false).

  It shows the value as its path joined by the separator (else its label). Its list holds:
  - "Suggestions": the current value first, then the person's latest picks of this field, kept in the viewer's `preferences` under `fieldia:recent:<model>`;
  - a divider;
  - the tree, built from each record's `path` (an empty search, up to 500 records), folded to the current value's branch;
  - each row's `aside` right-aligned.

  Typing filters to the matches, shown flat with their full paths. ARIA: a combobox with `aria-haspopup="tree"`; the popup is `role="tree"`, Suggestions is a labelled `group`.

  **Keys:**
  - ↓ / ↑ move.
  - → opens a branch or goes to its first child; ← closes it or goes to its parent. Both flip right to left.
  - Home and End.
  - Enter picks.
  - Escape puts back the value and closes.
  - Tab leaves and keeps the value.

  **Look:** §2.9.
- **`selection` with `options.list: 'own'`** — Fieldia's own list in place of the browser's: a button showing the value, and a callout list with ✓ on the chosen option. Same look as the State list (§2.7). Keys: ↓↑ Home End Enter Escape, and type-ahead.
- **`selection.dot`** gains:
  - `options.colours: { [value]: '#rrggbb' }`: exact colours, which win over `tones`;
  - `options.listDots: false`: the list shows ✓ only, no dots.

  In a band, its dot sits in the lead slot (§2.5).
- **`many2many.tags` / `char.tags`** gain `options.adder: 'button'`. Chips, then an "Add Tag" button (its words are the node's `placeholder`, else the `addNamed` "Add {label}"). The button is #f2f2f2, 14px/600, 19px tall. A press turns it into the tag box with its suggestions. Enter adds a tag; Escape and leaving with nothing typed bring the button back.
- **`many2one` with `options.avatar: true`**, empty, in the quiet look: the `user` icon (outline) and the placeholder words, muted ("No one selected"). Once set: its picture (or initials) and its name.
- **Words** (WIDGET_LABELS, after `searchMore`): `suggestions` "Suggestions", `expandNamed` "Expand {name}", `collapseNamed` "Collapse {name}", `addNamed` "Add {label}". Translate them into ar, de and fr.
- **Designer:** in the field's kind settings — path (separator, suggestions, tree), own list, list dots and colours per option, the tags' Add button.

### 5.3 wi-text

```ts
// layout.ts — SectionNode gains:
/** Its columns' widths when not even: pixels, a share of the row ("50%") or of what is left ("1fr"); one per column. */
tracks?: string[];            // /^\d+(\.\d+)?(px|%|fr)$/, length = its columns
/** Room between its columns, in pixels: the skin's unless said. */
gap?: number;                 // 0–48
/** Where its fold control sits: before the title (the default), or at the heading's end as ^ and ⌄. */
foldAt?: 'start' | 'end';
/** A ⤢ at its heading's end that shows the group alone over the record's body, until pressed again or Escape. */
maximise?: boolean;

// TextNode gains:
/** `help`: a light box (the `help` token) with room for an icon at its start, as a work item's Deployment note. */
style?: 'heading' | 'paragraph' | 'note' | 'alert' | 'help';
icon?: string;
// TextNode.text: `[words](https://…)` becomes a link (http, https and mailto only; opens in a new tab), in every style.
```

- **Group heading** (sectionItem, in a new file `section-head.ts`):
  - The title is 16px/600 with a #eaeaea rule at +50 (§2.6).
  - The tools at the end, in this order: a field's own tools (below), then ⤢, then ^/⌄.
  - The tools show while the group is pointed at or has the focus, and always while the group is folded or where no pointer can hover.
  - Each tool is a named button: "Maximise Repro Steps", "Collapse Repro Steps", "Expand Effort (Hours)".
- **A field's heading tools:**
  - The `Widget` interface gains `tools?: HTMLElement[]`.
  - When a section holds one field whose label is hidden, the viewer puts that field's tools into the section's heading.
  - Example: an html field in Markdown gives Edit (✎) at rest and Done (✓) while editing.
- **`html` widget options** (extras.ts):
  - `toolbar: 'always' | 'focus' | 'never'` (the boolean `true` and `false` keep working). With `focus`, there is no toolbar and no edge at rest; pointing at it shows a 1px `border` box; focus shows an accent box with the toolbar inside it.
  - `toolbarAt: 'top' | 'bottom'`.
  - `tools: string[]`, chosen from: `bold, italic, underline, bulletList, numberList, highlight, colour, emoji, outdent, indent, strike, size, code, mention, reference, clearFormatting, image, link, unlink, taskList, heading, attach`. Each tool is named and has a tooltip. The arrow keys move along the bar. Tools that do not fit go under "…" (a menu).
  - `editor: 'rich' | 'markdown'`: how it is edited.
  - `switchEditor: true`: a link under the box, "switch to Markdown editor" / "switch to rich text editor".
  - `references: [{ key: '#', model: 'work.item', label: 'Work item', icon: 'hash' }, { key: '!', model: 'pull.request', label: 'Pull request', icon: 'pull-request' }]`, searched with `form.search(field, query, limit, { model })`.
  - `mention: { model: 'res.users' }`.
- **Markdown editor:**
  - The value is still stored as clean HTML: the Markdown is converted on change, and the HTML is converted back to Markdown to edit it.
  - It supports a CommonMark subset: paragraphs, line breaks, bold, italic, `code`, fences, links, autolinks, headings 1–3, `-`/`*` lists, `1.` lists, `- [ ]` task lists and `>` quotes. Raw HTML is escaped.
  - Switching to Markdown when the HTML has formatting that Markdown cannot hold asks first (`formattingLost`).
  - **Look** (20.21.54): a card, a text box, the hint "ⓘ Markdown supported. Paste or select files to insert.", the toolbar, and a **Preview** switch (`role="switch"`) that renders in place of the text box.
  - At rest it shows the rendered HTML. A click on the words (not on a link), Enter on the focused field, or ✎ starts editing. ✓ keeps the changes; Escape puts back what the field held.
- **`sanitizeHtml`** additionally keeps:
  - `S`;
  - `IMG` with `src` of `https:` or `data:image/(png|jpeg|gif|webp);base64,` and an `alt`;
  - `SPAN` with only `color`, `background-color` (hex or rgb) and `font-size` from 12/14/16/20/28px;
  - `data-mention`, `data-record` and `data-model` with safe values.

  External links get `target="_blank" rel="noopener"` and the `external` icon after them when drawn.
- **Discussion** (`chatterSlot({ …, look: 'discussion', me, placeholder, references, onCount })`):
  - A composer card at the top (§2.6): the `me` avatar, then a box showing the placeholder. On focus it becomes the shared rich editor (`formattedText(doc, options)`, in widgets' text part: `(await textPart.load()).formattedText`) with "switch to Markdown editor", Cancel and Save.
  - Ctrl+Enter saves. Escape cancels, asking first if words were typed.
  - Then a card per comment (kind `message`), newest first: avatar, author, "commented {date}" (a link to `#comment-<id>`), and the body.
  - Events (tracked changes) are **not** shown here: they belong to History.
  - No Send message / Log note bar, no followers, no activities.
  - `ChatterOptions.me?: Person`.
  - `onCount?(count: number, form: Form)` is called after every load and post. The demo writes `form.setValues({ comment_count: n }, { stored: true })` with it after the join.
- **`many2many.links` widget** (a new file; registered after `'many2many.table'`):
  - Options:
    - `add: 'menu' | 'search'`: "Add link ▾" with Existing item / New item, or "Add link" that searches at once;
    - `addLabel` (default "Add link");
    - `help`: words in the box while it is empty, with `[words](url)` links;
    - `helpIcon`;
    - `emptyLink`: words of a link in the empty box that runs Existing item ("Add an existing work item as a parent").
  - Existing item: `dialogs.searchMore`. New item: `dialogs.openRecord(relation)`.
  - Each linked record is a row: its name as a link (opens it), and × to remove it.
  - The menu has the menu pattern (↓↑, Escape, Tab) and the look of §2.7.
- **Words** (WIDGET_LABELS, after `removeLink`): `strike`, `highlight`, `textColour`, `emoji`, `indent`, `outdent`, `textSize`, `code`, `mention`, `linkRecordNamed` "Link {kind}", `clearFormatting`, `image`, `moreTools` "More", `switchToMarkdown` "switch to Markdown editor", `switchToRich` "switch to rich text editor", `markdownSupported` "Markdown supported.", `pasteOrSelect` "Paste or select files to insert.", `preview` "Preview", `editNamed` "Edit {name}", `doneEditing` "Done", `maximiseNamed` "Maximise {name}", `foldNamed` "Collapse {name}", `unfoldNamed` "Expand {name}", `addLink` "Add link", `existingItem` "Existing item", `newItem` "New item", `formattingLost` "Some formatting cannot be written in Markdown and will be lost. Switch anyway?", `taskList` "Checklist", `cursorInLink` "Put the cursor in a link first."
- **Words** (CHATTER_LABELS, after `couldNotSend`): `commentedOn` "commented {date}", `writeFirst` "Write a comment first.", `saveComment` "Save", `comment` "Comment".
- Translate every word into ar, de and fr.
- **Designer:** the group panel (tracks, gap, fold at the end, maximise), the text panel (help style, icon, links in words), the html field's kind settings (toolbar when, where, tools; editor; switch; references), and the links widget's settings.

### 5.4 wi-history

`historySlot(options)` is exported from `@fieldia/chatter` (a new file `history.ts`). It fills a slot with the record's history from the chatter source's events:

```ts
export interface HistoryOptions {
  source: ChatterSource;
  /** The selection field whose changes the State Graph shows. */
  stateField?: string;
  /** The field whose new value names each transition ("Approved"). */
  reasonField?: string;
  /** What the record is called in "X created the {kind}": "work item"; "record" unless said. */
  kind?: string;
  locale?: Locale;
  labels?: Partial<ChatterLabels>;
  dir?: 'ltr' | 'rtl';
  icons?: IconSet;
  now?: () => Date;
}
```

- **States' colours:** from the page's node for `stateField` with widget `dot`: its `options.colours`, else its `options.tones`. A tracked change's `from`/`to` words are matched to the field's options' labels.
- **Sources:** messages with `kind: 'event'` and `tracking` are field changes. Messages of kind `message` with a body are comments ("{name} commented"). There are no new `ChatterSource` methods.
- **State Graph:** §2.8, in time order, wrapping. Its heading has its own ⤢ and ^, with the same look as a group heading.
- **History:** §2.8.
  - Groups by age: Today, Yesterday, This week, Last week, This month, Older. Each folds (chevron, Enter and Space).
  - The list is a `listbox`: ↑↓ move and select, Home and End; the detail follows the selection.
  - The detail pane lists each change with its new value (green chip) and old value (grey chip, struck through, with `aria-label` "was {value}").
  - The filter button at the heading's end opens a menu with checkable items Field changes / Comments.
  - Under 760px wide, the detail pane goes under the list.
- **Summaries:**

  | Change | Words |
  |---|---|
  | one field | `{name} changed {field} to {value}` |
  | a field emptied | `{name} cleared {field}` |
  | State among several | `{name} changed {field} from {from} to {to} and made field changes`, dots inline |
  | several, no State | `{name} made field changes` |
  | created | `{name} created the {kind}` |
  | comment | `{name} commented` |
- **Words** (CHATTER_LABELS, after `conversation`): `stateGraph`, `history`, `changedTo`, `changedFromTo`, `changedFromToMore`, `madeChanges`, `cleared`, `created`, `commented`, `today`, `yesterday`, `thisWeek`, `lastWeek`, `thisMonth`, `older`, `filterHistory` "Filter", `fieldChanges` "Field changes", `comments` "Comments", `noHistory` "No changes yet", `wasValue` "was {value}". Translate them into ar, de and fr.
- **Dates:**
  - The list uses `{ year: 'numeric', month: 'numeric', day: 'numeric' }`.
  - The detail uses `{ weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }`.
  - The graph uses `{ month: 'short', day: 'numeric' }`.
  - Arabic is written with Latin digits, as the chatter already does.
- **Designer:** none (code options). The page places `{ "type": "slot", "id": "history", "name": "history" }` in its History tab.

### 5.5 wi-demo

```ts
// layout.ts — ListNode gains:
/** Each column's cells, by field: a widget (`dot` for a state, with its options), an icon before the words from another field (a work item's kind), a width in characters, the side its words keep to. */
cells?: { [column: string]: ListCell };
/** A box to choose each row, and the buttons for those chosen; on unless false. */
choose?: boolean;
/** The search over the list: the search bar (`bar`, the default), or a keyword box and a list of values for each field of `filterFields` (`fields`). */
search?: 'bar' | 'fields';
filterFields?: string[];
/** Rows nested under their parent by this many2one, with Expand all and Collapse all in the header. */
parentField?: string;

export interface ListCell {
  widget?: string;
  options?: WidgetOptions;
  lead?: { field: string; looks: { [value: string]: { icon: string; colour?: string } } };
  width?: number;             // characters, 1–200
  align?: 'start' | 'end';
}

// page.ts PageLook gains (after readonlyShown):
/** False: an empty field in the quiet look shows nothing at rest, as a work item's Planning does; its label says what it is. True unless said. */
quietHints?: boolean;

// look.ts TOKEN_NAMES gains: 'link', 'band', 'help'.
```

- **Filter bar** (`search: 'fields'`, §2.10):
  - "Filter by keyword" searches the list's `searchFields`.
  - Each field's dropdown is a menu of its values with checkboxes. A many2one's values come from `groups()`; a path field shows its paths. The button shows the field's label in muted words until values are picked, then the picked words in 600.
  - × clears every filter. The gear opens the columns chooser (the list's existing optional columns), or is left out when there is none.
  - Keys: ↓ opens; the arrows move; Space ticks; Escape closes.
- **Cells:**
  - `dot` draws an 8px dot from `options.colours` or `tones`, then the words.
  - `lead` draws a 12px icon in its look's colour before the words.
  - Headers that do not fit end in "…" and have a `title`.
  - Column separators are 1px #eaeaea.
- **Words** (VIEWER_LABELS, after `loadMore`): `filterByKeyword` "Filter by keyword", `clearFilters` "Clear filters", `expandAll` "Expand all", `collapseAll` "Collapse all", `filterNamed` "Filter by {label}". Translate them into ar, de and fr.
- **Designer:** in the list's properties — no choose box, the filter bar's fields, each column's cell (widget, lead, width, side), the parent field. In the Look panel: "Empty quiet fields: say what to add / show nothing".

---

## 6. The demo

### 6.1 Files

- `demos/backlog/index.html` and `main.ts`.
- `demos/backlog/data.ts`: the memory data source, the trees and the chatter. The chatter holds the comment and the history events of the record.
- `demos/backlog/shell.css`: the app's chrome.
- `examples/pages/backlog.page.json`.
- `examples/pages/work-item-bug.page.json`: it validates today, holding every part that has landed.
- `demos/backlog/work-item-bug.target.json`: the whole page from this contract. The join copies it over the `.page.json` and turns on the tests marked `fixme`.

### 6.2 The app

- `main.ts` mounts the list page in the shell's main area with `onOpenRecord: (id) => open(id)`.
- `open` calls `openFormDialog({ page: bug, recordId: id, size: 'inset', backdrop: 'clear', maximise: true, resizable: true, title, dataSource, slots: { discussion, history }, onAction })`.
- It sets `?workitem=<id>` in the address with `history.replaceState`, and on load it opens that record.
- Closing removes the parameter, reloads the list's row and puts the focus back on the row.
- "New Work Item" opens a new bug.
- The app answers `follow`/`unfollow` with `{ stored: { following } }`.
- The app seeds `preferences` with the person's recent Area and Iteration picks, so Suggestions shows five on the first open.

### 6.3 The look

- `look: { theme: 'fluent', skin: 'quiet', density: 'compact', quietHints: false, lockAt: 'value' }`.
- The host's `tokens` from §2.2: `text`, `muted`, `page` #ffffff, `surface`, `fill`, `border`, `border-strong`, `accent`, `accent-soft`, `focus`, `focus-ring: none`, `radius: 4px`, `control-radius: 2px`, `font`, `link`, `band`, `help`.
- A dark set for `prefers-color-scheme: dark`.

### 6.4 The bug page (target JSON, abridged)

**Every word on the page is translated into ar, de and fr** in its `translations`.

```jsonc
{
  "fieldia": "0.1",
  "id": "work-item-bug",
  "title": "Bug",
  "data": { "kind": "record", "model": "work.item" },
  "look": { "theme": "fluent", "skin": "quiet", "density": "compact", "quietHints": false, "lockAt": "value" },
  "fields": {
    "number": { "type": "integer", "label": "ID", "readonly": true },
    "work_type": { "type": "selection", "label": "Work Item Type", "options": [ {"value":"bug","label":"Bug"}, {"value":"task","label":"Task"}, {"value":"story","label":"User Story"} ] },
    "title": { "type": "char", "label": "Title", "required": true },
    "assigned_to": { "type": "many2one", "label": "Assigned To", "relation": "res.users" },
    "comment_count": { "type": "integer", "label": "Comments", "readonly": true },
    "tags": { "type": "many2many", "label": "Tags", "relation": "work.tag" },
    "state": { "type": "selection", "label": "State", "options": [ {"value":"new","label":"New"}, {"value":"active","label":"Active"}, {"value":"resolved","label":"Resolved"}, {"value":"closed","label":"Closed"} ] },
    "reason": { "type": "selection", "label": "Reason", "options": [ {"value":"new","label":"New"}, {"value":"approved","label":"Approved"}, {"value":"investigated","label":"Investigation Complete"}, {"value":"fixed","label":"Fixed"}, {"value":"verified","label":"Verified"} ] },
    "area": { "type": "many2one", "label": "Area", "relation": "work.area" },
    "iteration": { "type": "many2one", "label": "Iteration", "relation": "work.iteration" },
    "repro_steps": { "type": "html", "label": "Repro Steps" },
    "system_info": { "type": "html", "label": "System Info" },
    "category": { "type": "selection", "label": "Category", "options": [ {"value":"business","label":"Business"}, {"value":"architectural","label":"Architectural"} ] },
    "resolved_reason": { "type": "selection", "label": "Resolved Reason", "options": [ {"value":"fixed","label":"Fixed"}, {"value":"duplicate","label":"Duplicate"}, {"value":"as_designed","label":"As Designed"}, {"value":"cannot_reproduce","label":"Cannot Reproduce"} ] },
    "story_points": { "type": "float", "label": "Story Points" },
    "priority": { "type": "selection", "label": "Priority", "options": [ {"value":"1","label":"1"}, {"value":"2","label":"2"}, {"value":"3","label":"3"}, {"value":"4","label":"4"} ] },
    "severity": { "type": "selection", "label": "Severity", "options": [ {"value":"1","label":"1 - Critical"}, {"value":"2","label":"2 - High"}, {"value":"3","label":"3 - Medium"}, {"value":"4","label":"4 - Low"} ] },
    "activity": { "type": "selection", "label": "Activity", "options": [ {"value":"deployment","label":"Deployment"}, {"value":"design","label":"Design"}, {"value":"development","label":"Development"}, {"value":"documentation","label":"Documentation"}, {"value":"requirements","label":"Requirements"}, {"value":"testing","label":"Testing"} ] },
    "original_estimate": { "type": "float", "label": "Original Estimate" },
    "remaining_work": { "type": "float", "label": "Remaining" },
    "completed_work": { "type": "float", "label": "Completed" },
    "dev_links": { "type": "many2many", "label": "Development", "relation": "dev.link" },
    "related": { "type": "many2many", "label": "Related Work", "relation": "work.item" },
    "found_in": { "type": "char", "label": "Found in Build" },
    "integrated_in": { "type": "char", "label": "Integrated in Build" },
    "changed_by": { "type": "many2one", "label": "Changed By", "relation": "res.users", "readonly": true },
    "changed_date": { "type": "datetime", "label": "Changed Date", "readonly": true },
    "following": { "type": "boolean", "label": "Following", "readonly": true },
    "attachments": { "type": "binary", "label": "Attachments", "multiple": true }
  },
  "layout": {
    "type": "sheet",
    "id": "bug",
    "head": {
      "kind": { "field": "work_type", "numberField": "number", "looks": { "bug": { "colour": "#cc293d", "icon": "bug" }, "task": { "colour": "#f2cb1d", "icon": "task" }, "story": { "colour": "#009ccc", "icon": "story" } } },
      "meta": [
        { "type": "field", "id": "h-assigned", "field": "assigned_to", "labels": "hidden", "placeholder": "No one selected", "options": { "avatar": true } },
        { "type": "link", "id": "h-comments", "icon": "chat", "field": "comment_count", "words": { "one": "Comment", "other": "Comments" }, "target": "g-discussion" },
        { "type": "field", "id": "h-tags", "field": "tags", "widget": "tags", "labels": "hidden", "placeholder": "Add Tag", "options": { "adder": "button" } }
      ],
      "actions": [
        { "type": "button", "id": "b-save-close", "label": "Save and Close", "icon": "save", "primaryWhenChanged": true, "steps": [ { "do": "save" }, { "do": "close" } ], "menu": [ { "id": "m-save", "label": "Save", "steps": [ { "do": "save" } ] } ] },
        { "type": "button", "id": "b-follow", "label": "Follow", "pressedLabel": "Following", "icon": "eye", "pressed": "following", "action": "follow", "menuIcon": "gear", "menuLabel": "Notification settings", "menu": [ { "id": "m-follow-all", "label": "All changes", "action": "follow-all" }, { "id": "m-follow-state", "label": "State changes", "action": "follow-state" } ] },
        { "type": "button", "id": "b-refresh", "label": "Refresh", "icon": "refresh", "iconOnly": true, "steps": [ { "do": "reload" } ] },
        { "type": "button", "id": "b-undo", "label": "Revert changes", "icon": "undo", "iconOnly": true, "steps": [ { "do": "reset" } ] }
      ],
      "band": {
        "tracks": ["274px", "1fr"],
        "labelWidth": 76,
        "children": [
          { "type": "field", "id": "f-state", "field": "state", "widget": "dot", "hotkey": "e", "options": { "label": true, "listDots": false, "colours": { "new": "#b2b2b2", "active": "#007acc", "resolved": "#ff9d00", "closed": "#339933" } } },
          { "type": "field", "id": "f-area", "field": "area", "widget": "path", "hotkey": "a" },
          { "type": "field", "id": "f-reason", "field": "reason", "readonly": true, "readonlyReason": "Set by the workflow when the State changes" },
          { "type": "field", "id": "f-iteration", "field": "iteration", "widget": "path", "hotkey": "r" }
        ]
      },
      "updated": { "byField": "changed_by", "atField": "changed_date", "opens": "t-history" }
    },
    "title": { "field": "title", "before": [ { "type": "field", "id": "t-number", "field": "number", "labels": "hidden" } ] },
    "toolbar": { "menu": [ { "id": "m-copy-link", "label": "Copy link", "action": "copy-link" }, { "id": "m-delete", "builtin": "delete" } ] },
    "children": [
      { "type": "tabs", "id": "wi-tabs", "place": "head", "children": [
        { "type": "tab", "id": "t-details", "label": "Details", "children": [
          { "type": "section", "id": "cols", "style": "plain", "columns": 3, "tracks": ["50%", "1fr", "1fr"], "gap": 16, "children": [
            { "type": "section", "id": "col-1", "style": "plain", "children": [
              { "type": "section", "id": "g-repro", "title": "Repro Steps", "style": "line", "collapsible": true, "foldAt": "end", "maximise": true, "children": [
                { "type": "field", "id": "f-repro", "field": "repro_steps", "labels": "hidden", "placeholder": "Click to add Repro Steps.", "options": { "editor": "markdown", "toolbar": "focus", "tools": ["mention","reference","attach","highlight","heading","bold","italic","code","link","bulletList","numberList","taskList"] } } ] },
              { "type": "section", "id": "g-system", "title": "System Info", "style": "line", "collapsible": true, "foldAt": "end", "maximise": true, "children": [
                { "type": "field", "id": "f-system", "field": "system_info", "labels": "hidden", "placeholder": "Click to add System Info.", "options": { "editor": "rich", "toolbar": "focus", "toolbarAt": "bottom", "switchEditor": true, "tools": ["bold","italic","underline","bulletList","numberList","highlight","colour","emoji","outdent","indent","strike","size","code","mention","reference","clearFormatting","image","link","unlink"] } } ] },
              { "type": "section", "id": "g-discussion", "title": "Discussion", "style": "line", "collapsible": true, "foldAt": "end", "maximise": true, "children": [
                { "type": "slot", "id": "s-discussion", "name": "discussion" } ] } ] },
            { "type": "section", "id": "col-2", "style": "plain", "children": [
              { "type": "section", "id": "g-planning", "title": "Planning", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "field", "id": "f-category", "field": "category", "options": { "list": "own" } },
                { "type": "field", "id": "f-resolved-reason", "field": "resolved_reason", "readonly": true, "readonlyReason": "Set when the bug is resolved" },
                { "type": "field", "id": "f-points", "field": "story_points" },
                { "type": "field", "id": "f-priority", "field": "priority", "options": { "list": "own" } },
                { "type": "field", "id": "f-severity", "field": "severity", "options": { "list": "own" } },
                { "type": "field", "id": "f-activity", "field": "activity", "options": { "list": "own" } } ] },
              { "type": "section", "id": "g-effort", "title": "Effort (Hours)", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "field", "id": "f-estimate", "field": "original_estimate" },
                { "type": "field", "id": "f-remaining", "field": "remaining_work" },
                { "type": "field", "id": "f-completed", "field": "completed_work" } ] } ] },
            { "type": "section", "id": "col-3", "style": "plain", "children": [
              { "type": "section", "id": "g-deployment", "title": "Deployment", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "text", "id": "x-deployment", "style": "help", "text": "To track releases associated with this work item, go to [Releases](https://example.com/releases) and turn on deployment status reporting for Boards in your pipeline's Options menu. [Learn more about deployment status reporting](https://example.com/help/deployment-status)" } ] },
              { "type": "section", "id": "g-development", "title": "Development", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "field", "id": "f-dev", "field": "dev_links", "widget": "links", "labels": "hidden", "options": { "add": "search", "helpIcon": "branch", "help": "Link a [commit](https://example.com/help/commit), [pull request](https://example.com/help/pull-request) or [branch](https://example.com/help/branch) to see the status of your development. You can also [create a branch](https://example.com/help/new-branch) to get started." } } ] },
              { "type": "section", "id": "g-related", "title": "Related Work", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "field", "id": "f-related", "field": "related", "widget": "links", "labels": "hidden", "options": { "add": "menu", "emptyLink": "Add an existing work item as a parent" } } ] },
              { "type": "section", "id": "g-build", "title": "System Info", "style": "line", "collapsible": true, "foldAt": "end", "children": [
                { "type": "field", "id": "f-found", "field": "found_in" },
                { "type": "field", "id": "f-integrated", "field": "integrated_in" } ] } ] } ] } ] },
        { "type": "tab", "id": "t-history", "label": "History", "icon": "history", "iconOnly": true, "children": [ { "type": "slot", "id": "s-history", "name": "history" } ] },
        { "type": "tab", "id": "t-links", "label": "Links", "icon": "link", "iconOnly": true, "count": "related", "children": [ { "type": "field", "id": "f-links-all", "field": "related", "widget": "links", "labels": "hidden", "options": { "add": "menu" } } ] },
        { "type": "tab", "id": "t-attachments", "label": "Attachments", "icon": "attach", "iconOnly": true, "count": "attachments", "children": [ { "type": "field", "id": "f-files", "field": "attachments", "labels": "hidden" } ] }
      ] }
    ]
  }
}
```

### 6.5 Data (invented)

**Record 4127:**
- Kind: bug. Title: "Stock count shows 12 after releasing 3 of 15 items to order SO-2088".
- State: Active. Reason: Approved.
- Area: "Portal". Iteration: "Portal\Sprint 14".
- Assigned to: empty.
- `comment_count` 1. Tags: none.
- Priority 1. Severity "3 - Medium". The other Planning and Effort fields empty.
- Repro steps: `<p><a href="https://shop.example/orders/SO-2088?tab=history">https://shop.example/orders/SO-2088?tab=history</a></p>`.
- System info: empty.
- Changed by Mona Adel on 2026-08-25.
- Not followed. One attachment. No links.

**People:** Mona Adel, Karim Fathy, Salma Nabil (me), Omar Hany. Initials avatars, except Karim, who has a drawn picture as a data: URI.

**Comment:** Karim Fathy, 2026-06-14: "I need the night shift's warehouse log before I can reproduce it; the scanner there is offline until Sunday."

**History events** (newest first; all invented):
- Mona Adel changed Stack Rank three times (8/25, 8/23, 8/20).
- Mona Adel changed Iteration Path to Portal\Sprint 14 (7/27).
- Mona Adel changed Stack Rank (7/22; detail: 1999979534, was 1999987060).
- Karim Fathy changed State from New to Active and made field changes (7/8; reason Approved).
- Karim Fathy changed Title (7/8).
- Karim Fathy changed State from Active to New (6/14; reason Investigation Complete).
- Mona Adel changed State from New to Active (6/11; reason Approved).
- Mona Adel created the work item (6/10; reason New).

**Areas:** Portal; Portal\Checkout; Portal\Search; Warehouse.

**Iterations** (each with dates as `aside`): Portal (root); Portal\Test Plan 8/3/2025 - 8/17/2025; Portal\Sprint 12 3/25/2026 - 4/16/2026; Portal\Sprint 13 4/8/2026 - 4/20/2026; Portal\Sprint 14 4/12/2027 - 5/25/2027; Portal\Tasks and Activities 7/16/2026 - 8/28/2026; Portal\Invoices 12/29/2027 - 2/9/2028.

**Backlog:** 17 invented bugs, Order 17 … 207, all Active, Value Area Business, with iteration paths.

### 6.6 Catalog entry

```js
{
  id: 'backlog',
  name: 'Work item in a popup',
  category: 'records',
  app: 'backlog',
  query: '',
  blurb: 'A backlog of bugs and one opened in a large popup over it, as a work tracker draws it: its kind\'s strip and badge, a quiet head with State, Reason, Area and Iteration, three columns of groups, a discussion, links, and its history.',
  howTo: [
    'Click a bug in the backlog: it opens in a large popup over the list.',
    'Open Area and Iteration: Suggestions first, then the tree with each sprint\'s dates.',
    'Click into System Info: the toolbar appears inside the box.',
    'Write a comment and Save it: the count in the head follows.',
    'Open the History tab: the State Graph, then each change with its before and after.',
  ],
}
```

---

## 7. Acceptance, lane by lane

For each state:
1. Screenshot it at a 1920×1080 viewport (the popup states over the backlog where the lane can, or the lane's own test page in `?open=dialog`).
2. Put the screenshot beside the user's screenshot of the same state, at the same crop. Check positions to ±2px, colours exactly (§2.2), and type sizes.
3. Run axe clean in that state.
4. Repeat in right to left (Arabic), dark, and at 390px wide.

| Lane | Screenshot file | State to match | Checks beyond the look |
|---|---|---|---|
| **wi-header** | `20.22.23` | At rest: dialog inset 96/46, no dim, depth-64 shadow; 10px #cc293d strip y 197–318; badge "BUG 4127"; ⤢ ×; number and title; meta row; Save and Close split (subtle, usable), Follow split with gear, refresh, undo, ⋮; the band with State (dot in the lead slot), Reason (lock in the lead slot), Area, Iteration, the access keys underlined; "Updated by Mona Adel: Aug 25"; tabs Details (underlined) / History / Links 0 / Attachments 1 | Save and Close with nothing changed closes the dialog. After a change it is primary, saves, and closes with `saved: true`. Undo with nothing changed says why. Alt+E, Alt+A and Alt+R focus State, Area and Iteration. Tabs: arrows, Home, End. Escape with changes asks first. Follow toggles to "Following" without making the record changed (`stored`). |
| wi-header | `08_19_PM` | The title pointed at: 1px #7e7e7e box, 32px, x +64 … right−42; Copy title at its end | Copy title copies and says "Title copied". It shows on keyboard focus too. |
| wi-header | `20.24.46` (head only) | History tab selected: its underline; Details plain | "Updated by …" opens History. |
| wi-header | (no screenshot) | ⤢ maximised: the whole window; ⤢ becomes Restore. The grip resizes. Under 760px: the whole window | The grip's arrow keys work. Focus stays in the dialog. Closing gives the focus back to the opener. |
| **wi-picker** | `20.20.45` | Area open: the box as wide as its column with an accent edge; callout as wide, "Suggestions" in 600, the current row #deecf9 with a focus rectangle, the divider, the tree root | Typing filters. Arrows and →/← on the tree (flipped right to left). Enter picks and the pick joins Suggestions next time. Escape puts back. |
| wi-picker | `20.20.45` | State open: the list at the value box's start, 199px, 30px rows, ✓ on Active, no dots | Keys, type-ahead, Escape; picking Resolved changes the dot's colour. |
| wi-picker | `20.24.05` | Iteration open: suggestions with right-aligned dates, the two-cell highlight, the divider, "⌄ Portal" with children indented 16px and their dates, max 268px tall, scrolling | `aria-haspopup="tree"`, `role="tree"`, `aria-expanded` on branches. |
| wi-picker | `20.22.23` (meta row) | "No one selected" with a person icon; "Add Tag" button #f2f2f2 19px | Picking a person shows the avatar. Add Tag → box → Enter adds a chip → the button comes back. |
| wi-picker | `20.22.23` (Planning) | Priority "1", Severity "3 - Medium" as words; clicked, Fieldia's own list with ✓ | — |
| **wi-text** | `20.22.23` | Group headings and rules; the Repro link with its external icon; "Click to add System Info."; the Discussion composer card and comment card exactly (§2.6); the right column: Deployment help, Development Add link and help with the branch icon, Related Work "Add link ▾" and the empty link, the build fields | Links open in a new tab. "1 Comment" (once joined) lands in the comment box. |
| wi-text | `20.22.25` | System Info pointed at: #eaeaea box inset 10px; ⤢ ^ at the heading's end | The same tools show on keyboard focus. |
| wi-text | `20.22.28` | System Info focused: accent box, the 20 tools in their order at the bottom inside, "switch to Markdown editor" under it | Tools have names and tooltips; arrows along the bar; "…" when narrow; Remove link with nothing to remove says why. |
| wi-text | `20.21.54` | Repro Steps editing in Markdown: card, text box, hint, 13 tools, Preview switch; ⤢ ^ ✓ | Preview renders. ✓ keeps, Escape puts back. The stored value is clean HTML. Switching from rich asks when formatting would be lost. |
| wi-text | `20.22.36` | Comment box focused: toolbar inside with "…", switch link, Cancel and Save | Save with nothing typed says why. Ctrl+Enter posts. The new comment card appears and `onCount` is called. |
| wi-text | `20.23.03` | "Add link ▾" open: the menu aligned to the button's end, 223px, two 31px rows with icons, focus rectangle, the button #d2d2d2; Effort (Hours) folded with ⌄ | Existing item opens the search; New item opens a new record; menu keys. Folding by ^ and by keyboard. |
| **wi-history** | `20.24.46` | State Graph (arrows, reasons, avatars, names, dates, state chips with dots), History list (group "Older", 51px rows, 32px avatars, dates at the end, the selected row #eaeaea), detail pane (header, rule, Stack Rank: new green chip, old grey chip struck) | Arrows move the selection and the detail follows. Groups fold. The filter menu hides comments or changes. The state row shows dots inline and the dot at its end. Under 760px the detail goes under the list. |
| **wi-demo** | `08_18_PM` | The backlog: shell, page header, pivots, filter bar card (Bug ▾, Active ▾ picked; Area, Iteration, Tags muted; gear; ×), the table (no checkboxes, +/−, Order right-aligned, kind icon before titles, dots before states, ellipsis headers, separators, 35px rows) | Filter dropdowns with checkboxes and their keys; × clears; Enter and click on a row open the popup; the address keeps `?workitem=`; reloading reopens it; closing gives the focus back to the row. |
| wi-demo | `08_19_PM`, then every `20.xx` | The whole popup over the backlog, after the join with the target JSON: every state above, on the one demo | The pixel comparison of §7 for all nine popup states. |

**Every lane also checks:**
- the words in ar, de and fr;
- right to left (mirrored, the arrows flipped);
- dark (the tokens' dark set);
- 390px wide (no sideways scroll; the dialog fills the window);
- axe clean in each state;
- nothing reachable only by hover;
- icon-only buttons named.

---

## 8. Gates (every lane)

1. Check `uptime` first. While the 1-minute load is above 12, wait (another workflow is testing map providers on this machine).
2. Never run `npm install`: `node_modules` is linked to the main checkout's.
3. `NX_DAEMON=false npx nx run-many -t typecheck lint test -p <projects you touched>`
4. `node tools/script-bundle.mjs` and `node tools/map-bundle.mjs`. Raise a budget only with a written reason in the tool, as earlier releases did. The Markdown converter is hand-written for this reason: no library.
5. `node tools/build-demos.mjs`, **always with no argument**.
6. `node tools/build-site.mjs`
7. `FIELDIA_DEMO_PORT=<p1> FIELDIA_SITE_PORT=<p2> npx playwright test <your specs> --workers=2`, with the ports from the orchestrator.
   - Every spec imports `test` and `expect` from `./fixtures`.
   - Spec files: `e2e/wi-header.spec.ts`, `wi-picker.spec.ts`, `wi-text.spec.ts`, `wi-history.spec.ts`, `wi-demo.spec.ts`.
   - Screenshots go through `screen()` from `e2e/support.ts`.
8. Before finishing: `npx nx run-many -t build`, then `node tools/release.mjs check`.
9. Commit on your lane's branch when green. Messages are one line of 72 characters or fewer, with no body and no Co-Authored-By line. Name the paths explicitly: `git commit -m "…" -- <paths>`.
10. Never push, publish, merge into main, stash, reset, clean or `checkout -- .`, and never touch another lane's worktree.

## 9. Known limits

- **Tolerance:** ±2px on positions, 0 on colours (§2.2's values, with the blues as their source values), ±1px on type metrics. On Linux the system font is not SF Pro, so word widths differ. Compare positions of edges and boxes, not glyph widths.
- **Deliberate differences from the screenshots** (Fieldia's rules, §0):
  - Save and Close, Undo, the comment's Save, Remove link and New Work Item look usable.
  - Every icon-only button has a name and a tooltip.
  - Hover-only tools also show on focus.
  - The Development help icon is Fieldia's generic `branch` icon in a neutral colour.
- **Out of scope:**
  - the Kanban board (third backlog screenshot): Grafloria's;
  - the browser chrome and the macOS dock in the screenshots;
  - DevOps's own product navigation, which the demo's shell replaces with generic words.

## 10. Loaded on first use

A page that uses none of the work item's parts pays almost nothing for them: each comes the first time a page uses it
(`libs/widgets/src/lib/parts.ts`). In the packages a part is a module asked for with `import()`, which an app's bundler
makes a chunk; in the script bundle it is a script beside fieldia.js, which fieldia.js adds from its own folder
(`tools/script-parts.ts`, built by `tools/script-bundle.mjs` against the main script, sharing its modules by name).

| Part | Module | Script | What it holds |
| --- | --- | --- | --- |
| head | viewer `head-part.ts` | fieldia.head.js | the record head and its tabs, split/toggled/icon buttons, a group's heading with its tools, the inset dialog's ⤢ and grip, their sheets (head-styles, group-styles) |
| text | widgets `text-part.ts` | fieldia.text.js | the formatted text's editors, Markdown both ways, the menus, the links box, their sheet (styles-editor) |
| path | widgets `path-part.ts` | fieldia.path.js | the path picker and its sheet (styles-path) |
| filters | viewer `filters-part.ts` | fieldia.filters.js | a list's filter bar and its sheet (filter-styles) |
| discussion, history | chatter `discussion.ts`, `history.ts` | — (chatter is not in the script) | the Discussion (with the text part) and the History |

- The viewer finds a page's parts (`partsFor`) and draws the page once they are in: nothing of it before, so nothing
  moves as they arrive; `openFormDialog` opens its box once they are in. `handle.drawn` settles when it is drawn;
  `loadParts(page)` loads them ahead. A part that cannot come leaves what it would draw drawn plainly.
- A widget made before its part came, outside the viewer, is drawn plainly and replaced in place by the part's.
- A part's sheet goes between Fieldia's two (`installPartStyles`, `PART_RANK`): after the quiet look and the pickers',
  before the page's own looks, as its rules stood in FIELDIA_CSS.
- What stays in every page: the page's checks of heads, buttons, groups and list cells (checkPage is synchronous), a
  list's backlog cells, nested rows and Fluent's list look, Fieldia's own lists and a state's dot, the work item's icons
  (any page may name them), the access key and a lock at a value, help boxes and a group's tracks.

