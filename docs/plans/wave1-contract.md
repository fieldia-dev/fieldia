# The data source contract for 0.21 (Wave 1 and Wave 2)

Four lanes add to the same `DataSource` interface: file upload (w1-files), save
safety and permissions (w1-save), and later export with bulk edit (E) and totals
(F). This commit declares all of those additions on `wave1` before the lanes
start, so no two lanes edit the same lines of
`libs/core/src/lib/record/data-source.ts`. It declares the shapes and nothing
else: no widget, viewer or list uses them yet. Each lane builds its own feature
on these shapes.

**The rule for every addition:** it is optional. A data source that does not
implement it, or does not fill it in, keeps exactly today's behaviour. Every
addition is also implemented in `createMemoryDataSource`, so demos and tests can
use it now, and `libs/core/src/lib/record/data-source-contract.spec.ts` tests
each one.

| Addition | For | Lane |
|---|---|---|
| `upload(file, request)` and `FileValue.fileId` | file and picture fields that store each file when it is picked | w1-files |
| `RecordVersion`, `SaveRequest.version`, `SaveResult.version`, `ConflictError` | the "someone else changed this" warning, with Reload and Keep mine | w1-save |
| `RecordPermissions` (`can`) on a load, a save result and a list row | hiding what this person may not do, and locking the form | w1-save |
| `ListRequest.allIds`, `ListResult.allIds` | "Select all 1,284 that match", export, bulk edit | E (Wave 2) |
| `totals(request)` | a totals row under a list, sums on Group By headings, the sum of the ticked rows | F (Wave 2) |

Everything below is exported from `@fieldia/core`.

---

## 1. Loading: a record with more to tell

Today `load` returns the record's values. It can now also return a **loaded
record**: the values plus the record's version and what this person may do with
it. The version has to arrive in the same answer as the values. A second call
could read a newer version than the values it goes with, and the conflict check
would then miss the change it exists to catch.

```ts
load?(request: LoadRequest): Promise<Values | LoadedRecord>;

interface LoadedRecord {
  $loaded: true;            // the mark; no field can be named `$loaded`
  values: Values;
  version?: RecordVersion;
  can?: RecordPermissions;
}

function loadedRecord(values: Values, more?: { version?: RecordVersion; can?: RecordPermissions }): LoadedRecord;
function loadedRecordOf(loaded: Values | LoadedRecord): LoadedRecord;   // reads either form the same way
```

An adapter gives the extra information like this:

```ts
async load({ model, id }) {
  const row = await api.read(model, id);
  return loadedRecord(toValues(row), {
    version: { token: row.write_date, by: row.write_uid[1], at: row.write_date },
    can: { delete: row.can_unlink, readonlyFields: row.locked_fields },
  });
}
```

Bare values are still a valid answer. The form already reads every load through
`loadedRecordOf`, and keeps only `values` for now. Lane w1-save keeps `version`
and `can` from that same line in `form.ts`.

**This changes a type.** `load`'s declared return type is now wider. Any code
that calls `load` itself (in practice, only tests) reads the result with
`loadedRecordOf(await source.load(...)).values`. In this repo that meant three
loads in two specs. No adapter has to change.

## 2. Versions and conflicts (w1-save)

```ts
interface RecordVersion {
  token: string;   // an etag, a write date, a revision: Fieldia only hands it back
  by?: string;     // who changed the record last: "Mona"
  at?: string;     // when, as ISO: "2026-10-13T10:42:00Z"
}

interface SaveRequest { /* …as before… */ version?: RecordVersion }   // the version the page opened, or got from its last save
interface SaveResult  { /* …as before… */ version?: RecordVersion; can?: RecordPermissions }

class ConflictError extends Error {
  constructor(conflict: SaveConflict, message?: string);
  readonly conflict: SaveConflict;
  readonly problem: SaveProblem;   // { kind: 'conflict', message, conflict }
}
interface SaveConflict {
  version: RecordVersion;   // what the record holds now: who changed it and when
  theirs?: Values;          // the record as they left it, when the source has it
}
// SaveProblem.kind gains 'conflict', and SaveProblem gains conflict?: SaveConflict.
```

In plain words:

- **Opening.** The page keeps the `version` it loaded. After each save it keeps
  the `version` that the `SaveResult` returns.
- **Saving.** The page sends that version as `SaveRequest.version`. A source
  that keeps versions compares it with the record's current version and throws
  `new ConflictError({ version: current, theirs })` when they differ. A save
  that carries no version (a new record, or a source that gave none) is not
  checked.
- **Showing it.** `saveProblemOf(error)` reads a `ConflictError` as
  `{ kind: 'conflict', conflict }`, through the same `problem` property that
  `saveRefused` uses. It does not depend on `instanceof`, so it still works when
  an app ends up with two copies of core. The page names who changed the record
  and when, from `conflict.version.by` and `.at`, and offers **Reload** or
  **Keep mine**. Until w1-save draws that, the viewer shows a conflict the way
  it shows any other refused save. No form sends a version yet, so no conflict
  can happen yet.
- **Reload** loads the record again. It can show `theirs` at once while that
  load runs.
- **Keep mine** saves again with `version: conflict.version`, which means "my
  changes on top of the record as it is now". `changes` holds only this
  person's changes, so a source that writes only the changed fields keeps the
  other person's work wherever this person changed nothing. For a source that
  saves whole records, the page sends `values` as `theirs` with this person's
  changes laid over them. If a third person saved in between, the result is
  another conflict, which is the right answer. When the conflict carries no
  `theirs` and the record cannot be read again (no `load`, or it fails), Keep
  mine saves nothing: the form says so (`FormConflict.unread`), and the person
  tries again or reloads.
- **One save at a time.** A save asked for while another is on its way waits
  for it, and carries the version that save returned.

No `force` flag exists. Saving with the current version is the way to save
anyway, so an adapter needs no second code path for it.

**A save of some fields** (`SaveRequest.partial`, added with the calendar's
fixes): a save made outside a form, which never had the whole record, sets
`partial: true`. `values` and `fields` then hold only the fields in `changes`.
A source that saves whole records writes those over the record as stored and
keeps every other field. A calendar's move and its Undo save this way.

## 3. Permissions (w1-save)

```ts
interface RecordPermissions {
  edit?: boolean;        // false: the form is read-only and Save is hidden
  delete?: boolean;      // false: Delete is hidden, along with the delete step's buttons
  archive?: boolean;     // false: Archive and Unarchive are hidden
  duplicate?: boolean;   // false: Duplicate is hidden
  readonlyFields?: string[];   // fields this person may see but not change
  hiddenFields?: string[];     // fields this person may not see; the source leaves their values out
  reason?: string;       // why, in the person's language: "Only Mona, the lead's agent, can change it."
}
```

