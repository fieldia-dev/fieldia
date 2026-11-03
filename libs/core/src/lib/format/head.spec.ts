import { checkPage, localizePage, pageWords, validatePage } from '../../index';

/**
 * A record's head in the page's format, as a work tracker draws a work item:
 * its kind's strip and badge from a field, the number before the title, a
 * row of people and a link ("1 Comment"), the record's buttons — split,
 * toggled, by their icon alone — a band of fields with an access key each and
 * a lock at the value, "Updated by", and the tabs in the head with their
 * counts. Every key is checked for its shape, then for what it names.
 */

const fields = {
  number: { type: 'integer', label: 'ID', readonly: true },
  work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
  title: { type: 'char', label: 'Title', required: true },
  assigned_to: { type: 'many2one', label: 'Assigned To', relation: 'res.users' },
  comment_count: { type: 'integer', label: 'Comments', readonly: true },
  state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
  reason: { type: 'char', label: 'Reason' },
  area: { type: 'char', label: 'Area' },
  changed_by: { type: 'many2one', label: 'Changed By', relation: 'res.users', readonly: true },
  changed_date: { type: 'datetime', label: 'Changed Date', readonly: true },
  following: { type: 'boolean', label: 'Following', readonly: true },
  related: { type: 'many2many', label: 'Related Work', relation: 'work.item' },
  notes: { type: 'text', label: 'Notes' },
};

type Json = Record<string, unknown>;

const head = (over: Json = {}): Json => ({
  kind: { field: 'work_type', numberField: 'number', looks: { bug: { colour: '#cc293d', icon: 'bug' }, task: { colour: '#f2cb1d', icon: 'task' } } },
  meta: [
    { type: 'field', id: 'h-assigned', field: 'assigned_to', labels: 'hidden', placeholder: 'No one selected' },
    { type: 'link', id: 'h-comments', icon: 'chat', field: 'comment_count', words: { one: 'Comment', other: 'Comments' }, target: 'notes-group' },
  ],
  actions: [
    { type: 'button', id: 'b-save', label: 'Save and Close', icon: 'save', primaryWhenChanged: true, steps: [{ do: 'save' }, { do: 'close' }], menu: [{ id: 'm-save', label: 'Save', steps: [{ do: 'save' }] }] },
    { type: 'button', id: 'b-follow', label: 'Follow', pressedLabel: 'Following', icon: 'eye', pressed: 'following', action: 'follow', menuIcon: 'gear', menuLabel: 'Notification settings', menu: [{ id: 'm-all', label: 'All changes', action: 'follow-all' }] },
    { type: 'button', id: 'b-undo', label: 'Revert changes', icon: 'undo', iconOnly: true, steps: [{ do: 'reset' }] },
  ],
  band: {
    tracks: ['274px', '1fr'],
    labelWidth: 76,
    children: [
      { type: 'field', id: 'f-state', field: 'state', widget: 'dot', hotkey: 'e' },
      { type: 'field', id: 'f-area', field: 'area', hotkey: 'a' },
      { type: 'field', id: 'f-reason', field: 'reason', readonly: true, readonlyReason: 'Set by the workflow' },
    ],
  },
  updated: { byField: 'changed_by', atField: 'changed_date', opens: 't-history' },
  ...over,
});

const tabs = (over: Json = {}): Json => ({
  type: 'tabs',
  id: 'wi-tabs',
  place: 'head',
  children: [
    { type: 'tab', id: 't-details', label: 'Details', children: [{ type: 'section', id: 'notes-group', title: 'Notes', children: [{ type: 'field', id: 'f-notes', field: 'notes' }] }] },
    { type: 'tab', id: 't-history', label: 'History', icon: 'history', iconOnly: true, children: [] },
    { type: 'tab', id: 't-links', label: 'Links', icon: 'link', iconOnly: true, count: 'related', children: [] },
  ],
  ...over,
});

