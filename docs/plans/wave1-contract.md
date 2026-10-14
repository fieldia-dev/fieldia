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
| `totals(request)` | Sum, average, minimum and maximum of the numbers, and a count of the records that hold a value, overall and per `groupBy` group. It does not know about currencies. |
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