Everything is allowed unless the source says `false`. A source that says nothing
gets today's behaviour, where Archive, Duplicate and Delete show whenever the
source has the method. `can` arrives in three places: on a loaded record, on a
`SaveResult` (a save can change it, for example a stage that locks the record),
and on each list row (`ListedRecord.can`), so row buttons and bulk edit can obey
it.

Product rules for the lane: hide, never disable; give the reason in words and to
a screen reader, using `reason` or the viewer's own words in en/ar/fr/de when the
source gives none. Fields in `hiddenFields` disappear. Fields in
`readonlyFields` lock the way a page's `readonly` does.

## 4. Upload (w1-files)

```ts
upload?(file: UploadFile, request: UploadRequest): Promise<UploadedFile>;

interface UploadRequest {
  model: string;
  field: string;                 // the file or picture field
  recordId: RecordId | null;     // null while the record is new
  line?: { field: string; key: string; id?: RecordId };   // a field on a table's line
  signal?: UploadSignal;         // an AbortSignal: the file was taken away, or the person left
  onProgress?: (sent: number, total: number) => void;
}
interface UploadedFile { url: string; name: string; size: number; type: string; fileId?: RecordId }
// FileValue gains fileId?: RecordId, so the field keeps exactly what upload returned: { url, name, size, type, fileId }, no data.

interface UploadFile { readonly name: string; readonly size: number; readonly type: string; arrayBuffer(): Promise<ArrayBuffer> }
interface UploadSignal { readonly aborted: boolean; addEventListener(type: 'abort', l: () => void): void; removeEventListener(type: 'abort', l: () => void): void }
```

`UploadFile` and `UploadSignal` exist because core is compiled without the DOM's
types. A browser's `File` and `AbortSignal` fit them as they are. An adapter may
type its own parameters as `file: File` and
`request: UploadRequest & { signal?: AbortSignal }`, and then pass them straight
to `fetch` or a storage SDK. This was checked against the DOM's types.

In plain words:

- When the source has `upload`, a file field stores each file **as soon as it
  is picked**. Photos are shrunk first; the `file` passed in is then the shrunk
  one. The field keeps the returned link, never the bytes. When the source has
  no `upload`, files are read into base64 inside the record, as today.
- **A new record.** `recordId` is `null`. The source keeps the file, and the
  record's first save links it: the save carries the field's
  `{ url, fileId }` values, which the adapter connects to the record.
- **A saved form placed in a record.** Its files are the record's: `model`
  and `recordId` are the record's, and `field` is the file field's place in
  the answers the record keeps under the part's name (`consent.deed`; a
  table's line in it has `line.field` `consent.rooms`). The record's save
  waits for them and stops for one that failed, as for its own.
- **Progress.** The field draws a bar from `onProgress(sent, total)`. A source
  that never calls it gets a bar that moves without a number.
- **Failure.** Throwing any error offers **Retry**. Throwing
  `saveRefused({ kind: 'rule', message })` means the store refuses this file
  (its type, its size); the field shows the message and offers no Retry,
  because trying again cannot help. Lanes read this with `saveProblemOf`.
- **Stopping.** When `signal` aborts, reject with an error named `AbortError`.
  The field drops the file without calling it a failure.
- **Why `fileId` and not `id`.** Rules, filters, steps and list cells treat any
  object that has an `id` as a link. For example, `asRead` in `run.ts` would
  read the file as its id instead of its name. Giving the file's id its own
  name keeps those readers correct with no changes. (The first sketch of this
  contract said `id?`.)

## 5. Every id a search matches (Wave 2, lane E)

```ts
interface ListRequest { /* …as before… */ allIds?: boolean }
interface ListResult  { records: ListedRecord[]; total: number; allIds?: RecordId[] }
interface ListedRecord { id: RecordId; values: Values; version?: RecordVersion; can?: RecordPermissions }
```

With `allIds: true`, the list returns the ids of every matching record, in the
list's own order, alongside the one page of records. Ask with `limit: 0` to get
the ids alone. A source that ignores `allIds` still works: the page goes through
`list` page by page instead. If `allIds` is shorter than `total`, the source
stopped early, and the page has to say so instead of claiming "all". Each row's
`version` lets a bulk edit save that row with the version it was listed at.

## 6. Totals (Wave 2, lane F)

```ts
totals?(request: TotalsRequest): Promise<TotalsResult>;

type TotalKind = 'sum' | 'avg' | 'min' | 'max' | 'count';
interface TotalsRequest {
  model: string;
  filter: ResolvedFilter[];                  // the list's search, as list gets it
  totals: Record<string, TotalKind[]>;       // { amount: ['sum'], hours: ['sum', 'avg'] }
  groupBy?: string;                          // totals under each value of this field as well
}
type Totals = Record<string, Partial<Record<TotalKind, number | null>>>;   // totals.amount.sum
interface TotalsResult { count: number; totals: Totals; groups?: TotalsGroup[] }
interface TotalsGroup extends Group { totals: Totals }   // value, label, count, as groups() gives them
```

In plain words:

- When the source has no `totals`, the list shows no totals row (hidden, not
  empty).
- The **sum of the ticked rows** reuses the same call: add
  `{ field: 'id', op: 'in', value: tickedIds }` to the filter. Lists already
  send this condition.
- Groups come back in the same order as `groups()` returns them, so the page
  can pair them up by `value`.
- **Empty sets.** The sum and the count of no records are 0. The average, the
  minimum and the maximum of no records are `null`.
- **A total that can't be made honestly** is `null`, for example amounts in
  more than one currency. The page then shows no total for that field rather
  than a wrong one. `count` means records that hold a value in that field.
- Lane F adds `interval` (month, quarter, year) for Group By month. It goes on
  `GroupRequest` and `TotalsRequest` together. That is an additive change
  inside one lane, so it is not declared here.

**Added by lane F (Wave 2)**, each optional, as everything here:

```ts
type DateInterval = 'day' | 'week' | 'month' | 'quarter' | 'year';
interface GroupInterval {
  interval?: DateInterval;   // a date's records by the span they fall in; each group's value the span's first day, "2026-03-01"
  weekStart?: number;        // with "week": the day a week starts on, 0 Sunday to 6 Saturday (the page's language's)
  timeZone?: string;         // for a date and time: the IANA zone its days are told in (the page's)
}
interface GroupRequest extends GroupInterval { model; field; filter }
interface TotalsRequest extends GroupInterval {
  /* …as above… */
  currencies?: Record<string, string>;   // { amount: 'currency_id' }: totalled within one currency only
}
interface TotalsResult { /* …as above… */ currencies?: Record<string, JsonValue> }  // the currency each is in; null over several
interface TotalsGroup extends Group { totals: Totals; currencies?: Record<string, JsonValue> }
```

