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
handle from `ref` or `onReady` has `on`, `setValues` and `run`. MIT licensed.