const page = (sheet: Json = {}, look?: Json): Json => ({
  fieldia: '0.13',
  id: 'bug',
  data: { kind: 'record', model: 'work.item' },
  fields,
  layout: { type: 'sheet', id: 'bug-sheet', title: { field: 'title', before: [{ type: 'field', id: 't-number', field: 'number', labels: 'hidden' }] }, head: head(), toolbar: { menu: [{ id: 'm-delete', builtin: 'delete' }] }, children: [tabs()], ...sheet },
  ...(look ? { look } : {}),
});

const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const runtime = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a record head in the page format', () => {
  it('takes a whole work item’s head, and the quick check finds nothing either', () => {
    expect(problems(page())).toEqual([]);
    expect(runtime(page())).toEqual([]);
  });

  it('takes a lock at the value’s start as the page’s look, and refuses another place', () => {
    expect(problems(page({}, { skin: 'quiet', lockAt: 'value' }))).toEqual([]);
    expect(problems(page({}, { lockAt: 'label' }))).toEqual([]);
    expect(problems(page({}, { lockAt: 'beside' }))).toEqual([expect.stringMatching(/^look\.lockAt:/)]);
  });

  it('wants colours as #rrggbb, tracks in pixels, shares or what is left, and a label width a label fits', () => {
    expect(problems(page({ head: head({ kind: { colour: 'red' } }) }))).toEqual([expect.stringMatching(/^layout\.head\.kind\.colour: a colour is written #rrggbb/)]);
    const band = (over: Json) => page({ head: head({ band: { children: [], ...over } }) });
    expect(problems(band({ tracks: ['274px', '50%', '1fr', '2.5fr'] }))).toEqual([]);
    expect(problems(band({ tracks: ['wide'] }))).toEqual([expect.stringMatching(/^layout\.head\.band\.tracks\[0\]: a column is as wide as/)]);
    expect(problems(band({ tracks: ['1fr', '1fr', '1fr', '1fr', '1fr'] }))).toEqual([expect.stringMatching(/^layout\.head\.band\.tracks:/)]);
    expect(problems(band({ labelWidth: 20 }))).toEqual([expect.stringMatching(/^layout\.head\.band\.labelWidth:/)]);
    expect(problems(page({ head: head({ copyTitle: 'no' }) }))).toEqual([expect.stringMatching(/^layout\.head\.copyTitle:/)]);
  });

  it('refuses a key the head does not have, and a part of the row that is neither a field nor a link', () => {
    expect(problems(page({ head: head({ strip: true }) }))).toEqual([expect.stringMatching(/^layout\.head:.*strip/)]);
    expect(problems(page({ head: head({ meta: [{ type: 'button', id: 'x', label: 'X', action: 'x' }] }) }))).toEqual([expect.stringMatching(/^layout\.head\.meta\[0\]/)]);
  });

  it('checks what the head names: the kind’s field and its values, the number, the link’s field and target, the dates', () => {
    const wrong = page({
      head: head({
        kind: { field: 'notes', numberField: 'following', looks: { epic: { colour: '#000000' } } },
        meta: [{ type: 'link', id: 'h-x', field: 'title', words: { other: 'Comments' }, target: 'nowhere' }],
        updated: { byField: 'nobody', atField: 'title', opens: 'f-notes' },
      }),
    });
    expect(runtime(wrong)).toEqual(
      expect.arrayContaining([
        'layout.head.kind.field: "notes" is a text; a kind is a selection or a many2one',
        'layout.head.kind.numberField: "following" is a boolean; a record\'s number is a number or words',
        'layout.head.meta[0].field: "title" is a char; a link\'s words follow a number',
        'layout.head.meta[0].target: no part "nowhere" on this page',
        'layout.head.updated.byField: no field "nobody"',
        'layout.head.updated.atField: "title" is a char; when it was updated is a date or a datetime',
        'layout.head.updated.opens: no tab "f-notes" on this page',
      ])
    );
    const looks = page({ head: head({ kind: { field: 'work_type', looks: { epic: { colour: '#000000' } } } }) });
    expect(runtime(looks)).toEqual(['layout.head.kind.looks.epic: "epic" is not an option of "work_type"']);
  });

  it('claims the ids of the head’s parts with the rest of the page', () => {
    const twice = page({ head: head({ meta: [{ type: 'field', id: 'f-notes', field: 'notes' }] }) });
    expect(runtime(twice)).toEqual([expect.stringMatching(/duplicate id "f-notes"/)]);
  });

  it('takes a count that goes nowhere: its words alone', () => {
    const idle = page({ head: head({ meta: [{ type: 'link', id: 'h-x', field: 'comment_count', words: { other: 'Comments' } }] }) });
    expect(runtime(idle)).toEqual([]);
  });

  it('takes a button that is a menu alone, and wants an icon for one shown by its icon alone', () => {
    const buttons = (actions: Json[]) => page({ head: head({ actions }) });
    expect(runtime(buttons([{ type: 'button', id: 'b-more', label: 'More', menu: [{ id: 'm-a', label: 'A', action: 'a' }] }]))).toEqual([]);
    expect(runtime(buttons([{ type: 'button', id: 'b-x', label: 'Refresh', iconOnly: true, steps: [{ do: 'reload' }] }]))).toEqual(['layout.head.actions[0].iconOnly: a button shown by its icon alone needs an icon']);
    expect(runtime(buttons([{ type: 'button', id: 'b-x', label: 'Follow', pressedLabel: 'Following', action: 'follow' }]))).toEqual(['layout.head.actions[0].pressedLabel: words while pressed need the condition that presses it (pressed)']);
    expect(runtime(buttons([{ type: 'button', id: 'b-x', label: 'Follow', action: 'follow', pressed: 'nobody_follows' }]))).toEqual([expect.stringMatching(/^layout\.head\.actions\[0\]\.pressed: .*nobody_follows/)]);
    expect(runtime(buttons([{ type: 'button', id: 'b-x', label: 'X', menu: [{ id: 'm-x', label: 'X' }] }]))).toEqual(['layout.head.actions[0].menu[0]: a menu item needs steps, an action, a built-in, or a menu of its own']);
    expect(runtime(buttons([{ type: 'button', id: 'b-x', label: 'X', action: 'x', menuIcon: 'gear' }]))).toEqual(['layout.head.actions[0].menu: a chevron of its own needs a menu to open']);
  });

  it('takes dividers and menus inside menus — its own items and the app’s — in the gear menu and a button’s', () => {
    const tracker = [
      { id: 'm-copy', label: 'Copy link', icon: 'link', action: 'copy-link' },
      { id: 'd-1', type: 'divider' },
      { id: 'm-templates', label: 'Templates', menuFrom: 'templates', params: { kind: 'bug' }, menu: [{ id: 'm-capture', label: 'Capture…', action: 'capture' }, { id: 'd-2', type: 'divider', invisible: "state == 'new'" }] },
      { id: 'd-3', type: 'divider', group: 'actions' },
      { id: 'm-delete', builtin: 'delete' },
    ];
    expect(problems(page({ toolbar: { menu: tracker } }))).toEqual([]);
    expect(runtime(page({ toolbar: { menu: tracker } }))).toEqual([]);
    const split = head({ actions: [{ type: 'button', id: 'b-save', label: 'Save', steps: [{ do: 'save' }], menu: [{ id: 'm-as', label: 'Save as', menu: [{ id: 'm-draft', label: 'Draft', action: 'draft' }] }, { id: 'd-s', type: 'divider' }] }] });
    expect(problems(page({ head: split }))).toEqual([]);
    expect(runtime(page({ head: split }))).toEqual([]);
    // The shape: a menu of something, the app's action by its name, a divider as one.
    const shaped = (item: Json) => problems(page({ toolbar: { menu: [item] } }));
    expect(shaped({ id: 'm-x', label: 'X', menu: [] })).toEqual([expect.stringMatching(/^layout\.toolbar\.menu\[0\]\.menu:/)]);
    expect(shaped({ id: 'm-x', label: 'X', menuFrom: '' })).toEqual([expect.stringMatching(/^layout\.toolbar\.menu\[0\]\.menuFrom:/)]);
    expect(shaped({ id: 'm-x', type: 'line' })).toEqual([expect.stringMatching(/^layout\.toolbar\.menu\[0\]\.type:/)]);
    // What each says, wherever it stands.
    const said = (menu: Json[]) => runtime(page({ toolbar: { menu } }));
    expect(said([{ id: 'd', type: 'divider', label: 'Line' }])).toEqual(['layout.toolbar.menu[0].label: a divider is a line between items: it has no words and does nothing']);
    expect(said([{ id: 'd', type: 'divider', action: 'x' }])).toEqual(['layout.toolbar.menu[0].action: a divider is a line between items: it has no words and does nothing']);
    expect(said([{ id: 'm-t', label: 'Templates', action: 'x', menu: [{ id: 'a', label: 'A', action: 'a' }] }])).toEqual(['layout.toolbar.menu[0].action: an item that opens a menu does nothing of its own: each item in its menu does']);
    expect(said([{ id: 'm-t', menuFrom: 'templates' }])).toEqual(['layout.toolbar.menu[0].label: an item that opens a menu needs words']);
    expect(said([{ id: 'm-t', label: 'T', params: { a: 1 }, menu: [{ id: 'a', label: 'A', action: 'a' }] }])).toEqual(['layout.toolbar.menu[0].params: params go with the app’s action that gives the menu (menuFrom)']);
    expect(said([{ id: 'm-t', label: 'T', menu: [{ id: 'a', label: 'A' }, { id: 'm-t', label: 'Again', action: 'x', invisible: 'missing == 1' }] }])).toEqual([
      'layout.toolbar.menu[0].menu[0]: a menu item needs steps, an action, a built-in, or a menu of its own',
      'layout.toolbar.menu[0].menu[1]: duplicate id "m-t", also used at layout.toolbar.menu[0]',
      expect.stringMatching(/^layout\.toolbar\.menu\[0\]\.menu\[1\]\.invisible: .*missing/),
    ]);
    const inButton = runtime(page({ head: head({ actions: [{ type: 'button', id: 'b-x', label: 'X', menu: [{ id: 'm-x', label: 'X', menu: [{ id: 'm-y', label: 'Y' }] }] }] }) }));
    expect(inButton).toEqual(['layout.head.actions[0].menu[0].menu[0]: a menu item needs steps, an action, a built-in, or a menu of its own']);
  });

  it('takes a formatted text read first, edited from its Edit', () => {
    const texts = { ...fields, description: { type: 'html', label: 'Description' } };
    const others = (tabs() as { children: Json[] }).children.slice(1);
    const withField = (node: Json) => ({ ...page({ children: [tabs({ children: [{ type: 'tab', id: 't-details', label: 'Details', children: [{ type: 'section', id: 'notes-group', title: 'Notes', children: [node] }] }, ...others] })] }), fields: texts });
    expect(runtime(withField({ type: 'field', id: 'f-d', field: 'description', options: { editor: 'rich', edit: 'button', toolbar: 'focus', toolbarAt: 'top' } }))).toEqual([]);
    expect(runtime(withField({ type: 'field', id: 'f-d', field: 'description', options: { edit: 'inline' } }))).toEqual(['layout.children[0].children[0].children[0].children[0].options.edit: edit is "button": the text read first, changed from its Edit']);
    // Another kind's own `edit` is its own (a photo set's crop and turn): not this one's to judge.
    expect(runtime(withField({ type: 'field', id: 'f-d', field: 'notes', options: { edit: true } }))).toEqual([]);
  });

  it('checks a button’s new parts wherever the button stands', () => {
    const sections = { ...page(), layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'b-x', label: 'Refresh', iconOnly: true, steps: [{ do: 'reload' }] }] } };
    expect(runtime(sections)).toEqual(['layout.children[0].iconOnly: a button shown by its icon alone needs an icon']);
  });

  it('places tabs in the head only from directly under a sheet with a head, once', () => {
    expect(runtime(page({ head: undefined }))).toEqual(['layout.children[0].place: tabs go in the head only from directly in a sheet with a head']);
    const inside = page({ children: [{ type: 'section', id: 's', children: [tabs()] }] });
    expect(runtime(inside)).toEqual(expect.arrayContaining(['layout.children[0].children[0].place: tabs go in the head only from directly in a sheet with a head']));
    const twice = page({ children: [tabs(), tabs({ id: 'more-tabs', children: [{ type: 'tab', id: 't-more', label: 'More', children: [] }] })] });
    expect(runtime(twice)).toEqual(['layout.children[1].place: a head holds one row of tabs']);
    expect(problems(page({ children: [tabs({ place: 'band' })] }))).toEqual([expect.stringMatching(/^layout\.children\[0\]\.place:/)]);
  });

  it('counts a number, lines, links or files in a tab, and wants an icon for a tab shown by it alone', () => {
    const plain = head({ meta: undefined, updated: undefined });
    const counted = (count: string) => page({ head: plain, children: [tabs({ children: [{ type: 'tab', id: 't-a', label: 'A', icon: 'link', count, children: [] }] })] });
    expect(runtime(counted('comment_count'))).toEqual([]);
    expect(runtime(counted('related'))).toEqual([]);
    expect(runtime(counted('title'))).toEqual(['layout.children[0].children[0].count: "title" is a char; a tab counts a number, a table\'s lines, links or files']);
    expect(runtime(counted('missing'))).toEqual(['layout.children[0].children[0].count: no field "missing"']);
    const bare = page({ head: plain, children: [tabs({ children: [{ type: 'tab', id: 't-a', label: 'A', iconOnly: true, children: [] }] })] });
    expect(runtime(bare)).toEqual(['layout.children[0].children[0].iconOnly: a tab shown by its icon alone needs an icon']);
  });

  it('takes one letter or digit as a field’s access key, each key for one field', () => {
    const keyed = (hotkey: unknown) => page({ head: head({ band: { children: [{ type: 'field', id: 'f-state', field: 'state', hotkey }] } }) });
    expect(problems(keyed('e'))).toEqual([]);
    expect(problems(keyed('7'))).toEqual([]);
    for (const wrong of ['E', 'shift+e', 'ee', '']) expect(problems(keyed(wrong))).toEqual([expect.stringMatching(/hotkey: an access key is one letter or digit/)]);
    const twice = page({ head: head({ band: { children: [{ type: 'field', id: 'f-state', field: 'state', hotkey: 'e' }, { type: 'field', id: 'f-area', field: 'area', hotkey: 'e' }] } }) });
    expect(runtime(twice)).toEqual(['layout.head.band.children[1].hotkey: Alt+E takes the focus to the field at layout.head.band.children[0] already']);
  });

  it('lists the head’s words for a translator, and translates them: the kind, the link’s plural forms, the buttons’ words', () => {
    const words = pageWords(page() as never);
    for (const word of ['Save and Close', 'Save', 'Follow', 'Following', 'Notification settings', 'All changes', 'Revert changes', 'Comment', 'Comments', 'No one selected', 'Set by the workflow', 'Details', 'History', 'Links']) {
      expect(words).toContain(word);
    }
    const shown = localizePage({ ...page(), translations: { ar: { Comment: 'تعليق', Comments: 'تعليقات', Following: 'تتم المتابعة', 'Notification settings': 'إعدادات الإشعارات' } } } as never, 'ar');
    const sheet = shown.layout as unknown as { head: { meta: { words?: Json }[]; actions: Json[] } };
    expect(sheet.head.meta[1].words).toEqual({ one: 'تعليق', other: 'تعليقات' });
    expect(sheet.head.actions[1]).toMatchObject({ pressedLabel: 'تتم المتابعة', menuLabel: 'إعدادات الإشعارات', pressed: 'following' });
  });
});