- **Group By a date.** With `interval`, the groups come in time order, those
  with no date last, each `value` the first day of its span (`spanStart` from
  `@fieldia/core` counts one as the list does). The page writes the words
  ("March 2026", "Q1 2026", "Week 12, 2026") and opens a group with `>=` and
  `<` on its first day and the next span's. A source that leaves `interval`
  out groups by the value itself, and the page shows those groups as they are.
- **Money.** An amount named in `currencies` is totalled within one currency:
  over records in more than one, its sum, average, least and most are null,
  and `currencies[field]` is null; otherwise it names the currency (a link as
  `{ id, label }`). A page writes a money total only in a currency it knows —
  the field's own `currency`, or the one the answer names — so a source that
  does not fill `currencies` shows no money total, never a wrong one.
- **Periods** ("This month", "Overdue") reach `list`, `groups` and `totals`
  as plain conditions: `>=` and `<` on days for a date, on the days' first
  moments (instants) for a date and time; nothing new for a source.

## 7. The memory data source

`createMemoryDataSource(options)` implements all of the above. What a
**default** memory source does has not changed: load returns bare values, and
saves are not checked.

| Option or member | What it does |
|---|---|
| `versions: true` or `{ by: 'Sara' }` | Each load returns `loadedRecord(values, { version })`, and each save moves the version on and names `by`. A save that carries an older version throws `ConflictError` with `theirs`. |
| `ds.changeElsewhere(model, id, values, { by: 'Mona', at? })` | Changes a stored record as another person on another screen would, so a page opened earlier gets a conflict when it saves. Returns the new version. |
| `can: { lead: (values, id) => RecordPermissions }` | Adds `can` to each load, list row and save result, and enforces it the way a backend would. A save, delete, archive or copy that is not allowed is refused with `reason`. A change to a read-only or hidden field is refused as a `fields` problem. Values of hidden fields are left out. |
| `list({ …, allIds: true })` | Returns `allIds` in the list's order. |
| `totals(request)` | Sum, average, minimum and maximum of the numbers, and a count of the records that hold a value, overall and per `groupBy` group (by `interval`, for a date). An amount named in `currencies` is totalled within one currency only, the currency told beside it. |
| `groups({ …, interval })` | A date grouped by the span it falls in: its first day each group's value and label, in time order, nothing last. |
| `upload(file, request)` | Returns a `data:` link (so a preview needs nothing else), with `fileId` counting up from 1. With `delayMs`, it reports progress in four steps; it obeys `signal` and rejects with `AbortError`. |

## 8. Not in this contract

- **Bulk write.** Lane E needs a way to save one change to many records and
  report which ones failed. It is not declared here because E is the only lane
  that touches it. The suggested shape is
  `writeMany?({ model, ids, values, fields }) → { failed: { id, message }[] }`,
  with `save` per id as the fallback.
- **Group By month** (`interval`): lane F adds it; see section 6.
- **Documentation.** Each lane documents its own feature on the site
  (`site/pages/data.mjs` lists the data source methods) and in the package
  README. This commit adds nothing to the site, because none of these additions
  does anything a visitor can see yet.

## 9. Merging the lanes

- `tools/script-bundle.mjs`: this commit raises the script budget by 3.4 KB
  (to 525.2) and the gzipped budget by 1.4 KB (to 159.4), with the reason
  written next to each. Every lane that raises a budget adds its own reason line
  under these. Those lines will conflict at merge; the fix is to keep every
  reason line and add up the increases.
- `form.ts`: this commit changes only the one `load` line, which now goes
  through `loadedRecordOf`. Lane w1-save takes `version` and `can` from that
  line.
- New tests for these additions go in `data-source-contract.spec.ts` or in a
  lane's own spec files, not in `memory-data-source.spec.ts` (this commit
  changed only its two loads there), so the lanes don't edit the same blocks.

## 10. One check before a form's values go (save safety, round 5)

Round 4 put one check in the form, `form.leave()`, and routed every way out
through it. Its last review found the remaining class was **concurrency**: a
way out taken while a save was on its way skipped the check, and the save's
late answer landed on whatever record was shown; work typed while a page in
place waited, or a file landing after a save, went uncounted; flags kept by
runs leaked to the next record. Round 5 removes the race instead of chasing
cases, in three parts.

**1. Serialised.** Every way out — `form.leave()`, and so every route below —
first waits for a save on its way and files on theirs to settle, the page saying
what it waits for (`state.leaving`); then it looks at the record **as it is
now**; then it asks, or goes on. A second way out taken while one waits joins
that wait and that answer: it never starts another. A way out taken by the
save's own `beforeSave` steps does not wait for the save that runs them.

**2. Generations.** Each record shown — opened, loaded again, a new one — is a
generation of its own. A save's answer (its `recordId`, `version`, values) is
laid on the form only while the generation it was started in is still shown; a
late answer for a record replaced meanwhile is dropped from the form (the data
source has it) and never lands on another record. The same holds for a run of
steps: it is on the record shown as it starts, and moves on with the records
its own steps show (a `call`'s `{ record }`, Duplicate's copy, a reload). Shown
another by anything else — the pager, the app — it stops before its next step,
and a `call`'s answer, or an opened page's `into`, that comes back meanwhile is
dropped: an afterSave run of record 1 never writes on record 2. A save on its
way when the person's own Discard resets the form still lands, as the record it
stored, never with the reset values laid over it.

**3. Work at risk** (`workAtRisk(state)`, `state.unsent`), worked out from the
record as the last finished save of this generation left it (what it sent and
what came back; a page of answers: what it sent) — never from flags kept by
runs:

