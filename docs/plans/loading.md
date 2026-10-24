# Loading — one model for every control (0.33, lane w7-loading)

Every part of Fieldia that waits for an answer — a record, a list's rows, a map's places, a link's suggestions, a
save — waits the same way. A page says how it looks while it waits, an app says it for all its pages, a list or a
field says it for itself; what nobody says is Fieldia's default. One module keeps the time, the words for a screen
reader and the clean-up; each control only says where its answer goes and what shape it has.

## The module

`startLoading(region, moment, loading)` in `@fieldia/widgets` (libs/widgets/src/lib/loading.ts) is the one timing
machine. A control calls it as it asks, and ends what it hands back as the answer comes (`done(apply)`) or fails
(`fail(error, retry)`). From the first moment the region is `aria-busy`; nothing is drawn until `delay` (150 ms) has
passed, so a quick answer never flashes a loader; once drawn, a loader stays at least `minShown` (300 ms), and the
control's `apply` — the rows, the record — runs as it goes, so nothing flickers; after `slowAfter` (5 s) "Still
loading…" is said once, politely; past `timeout` (none unless set) the wait ends as failed. What a control is handed
(`Loading`) is its settings resolved — Fieldia's defaults, then the viewer's `loading` option (the app's), then the
page's `loading`, then the part's own (a list's, a related list's or a map's `loading`, a field's `options.loading`),
the most specific winning setting by setting — with the viewer's hooks: its events, its toast, the app's `custom`.

## The moments

**`first` — a form, a list, a card, a map, a related list drawn for the first time** — and what a list's row opens to
(its `detail`), a form's limits while their counts are asked, a list whose part had to be asked for again. Default `skeleton`: grey shapes
where the content will be, shaped like it. A record's form is drawn whole while its record comes, its boxes shown as
skeleton bars under their labels (the labels are the page's, known before the record is); while the page's own parts
are still coming, a skeleton made from the page's layout stands in its place — its groups, its fields' labels and
boxes, as wide as they will be. A list draws skeleton rows in its own columns (as many as fit a page, up to eight), or
skeleton cards where its rows are cards (a phone, a gallery); a map is one skeleton block as tall as the map, until
its map and its places are in; a saved form placed in a page, three skeleton bars in its place. `spinner` turns a ring (or three
dots) in the middle of the place, `progress` runs a bar along its top (or across its middle: `inline`), `text` says
"Loading…" there (what 0.31 did), `none` draws nothing (the region is still busy for a screen reader), `custom` lets
the app draw.

**`refresh` — a list or a part asked again: a search, a filter, an order, another page, a record reloaded.** Default
`keep`: what is shown stays where it is, and a thin bar runs along the top of the list (or the form) — no row moves,
nothing jumps, the place keeps its height. `dim` greys what is shown while it waits (0.31's list), `skeleton` puts
skeleton rows in place of the rows, `spinner` turns a ring over what is shown, `none`, `custom`. A record moved to
with the pager, or loaded again (a reload step, Retry), is a refresh of the form: its values stay, the bar over them.
Whatever replaces what is shown is a refresh: a list's or a related list's next page from its pager, a calendar's next
week or month, a timeline's records asked again.

**`more` — the next rows put under those shown: endless scroll, "Show more", a tree's children.** Only what is added
after what is shown, never what replaces it (a pager's next page is a `refresh`). Default `row`: a row saying "Loading more…" where the rows will come, in the table's width (a card's place
in a gallery). `spinner` turns a ring there, `skeleton` draws three skeleton rows there, `none`, `custom`. What is
already shown never moves.

**`search` — a link's or a dropdown's suggestions, choices from the app's lists, a filter's values, a menu's items
the app gives (`menuFrom`, "Loading…" after the menu's own).** Default
`inline`: "Searching…" in the list under the box, where the suggestions come (for a field's choices from the app,
"Loading choices…" under the field, as 0.31 said it — now after the delay, never as a flash). `spinner` turns a small
ring at the box's end, `none`, `custom`. The box is never locked: the person types on, and only the latest answer is
shown.

**`action` — a button's steps, a send, a save.** Default `button`: the pressed button is busy, a ring beside its words
(0.31's), drawn after the delay and kept its minimum, the button free again as its steps end. `bar` runs a bar along
the top of the form instead, `overlay` covers the form with a veil and a ring (nothing pressed or typed until it ends),
`none` keeps only `aria-busy`, `custom`. A button stays busy — not pressed twice — in every case. A record's own Save
steps aside while it saves, as it always has, its status saying "Saving…": under `bar` and `overlay` the form shows
the save too.

## Looks and timing

Variants: a skeleton `shimmer`s (a light band passing over it, the default), `pulse`s (fading in and out) or stays
`static`; a spinner is a `ring` (default) or three `dots`; a progress bar runs along the `top` (default) or across the
middle (`inline`). Timing in milliseconds: `delay` 150, `minShown` 300, `slowAfter` 5000, `timeout` none. Every theme
gives the looks their tokens — `--fd-skeleton` (the shapes' tint), `--fd-skeleton-shine` (the shimmer's band),
`--fd-shimmer` (how long one pass takes), `--fd-spinner` (the ring's colour, the accent unless said), `--fd-bar` (the
bar's height) — light and dark, and a host's own tokens set them as they set any other.

## When it fails

`error: "inline"` (default): "Couldn't load." in the loader's place, with the source's own words when it gave any and
a Retry that asks the same thing again — never an empty place. A list keeps its own sentence ("Could not load the
customers.") and Retry. `toast`: the place shows what it showed before (or stays empty, its Retry in the toast), and a
toast says it with Retry. `custom`: the app's function is called again with `failed: true` and `retry`. A link's search
that fails says "Couldn't search." in its list, with Retry.

## Custom, events, always

`loading: { custom: (ctx) => … }` on the viewer (and the React, Vue and Angular bindings' `loading` prop): where a
moment's technique (or `error`) is `custom`, Fieldia calls it with `{ moment, part, container, signal, slow, failed,
error, retry }` as the loader shows, again when it turns slow, and again if it fails; the app draws inside
`container`. Fieldia still keeps the time, `aria-busy`, the announcement and the clean-up: as the loader goes,
`signal` aborts, the function's own clean-up (what it returned) runs and the container goes. A page that says `custom`
on a viewer given none draws the moment's default. The viewer's handle tells `loadingstart` and `loadingend` (`{
moment, part, duration, failed }`), for an app's own indicator — at the true start and end, whether a loader was drawn
or not. Always, whatever the style: `aria-busy` on the busy region; one polite announcement per wait (never one per
row); `prefers-reduced-motion` stills every shimmer, pulse, ring and bar; `forced-colors` draws the shapes with the
system's own colours; right to left mirrors them; on paper no loader shows. What a person has open stays theirs: a
part asked again with a popup open in it (a date's calendar, a box's list, a menu: its opener expanded) is drawn as
`keep` whatever its way — never shapes or a ring over what is open — and a popup opened while a part waits stays over
the wait and takes its presses (the part holding it is never hidden, dimmed or shaped; a ring over what is shown lets
presses through).

## Where the code lives

In the main script, what every page that waits needs: the timing machine, the resolution of the settings, the words
(`text`, a row's "Loading more…", a search's "Searching…", "Still loading…"), `dim`, a busy button's ring (drawn past
the delay by the stylesheet itself, so every busy button waits so) and a failure in its place with Retry. In the
loading part (`fieldia.loading.js`): the skeletons — a few bars, a form's boxes under their labels, the page's layout
while its parts come (page-skeleton.ts) — the bars along the top and across the middle, the spinners, the overlay,
and their tokens. A page that waits for its own parts asks for the loading part with them (it delays nothing: it comes
alongside); a page whose record loads with nothing else to wait for asks for it as it mounts, not waiting for it; any
other wait asks for it as it begins. Until it has come, a wait drawn the first time says "Loading…" in words, any
other is a screen reader's alone, and each is drawn as it says once it has. A page, a part of it or an app that names
a spinner or the overlay has it waited for with the page's parts. A list's skeleton rows and cards are the list's and
the cards' parts'; a map's block is @fieldia/map's.

## The data source

Nothing new. Where a page sets a `timeout`, a list's request its wait waits for (`list`: its records, its next rows, a
map's places) is told to stop as the timeout passes, its `signal` (an AbortSignal) aborting, as uploads and a map's
clusters already do. A source that honours it (rejecting with an error named `AbortError`) frees the server sooner; one
that ignores it loses nothing: the wait has ended as failed, and an answer that comes after is dropped, as a late
answer always was. A record whose `load` answers after its timeout is drawn as it comes, the failure's words taken
away.

Since 0.34 every request also has a deadline of its own, the viewer's `timeout` (30 s unless the app says, 0 for none:
docs/plans/wave1-contract.md §39), and carries that deadline's `signal`. The deadline ends the request; a wait's
`timeout` here ends the loader. Both set, the sooner ends the wait — said once, with one Retry: a loading timeout
shorter than the deadline says "It took too long." and tells a list's request to stop; one longer never fires, the
deadline ending the request, and its wait with it, first. A record's load that fails is said in its place in core's
words for it (`state.loadProblem`: "This customer could not be loaded: …") with Retry, which loads it.
