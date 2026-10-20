# @fieldia/react

[Fieldia](https://fieldia.dev) forms in React 18 and 19: a thin shell over
`@fieldia/viewer`, so a page looks and behaves the same as in any other framework.

```sh
npm install @fieldia/react
```

```tsx
import { FieldiaForm } from '@fieldia/react';
import { createMemoryDataSource } from '@fieldia/core';
import page from './customer.page.json';

const dataSource = createMemoryDataSource();

export function Customer() {
  return <FieldiaForm page={page} dataSource={dataSource} recordId={1} skin="underline" />;
}
```

Custom fields and slot content can be React components (`fieldTypes`, `slots`);
`useFormState(form)` gives you a form's state as React state. A list page opens
a row through `onOpenRecord`.

The form's events are props, each read anew on every render without mounting
again; `onAction` may answer a button or a `call` step:

```tsx
<FieldiaForm
  page={page}
  dataSource={dataSource}
  pages={pages}
  onAction={async ({ action, values }) => (action === 'check_stock' ? { values: { price: await priceOf(values.product) } } : undefined)}
  onChange={({ field, value, by }) => {}}   // by: 'person' | 'step' | 'app'
  onSave={({ recordId, values }) => {}}
  onSend={({ values }) => {}}
  onStep={({ step }) => {}}
  onRun={({ id, result }) => {}}
/>
```

`host` and `onOpen` are the viewer's own options (see `@fieldia/viewer`); the
handle from `ref` or `onReady` has `on`, `setValues` and `run`.

**Before your app leaves the form**, ask its one check: `await
handle.form.leave()` before a route change, before unmounting `<FieldiaForm>`,
and before changing a prop that mounts it again (`page`, `form`, `dataSource`,
`recordId`, `user`, `context`, `dir`, `labels`, `fieldTypes`, `slots`, the names
in `functions`). React
unmounts at once, so nothing else can keep the person there. It waits for a save
on its way, then asks "Discard your changes?" only when their work is at risk,
and answers false when they choose to stay. `warnOnLeave` has the browser's own
Back, Reload or a closed tab ask first while there is a change not saved.

A field's or a slot's component that throws as it renders is kept to its place:
it shows a small box that names it, `onError={(error, where) => …}` is told, and
the rest of the form stays mounted — React would otherwise take down everything
under the nearest error boundary, the form with it. MIT licensed.