- every change **of the person's** that the last finished save did not send:
  typed while it was on its way, while the run that saved went on (its afterSave
  run, Duplicate's copy, a `call` after the save), or since. A value set by a
  step, a rule, a compute, an afterSave run or the app is never the person's;
  each change is told by its origin (the `change` event's `by`);
- a file the person picked that the store holds and no save sent yet (only
  where the data source has `upload`), and files still on their way;
- changes Reload set aside.

Before the first save of a generation, a change of the person's not saved is
not at risk, as in 0.20: the pager and Save & Close save it, Discard and a
page's own `close` or `reload` let it go. The next record starts with nothing
at risk, whatever the last one held.

With work at risk, the check asks "Discard your changes?" through the host
(`ask(message, { discard: true })`: Discard words Yes, the focus on Cancel),
else `confirm`. Cancel keeps the person where they are, with their work;
Discard stops the files, lets the changes set aside go, and goes on. Without a
host or `confirm`, work at risk is kept. `leave({ changes: true })` counts every
change not saved (a panel's Escape, as always); `leave({ discard: true })` is
the person's own Discard: it waits like any way out, and asks nothing.

**For an app with none of 0.21's new members:** with no save on its way, every
way out behaves as in 0.20 until the person has a change the record's last save
did not send — typed while it was on its way, while the steps after it ran, or
since. Before the record's first save, nothing typed is at risk. **The one
deliberate change:** a way out taken while a save is on its way now waits for
that save. That is what keeps one record's values from being written over
another's.

**Every API that replaces or abandons a form's values, and its route.** Each
row has a unit test that fails without the check (core
`libs/core/src/lib/record/serial.spec.ts`, viewer
`libs/viewer/src/lib/serial.spec.ts`, besides the round-4 specs).

| # | API | Route |
|---|---|---|
| | **core: the form** | |
| 1 | `form.openRecord(id)`, any id or null for a new record | the check at its start; false when kept |
| 2 | `form.load()` called again by the app | the check, then the load (the first load has nothing to lose) |
| 3 | `form.leave(how)` | the check itself |
| 4 | `form.reset()`: the Discard buttons, a page of answers' Submit another | the person's own Discard: no question, as in 0.20; a save on its way lands as stored (part 2) |
| 5 | `form.reloadTheirs()` (a conflict's Reload) | the person's own choice: waits for a save on its way, then loads; their changes set aside are at risk |
| 6 | `form.keepMine()`, `form.restoreDraft()`, `form.putBack()`, `form.setValues()` | write values, replace none: no check |
| 7 | `form.dispose()` | the app's: nothing can keep the person; an answer landing after is dropped |
| 8 | a saved form placed in a record (`form.embed`): its own ways out | the record's check |
| | **core: steps** (a button's, a moment's — afterSave included — `form.run`) | |
| 9 | `reload` step | the check, then the load |
| 10 | `reset` step | the check, then `form.reset()` |
| 11 | `close` step: the host's `close` — the viewer's dialog, panel or page in place, or **the app's own** (`host.close`) | the form takes the host's close once, where it is made: the check first |
| 12 | `openUrl` step in this tab (`newTab: false`) | the check first; a new tab leaves the form as it is |
| 13 | `archive` / `unarchive` step, gear Archive | the check before archiving, then `reload` (9); archived once another record is shown, that one is not loaded again: the run stops |
| 14 | `duplicate` step / gear Duplicate, copied by the source | saves the changes first (0.20) — not on a record the person may only read: asked instead — the check before the copy, then `openRecord` (1): a change typed during the copy is asked about; copied once another record is shown, the copy is told and not shown |
| 15 | the same through the app's action (no `copy`) | saves first, the check, then its answer's `{ record }` (17) |
| 16 | `delete` step / gear Delete | the person chose it: once deleted, their work goes with the record, unasked; refused, it stays. Then `openRecord(null)` or the pager's next. Another record shown while it is deleted is asked about as any, keeps what is typed in it, and stays: the pager counts one fewer |
| 17 | an action's answer `{ record }`: a `call` step, a button's `action`, the gear's app action | `openRecord` (1) |
| 18 | an action's answer `{ reload: true }` | (9) |
| 19 | `open` step (`as` page, dialog or panel) | this form's values stay; the opened page's ways out are rows 27–33; its `into` and `then` only on the record that opened it |
| 20 | a wizard's Next, Back, Skip, `goTo` | the values stay: nothing to check |
| | **viewer** | |
| 21 | the pager: Previous, Next, Alt+P, Alt+N | the next id looked up, then its save of the changes and files (0.20) — none on a record the person may only read — then the check, then `openRecord` |
| 22 | the pager after a delete | (16) |
| 23 | breadcrumbs: `open`, or an `href` clicked plainly | the check, then the app's way |
| 24 | the app's breadcrumbs inside a page opened in place | that page's check, then the opener's (each page in place adds its own) |
| 25 | `handle.reload()` on a record | (9) |
| 26 | `handle.destroy()` | the app's: as (7) |
| 27 | a dialog (`openFormDialog`): Save & Close, Ctrl+Enter, a footer button whose run saved | the check, then it closes, saved |
| 28 | a dialog's Escape and × | the check; a panel, a dialog round a page with a head, or a dialog of values (a line's own form, which nothing else saves): `{ changes: true }` |
| 29 | a dialog's Discard | `{ discard: true }`: stops the files on their way, waits for a save on its way, asks nothing; a save that went through closes saved |
| 30 | a dialog's `close` step | (11) |
| 31 | a side panel (`openFormPanel`) | as a dialog (27–30) |
| 32 | a page opened in this one's place: its save or send (once its afterSave ran), Back, its own crumb, its `close` step | the check, then back; saved once a save went through |
| 33 | related records' Create and edit…, a link opened, a line's record, a payment (`pageDialogs().openRecord`); a line's own form (`editValues`: Done, Escape) | a dialog (27–29) |
| 34 | the edit switch's Done | the values stay: it saves the changes and files first, and with work at risk stays editable and says so |
| 35 | a page of answers' Thank you | the values stay: with work at risk it stays, and says so |
| 36 | the changes set aside: × (let them go) | the person's own: asked, then let go |
| | **React, Vue, Angular** | |
| 37 | `<FieldiaForm>` / `<fieldia-form>` unmounted; a prop that mounts it again (`page`, `form`, `dataSource`, `recordId`, `user`, `context`, `dir`, `locale`, `labels`, custom fields, slots) | the framework's: nothing can keep the person there. The app calls `form.leave()` (the handle's `form`) before it navigates or changes those props, as each wrapper's README says |

A save that went through is reported as saved by every later exit of the
dialog, panel or page in place it was made in — Discard, Escape, ×, Back, a
`close` step: `{ saved: true }`, with the record's id, and its values as saved:
Discard lets the person's changes no save took go back to the record as the
last save left it (what steps and the app wrote since stays).

**Round 6 (after 0.23.0): the rule held for every answer.** An adversarial check
of 0.22's save safety found the generation rule kept for a save, a `call` and an
`open`, and not for the other answers that write on a form or act on its
record. Now it is one test, `form.recordShown()` — taken as an answer is asked
for, true while that record is still shown as it was (no other opened, it not
loaded again, no new one, the person's Discard not pressed, the form not
closed) — and every such answer passes it or the runner's own generation check:
an onchange's; Keep mine's read and Reload's; Archive's, Duplicate's and
Delete's (`recordStep`); a button's question; a change's steps run again after
their run; a check or a step forward waiting for a name; a save's own waits
before it is sent; a step's own reload or record (`showRecord`), replaced
before it ended; the files of a record replaced (stopped with its
generation). In the parts: a name a box looks up (`readWords`, the path
picker's), a record made from a link or picked in a dialog, a line's dialog, a
link's record opened and renamed, a file read inline, a signature's picture, a
picture read into formatted text, a statusbar's save, the pager's next id, a
wizard's step, a map's address from its point, a place found, a route and a
reachable area (`whileShown`, `stillShown` in `@fieldia/widgets`). And:

- **The person's claim, at the grain steps write.** A table is claimed by the
  lines the person changed, added or took away: a step's `addLine` leaves
  their lines theirs, and a line changed back is no longer at risk. A write
  that works the person's change out — the source's onchange, the page's
  `change` steps it sets off — keeps their claim and makes nothing else
  theirs; any other step's, rule's or app's write of the whole field takes it
  over, as before. (Keeping every claim against every step would ask about
  values an afterSave run wrote; claiming by the whole field lost a line's edit
  to a line a step added.)
- **A conflict waiting is at risk** (`workAtRisk`): the person asked for those
  changes to be saved. Only a source with versions has one.
- **A record its own save locked** (`can.edit: false`) is never saved again by
  the pager or Duplicate: what was typed in it is asked about.
- **The browser's own ways out**: `warnOnLeave` (viewer and wrappers, off by
  default) asks through `beforeunload` while `workAtRisk(state, { changes:
  true })`, listened for only then.

Removed with round 5: `taking`, the runs set and each run's `saved` flag, and
the `lastSent` of a page of answers. `state.unsent` is worked out on every
change from the record as last saved; nothing else keeps it.

**Checked once by mutation** (lane w1-serial): the check taken out of one
route at a time, and the core and viewer save-safety specs run against it. At
least one test failed for every route: rows 1 and 17 (`openRecord`, 19
tests), 2, 3, 9/18/25 (`loadAgain`), 10, 11/30, 12, 13, 14/15 (the check
before the copy), 8 (the record's check for a saved form placed in it), 16
(a delete the app's action refuses keeps the work), 21 (the pager, with both
its own `leave()` and `openRecord`'s check taken out: each alone is enough),
23, 24, 27/28, 29 (Discard waiting; a page of answers sent reporting saved),
32, 34, 35, and a panel's Escape counting every change. So did each part of
the design: waiting for the save on its way, a second way out joining that
wait, a save's answer and a `call`'s answer dropped for a replaced record, a
run stopping on one, a reset during a save landing as stored, work at risk
told against the last finished save, the next record starting with none, and
a file landing late counted. The one line no test notices is a saved form's
own `close` handing to the record's: the form placed in a record is made with
the record's host, and its check is the record's already (row 8), so either
way it closes through the same check.

## 11. Many records made at once, and an import the server takes (Wave 3, lane w3-import)

A list's Import (`ListNode.import`) makes records from a file's rows. It needs two
optional members, proposed here in this contract's style and implemented in
`createMemoryDataSource` (`createMany`; `importRecords` is left to an app, as
`exportRecords` is). Without either, Import works as it does: `save` per row.

```ts
createMany?(request: CreateManyRequest): Promise<CreateManyResult>;
importRecords?(request: ImportRequest): Promise<{ message: string } | false>;

interface CreateManyRequest {
  model: string;
  records: Values[];   // each record's values, in the file's order: what its row fills, the page's defaults for the rest
  fields: Fields;      // the page's fields, as a save gets them
}
interface CreateManyResult {
  // one answer per record asked for, in the same order: its new id, or why it was not made
  records: ({ id: RecordId } | { message: string; problem?: SaveProblem })[];
}
interface ImportRequest {
  model: string;
  file: UploadFile;                                   // the file as picked: a browser's File fits
  columns: { header: string; field: string | null }[]; // each column, and the field the person matched it to
  rows: number;                                       // how many rows under the header
  fields: Fields;
  locale: string;
  dateOrder: 'dmy' | 'mdy' | 'ymd';                   // so a server reads the cells as the page would
}

function newRecordSave(model: string, fields: Fields, values: Values): SaveRequest;   // a new record's save from its values alone
```

In plain words:

- **`createMany`** is `writeMany`'s create counterpart: many records, each with its
  own values, a few hundred at a time (the list sends 500 a call). It answers each
  record in order, so the list can name a refused one by its row, and keep the ids it
  made for Undo. A record left unanswered is taken as not made. A refused record's
  `problem` is read as a save's is: a field's own words first (`problem.fields`).
- **Without `createMany`**, the list saves each row as a new record, four at once:
  `save(newRecordSave(model, fields, values))` — every value in `values`, a
  many2many's links as one `set`, the rest as changes, `id: null`. The memory source's
  `createMany` makes each record the same way, so a source can answer one by calling
  its own `save`.
- **Stop** ends the writing between two calls (or two saves): what was made stays
  made, and the list says how many of how many.
- **Undo** deletes the records the import made through `delete`, four at once,
  naming those it could not with why. Without `delete`, no Undo is offered.
- **`importRecords`** is `exportRecords`'s counterpart: the list asks it once the
  person has matched the file's columns, before any row is checked. `{ message }`
  means the server took the file (the list says the words); `false` lets the browser
  import it after all. A file past the browser's most rows (50,000) is imported only
  where the source takes it; otherwise the list says so plainly, and nothing is
  written.
- **What the browser checks first** (before `createMany` or `save` sees a row): each
  cell read as its field's box reads what is typed, a link by its name through
  `search` (`exact` asked where an answer came back full), a choice from an app's list
  through `options`, then `checkValue` with the field's `required`. A source still
  checks what it is sent, as it checks a save: its refusals are named by row too.

## 12. Possible duplicates and Merge (Wave 3, lane w3-duplicates)

Two more members, each optional as everything here: without `duplicates` nothing
is asked and nothing shows; without `merge` no Merge is offered.

```ts
duplicates?(request: DuplicatesRequest): Promise<DuplicatesResult>;
merge?(request: MergeRequest): Promise<MergeResult | void>;

interface DuplicatesRequest {
  model: string;
  recordId: RecordId | null;   // the record typed — never its own duplicate; null while new
  values: Values;              // every value of the form, a phone as E.164 where the page reads phones so
  fields: string[];            // those the page names (`duplicates.fields`) that hold a value now
}
interface DuplicateMatch { id: RecordId; name: string; why: string[]; score?: number }   // why: the fields it matched on
interface DuplicatesResult { matches: DuplicateMatch[] }
interface MergeRequest {
  model: string;
  keepId: RecordId;            // the record kept
  mergeIds: RecordId[];        // merged into it, then gone
  values: Values;              // the value picked for each field the records held apart
  fields: Fields;              // the page's fields, as a save gets them
}
interface MergeResult { message?: string }   // the source's own words, said once merged
```

In plain words:

- The page asks for them (`"duplicates": { "fields": [...], "on": "type" | "save" }`,
  page format 0.4, which 0.3's shape grew into by adding). `on: "type"` (the default) asks a
  moment after typing stops in a field named, as a saved record opens, and as the
  record is saved; `"save"` only as it is saved. The form's
  `findDuplicates()` asks with the fields named that hold a value — none, and
  nothing is asked — and drops a match naming the record itself.
- **An answer is for the record it was asked for** (`form.recordShown()`), and for
  the values as they were: typing on in a field named leaves it unheard. Nothing is
  in the way of a save: a duplicate is said, and Save saves — a source that refuses
  duplicates refuses the save itself (`saveRefused`).
- **Merge** saves what is typed first (as Duplicate does), reads the record found
  (`load`, through `form.readRecord`), and shows the two side by side, a value
  picked for each field they hold apart. `merge` keeps `keepId` with `values` and
  takes `mergeIds` away; moving what was theirs — messages, activities, links — is
  the source's work, and the page says it will happen. Refused with
  `saveRefused({ kind: 'rule', message })`, nothing changes and the screen says why.
- The memory source: `duplicates` answers through its `duplicates` option —
  `alikeRecords()` (full `@fieldia/core`, outside the one-tag script, as
  `scheduleSlots` is) finds the same value as people write them apart, or a name
  close enough — else none; `merge` writes the values picked, takes the others
  away, and moves every link to them (by id and name) to the one kept, refusing as
  a backend would where the person may not change the kept one or take one away.
  Tests: `libs/core/src/lib/record/duplicates.spec.ts`.

## 13. "It's someone new" kept on the app's server (0.27, lane loose-0262)

Two more members, a pair, each optional as everything here: with both, what a
person lets be on a possible duplicate is kept by the app's server; without
both, in the person's browser (the viewer's `preferences`, `duplicates.<model>`),
as in 0.26.

```ts
notDuplicates?(request: NotDuplicatesRequest): Promise<RecordId[]>;
markNotDuplicate?(request: MarkNotDuplicateRequest): Promise<void>;

interface NotDuplicatesRequest {
  model: string;
  recordId: RecordId;          // the record shown, saved
}
interface MarkNotDuplicateRequest {
  model: string;
  recordId: RecordId;          // the record shown, saved
  matchId: RecordId;           // the record found like it, which is someone else
}
```

**Why a pair of its own, and not the ids let be handed in `duplicates`.** What
was let be lives somewhere: in a browser it never reaches another device, so
handing the browser's list in the `duplicates` request would only hand a second
device's empty one. The server has to keep it — and the app's duplicate finder (a
search index, a matching service) need not be what keeps it, nor be changed to
leave those out: the pair is a small store of the app's own (a table of two ids),
read once as a record is shown, and the browser leaves out what it lists. A server
whose `duplicates` already leaves them out loses nothing by it.

In plain words:

- **When they are asked.** `notDuplicates` as a saved record is shown, before its
  possible duplicates are said: the first matches wait for it, so a match let be
  on another device is never said here, even for a moment. Asked once for the
  record shown (`form.recordShown()`); an answer for one no longer shown is laid
  on none. `markNotDuplicate` as the person presses "It's someone new" on a saved
  record; on a new record, once it is saved with its id — once for each match let
  be while it was new.
- **A pair.** Nile Traders is someone else for Nile Traders Co. as much as the
  other way round: a source may answer from either side (the memory source does).
  `form.notDuplicates()` leaves out the record itself and anything that is no id.
- **Failing.** `notDuplicates` that throws: the matches are said as found, but
  those this browser kept (0.26's, or refused below). `markNotDuplicate` that
  throws: the browser keeps it, as without the pair; nothing is said.
- **The browser's store** is still read where the source has the pair, so what
  was let be in 0.26 (by the record's id, or 0.25's `id|field=…`) stays let be.
- **The form**: `form.keepsNotDuplicates()` (both members there),
  `form.notDuplicates()` (the record shown's, none while it is new),
  `form.markNotDuplicate(matchId)` (refused while it is new).
- **The memory source** implements both over `notDuplicatePairs` (by model, each
  pair `[recordId, matchId]` as kept, once whichever side said it, never a record
  and itself; a record it does not keep refused), and starts from the option of the
  same name. The demos keep its pairs in the tab, as they keep records
  (demos/shared/kept.ts), so a page the demo opens — another device, its
  browser's store empty — reads them from the same "server". Tests:
  `libs/core/src/lib/record/duplicates.spec.ts`,
  `libs/viewer/src/lib/duplicates.spec.ts`, `e2e/duplicates.spec.ts`.

## 14. A signature's evidence, kept in its value (Wave 4, lane w4-signature)

No new member: a signature that signs answers (its node's `options.signs`) keeps its evidence in the value a file field
already has, beside its picture, so every source that keeps a file value keeps it.

```ts
interface FileValue { /* …as before… */ signed?: SignatureEvidence }
interface SignatureEvidence {
  format: string;     // the canonical form: "fieldia-signature/1"
  by?: string;        // who signed, as named
  at: string;         // when, ISO 8601 in UTC: "2026-10-19T08:42:00.000Z"
  fields: string[];   // the answers signed, by field name
  sha256: string;     // SHA-256 of the canonical text, small hex letters
}
```

In plain words:

- **Keep it whole.** A save sends the value with `signed` in it, as it sends a typed name's `text`. A source that stores
  the picture through `upload` gets the bytes there, and the save carries `{ url, fileId, …, signed }`: an adapter that
  keeps signatures as bytes in a binary column (Flectra's) keeps `signed` beside them — a JSON column, or a record of
  its own — and hands it back on `load`. Without it the signature is a picture, as before, and nothing is locked.
- **Lock what it signed.** While a value with `signed` is kept, the form locks the answers it names (`signedBy`), on
  the record's load too. A source that wants to refuse a change to a signed answer refuses it in `save`
  (`saveRefused`), as it refuses any rule.
- **Check it on the server.** The canonical text (`signatureText`, @fieldia/core's README) is written from the record
  the source keeps; its SHA-256 equal to `sha256` says the signed answers are as signed. The memory source keeps the
  value as it is given.

## 15. Counts beside filters, and ranges (Wave 4, lane w4-filters)

A list's filters say how many records each finds (`filterCounts`), take a number's or a date's range as one chip
(`filterRanges`, a custom filter's "is between"), and on a phone fold into a sheet whose Show says how many records it
will show (`filterSheet`). **No new member**: every count is asked of what a source already has, so an adapter that
groups and totals counts filters too, and one that has neither shows no count (hidden, never wrong).

```ts
// A value's count in a filter bar's list: the field grouped under the rest of the search — every other field's
// values and ranges, the keyword, the list's fixed conditions; never the field's own ticks.
groups({ model, field, filter })                       // Group.count, by Group.value

// A named filter's, a favourite's and the sheet's Show: the records a search finds.
totals({ model, filter, totals: {} })                  // TotalsResult.count
list({ model, fields: [], filter, sort: [], offset: 0, limit: 1 })   // without totals: ListResult.total

// A range, one value of a field facet, as it reaches every member above and `list` itself:
// { op: 'between', value: [from, to] } → { field, op: '>=', value: from }, { field, op: '<=', value: to }
// { op: '>=', value: from }, { op: '<=', value: to } → as they are
// a date and time's range of days → '>=' its first day's first moment, '<' the first moment of the day after its
// last, in the field's zone (the list's `RangeDays`); a date's days compare as they are
```

In plain words:

- **Why no member of its own.** A count is a group's or a total's: `groups` already counts each value of a field
  under a filter, and `totals` already counts the records a filter finds. A member that asked several counts at once
  (`counts?({ model, filters: ResolvedFilter[][] })`) would save a menu's few calls a round trip each; it can be
  declared later without changing these, should a source need it.
- **A record of links** (a many2many) is grouped under each of its links, as a server groups tags — a record with
  Garden and Pool counts under both, one with none under nothing — and Group By opens such a group with `contains`.
  The memory source does so. A source that grouped a many2many by its whole set before gave headings no one could
  open; one that does as described needs nothing new.
- **`between` never reaches a source**: `facetsToFilter` writes a range as `>=` and `<=`, which every source reads,
  so an adapter that never met `between` in a list's search still filters by a range.
- **When counts are asked**: a filter bar's list as it opens (the field's values grouped under the fixed conditions
  alone, their counts under the rest: one call where the two are the same); the search bar's named filters and
  favourites as its menu opens, and again as the search changes while it is open; the sheet's every field and its
  Show as it opens and on each change. An answer older than the last change is dropped.
- **Without `groups`** a filter bar lists a choice's and a yes or no's values with no count, and a link's or text's
  none, as before; **without `totals` and `list`**, Show says "Show results" and the menu no number.

## 16. What a send is answered with (Wave 4, lane w4-endings)

A page of responses' ending says what the app's server answered as it kept the
response — "Your booking is B-1043" — so `submit`'s answer, which the form threw
away, is kept:

```ts
interface SubmitResult {
  id?: RecordId;               // the reference the app gave the response: "B-1043"
  values?: Values;             // values it worked out as it kept it, by the page's fields
}
// FormState gains sent?: SentResponse | null; Form gains words(text), ending(), endingWords(text);
// FormOptions gains valueWords?(field, value, values): how a value reads inside the page's words.
interface SentResponse { id: RecordId | null; values: Values }   // the answers sent, `values` laid over them
```

In plain words:

- **Kept, not written back.** The form keeps the answer as `state.sent` once the
  send lands — the answers as they went, the source's `values` laid over them —
  and the page's `endings` read it (`form.ending()`): the first whose `when` holds
  on those values with `id` as the response's id, else the one with no `when`. The
  form's own values stay as sent: nothing changes, nothing is dirty, no step runs.
  `reset()` (Submit another) clears it.
- **Late answers.** An answer for answers no longer shown — the form started
  again while the send was on its way, or another record shown — lays nothing.
- **Optional.** A source that answers `{}` or nothing gives an ending with no
  reference (`{id}` reads empty) and the `id` built-in null; one that gives no
  `values` changes nothing of the answers. The `send` event is as it was.
- The memory source answers `{ id: n }` (the response's number), or as its
  `submitted?(request, count) => SubmitResult` option says, for demos that show a
  reference. Tests: `libs/core/src/lib/record/endings.spec.ts`,
  `memory-data-source.spec.ts`.

## 17. A table line's choices from the app's lists (Wave 4, lane w4-line-choices)

No new member: a line's selection may now take its options from one of the app's
lists (`optionsFrom` on a line field, refused there until 0.27), and the existing
`options` member is asked for it, with one more optional field in its request.
Without `options`, such a cell says the list is missing (`No list "…"`) and offers
to load it again, as a page's own field does.

```ts
options?(request: OptionsRequest): Promise<Option[]>;

interface OptionsRequest {
  list: string;    // the field's `optionsFrom.list`
  values: Values;  // a page's field: every value of the form; a table's line: that line's values
  parent?: Values; // a table's line, or a form editing one in a dialog: the record it is on; left out for a page's own field
}
```

In plain words:

- On a line, `optionsFrom.dependsOn` names the line's own columns, or `parent.` and
  a field of the record the line is on (`checkPage` refuses a column the line does
  not have, a field the record does not have, and the column itself).
- **Asked by the line's values, shared by lines alike**: lines whose `dependsOn`
  values are the same (a link by its id) share one ask, for the record shown; a
  failed ask is asked again next time. So the source answers by `values[dependsOn…]`
  and `parent[…]`, never by another value of the line.
- **Followed**: once a line's choices are loaded, a change on that line of what they
  change with asks again (the latest answer wins). After a change someone made — the
  person, a step, the app — a choice the new answer does not offer is taken out (of
  several, the rest kept) and said (`FormState.takenOut` by the cell's path, as an
  option a condition hides is, until the cell's value changes again), and told as a
  step's change (`change`, `by: "step"`):
  the person's claim on the line stays. A record that comes in with a choice its
  choices do not offer keeps it, said; `validate` and a save refuse it with "Must be
  one of: …". A page's own field with `dependsOn` takes out the same way (one rule
  for every choice from a list; 0.26 kept its value, said as no longer offered).
- **State**: `state.choices` keeps a line's by its cell's path (`field.lineKey.subfield`);
  `form.loadChoices(path)` asks for one; `form.lineChoices(field, key | null,
  subfield, values)` asks as a line would with `values` laid over it (a pasted row).
- **Paste and Import**: a block pasted reads such a cell among its own line's
  choices, the row's links and other cells read first (`PasteTable.choices`); a
  list's Import reads a page field's choice that follows another field by each
  row's own values (`RowsCheck.options(field, values)`), once for each such value.
- The memory source: a `lists` function is given the request after the values,
  `(values, request) => …`, so a line's list may read `request.parent`.
  Tests: `libs/core/src/lib/record/line-choices.spec.ts`.

## 18. Opening, closing, limiting; save and resume (Wave 4, lane w4-limits)

Three more members, each optional as everything here: without `limits` a page keeps to its dates alone and shows no
places left; without `saveDraft` and `loadDraft` no "Continue later" shows and drafts stay in the browser's store.

```ts
limits?(request: LimitsRequest): Promise<LimitsResult>;
saveDraft?(request: SaveDraftRequest): Promise<SavedDraft>;
loadDraft?(request: LoadDraftRequest): Promise<StoredDraft | null>;

interface LimitsRequest {
  pageId: string;
  model: string;                 // empty for a page of responses
  recordId: RecordId | null;     // the record edited: its own choices are not counted against it
  fields: string[];              // the choice fields whose options have `seats`
  user?: { id: RecordId | null; name?: string };   // as the app told the form; a server knows its own sign-in first
}
interface LimitsResult {
  responses?: number;                               // sent so far: what `limits.maxResponses` counts
  mine?: number;                                    // this person's: what `limits.onePerPerson` counts
  perChoice?: Record<string, Record<string, number>>;   // by field, by option value: how many hold it
}

interface StoredDraft {
  values: Values;                // the answers so far; where files are stored apart, no file's bytes
  step?: string | null;          // the wizard's step on screen
  skipped?: string[];            // the optional steps passed over
  unread?: Record<string, { text: string; message: string }>;   // text typed that does not read, as typed
  answered?: string[];           // the fields the person changed: where they got to
  savedAt: string;               // ISO
}
interface SaveDraftRequest { pageId: string; model: string; recordId: RecordId | null; key: string | null; draft: StoredDraft; later?: boolean }
interface SavedDraft { key: string; link?: string; message?: string }
interface LoadDraftRequest { pageId: string; key: string }

// SubmitRequest and SaveRequest gain draft?: string — the key of the draft the answers end.
```

In plain words:

- **The page asks** (`limits` on a page of responses: `opens`, `closes`, `maxResponses`, `onePerPerson`, `message`;
  `seats` on any page's options). `opens` and `closes` are the page's own, on its clock, read with no source at all;
  a day alone closes at its end. The form asks `limits` as it opens — and holds its questions back while it asks
  where the page counts responses (`FormState.limits.state` `asking`) — once a record is loaded, after every send, as
  it starts again, and again just before its answers go; an answer is laid only on the form it was asked for
  (`form.recordShown()`). Without `limits`, `maxResponses` and `onePerPerson` are not drawn on: the source's `submit`
  refuses as it would.
- **Places.** An option with `seats` shows the places left once `perChoice` tells how many took it ("3 left",
  "Full"); one the source told nothing of shows nothing. A full option is shown, and refused when the person picks it
  ("Afternoon workshop is full", under the field, the field keeping what it held); one that filled up while held
  stops the send ("… is full now: choose another"). The app's own `setValues` is never refused: the check says it.
- **Drafts on the server** are kept on a page with `continueLater` (or a form given `resume`), where the source has
  both members: a moment after typing stops (1.5 s unless `drafts.delayMs`), as a wizard's step is entered with
  answers typed, and on "Continue later" (`later: true`, answered with the app's `link` and `message`). One at a time:
  each carries the key the last was given. The browser's store (`drafts.store`), where the app gave one, keeps only
  `{ savedAt, key }`; a failure keeps the draft itself there instead. A page without `continueLater` keeps its drafts
  where it always did, whatever its source has.
- **Opening a draft** by its key (`FormOptions.resume`, the viewer's and the wrappers' `resume`): `loadDraft` as the
  form opens (`status` `loading`), its answers laid as a starting point, its step — or the nearest before it that
  still applies — and its text that does not read, kept unread with its words so the next check refuses it. Typed
  over meanwhile, it is offered (`state.draft`), never laid over what was typed. A key that names none:
  `resume.missing`, and the form starts empty.
- **Sent.** The send carries the draft's key (`draft`) once a draft on its way has gone; the memory source deletes
  it, as a server would. Nothing is kept as a draft after a send.
- The memory source: `limits` counts its responses (and `answeredElsewhere(pageId, values)`, someone else's) over the
  `limits` option's starting counts, a record page's model's records but the one edited; `saveDraft` keys drafts
  `draft-1`, `draft-2`… (`drafts` shows them, with `later`), with `draftLink(key)`'s link on "Continue later";
  `loadDraft` finds them, and the `drafts` option's. Tests: `libs/core/src/lib/record/taking.spec.ts`, `drafts.spec.ts`.

## 19. A list's cells changed in place (Wave 5, lane w5-editable-list)

No new member: a list whose cells are changed in place (`ListNode.editable`) saves each row through `save`, writes the
same change to several rows by `writeMany`, and reads a row again by `load` — every one a member the source already
has, asked as below.

```ts
// Each row a record's own form: the page's fields the list reads (and what its worked-out columns read), its values as
// the list has them — no load for what the list shows already — with the row's version and permissions.
list({ model, fields, filter, sort, offset, limit })        // ListedRecord.version and .can, as before
// The row left: the fields the person changed alone, as a save made outside a form (§2).
save({ model, id, fields, changes, values, partial: true, version })   // values and fields: the changed ones alone
// A row added at the end: a new record, whole.
save({ model, id: null, fields, changes, values })
// Rows of records given exactly the same change at once (one value pasted down a column), each passing the page's rules.
writeMany({ model, ids, values, fields, versions })
// A conflict's Reload and Keep mine reading theirs: the row as the source has it now.
load({ model, id, fields })                                 // else list({ filter: [{ field: 'id', op: '=', value: id }], limit: 1 })
```

In plain words:

- **Versions.** Each row's save carries the version it was listed at, or the one its last save answered: one changed
  since is refused with `ConflictError`, and said under the row as a record's page says it (save-safety: who and when,
  Reload, Keep mine, the changes set aside). A source with no versions is not checked.
- **Permissions.** A row whose `can.edit` is false is not opened; a cell of `can.readonlyFields` or `can.hiddenFields`
  neither. The source still refuses a save as it would.
- **Refused.** `saveRefused` and the page's own rules are said under the row, the typing kept until it is saved, put back
  (the row as listed or last saved), or the row left with nothing changed. A row with work kept that a new search, page
  or order no longer shows stays in sight at the end of the list until then.
- **`writeMany` where it helps**: rows of records given the same change (no lines, no links), none open for typing, each
  checked by its form; those it refuses are saved one by one, so each says why as a row does; then the list is asked
  again, for their versions. Without `writeMany`, each row is a `save`.
- **Worked out.** A computed column's fields are asked with the list's (`rowReads`), worked out as the cells are typed;
  `SaveResult.values` replace them. A value worked out from an answer the form refuses waits (0.28), said in the cell.
- **Late answers.** Each row's form keeps its own generation (§10): a save answered for a row put back or released lays
  nothing on it; a paste's names looked up after the list asked again write on none.
- **The memory source** answers all of it as it is; nothing new. Tests: `libs/core/src/lib/format/list-editable.spec.ts`,
  `libs/viewer/src/lib/list-editable.spec.ts`, `e2e/list-editable.spec.ts`.

