# @fieldia/vue

[Fieldia](https://fieldia.dev) forms in Vue 3: a thin shell over
`@fieldia/viewer`, so a page looks and behaves the same as in any other framework.

```sh
npm install @fieldia/vue
```

```vue
<script setup lang="ts">
import { FieldiaForm } from '@fieldia/vue';
import { createMemoryDataSource } from '@fieldia/core';
import page from './customer.page.json';

const dataSource = createMemoryDataSource();
</script>

<template>
  <FieldiaForm :page="page" :data-source="dataSource" :record-id="1" skin="underline" />
</template>
```

Custom fields can be Vue components (`fieldTypes`), slot content goes in named
slots, and `useFormState(form)` gives you a form's state as a ref. A list page
opens a row through the `@open-record` event.

The form's events are emitted — `change`, `save`, `send`, `step`, `run` — and
`@action`'s handler may answer a button or a `call` step (it is the `onAction`
prop, so what it returns comes back):

```vue
<FieldiaForm
  :page="page"
  :data-source="dataSource"
  :pages="pages"
  @action="({ action, values }) => (action === 'check_stock' ? { values: { price: priceOf(values.product) } } : undefined)"
  @change="({ field, value, by }) => {}"
  @save="({ recordId, values }) => {}"
  @send="({ values }) => {}"
  @step="({ step }) => {}"
  @run="({ id, result }) => {}"
/>
```

`host` and `on-open` are the viewer's own options (see `@fieldia/viewer`); the
handle from `@ready` has `on`, `setValues` and `run`. MIT licensed.
