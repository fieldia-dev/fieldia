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

In **Nuxt** (or any server-rendered Vue), give the component `first-paint`: it
renders the form's first paint on the server — its values in plain HTML, in
Fieldia's look — which the browser shows before any script and hydrates as it
is; the viewer then mounts over it once drawn and loaded, keeping what was
typed meanwhile (`@fieldia/viewer/server`):

```vue
<script setup lang="ts">
const { data: record } = await useFetch(`/api/enquiries/${useRoute().params.id}`);
const nonce = useNuxtApp().ssrContext?.event.context.nonce; // with a strict Content-Security-Policy
</script>

<template>
  <FieldiaForm :page="page" :data-source="dataSource" :record-id="record.id" :nonce="nonce" :first-paint="{ values: record }" />
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
handle from `@ready` has `on`, `setValues` and `run`.

A page with `continueLater` opens a draft kept on your server by its key —
`:resume="route.query.resume"`, the key the link Continue later gave — and
`@draft="({ key, later, saved }) => …"` is told of each draft kept. A new
`resume` opens that draft, as a new `record-id` opens that record.

A page that fills fields from its link (`prefill`) reads the browser's address;
an app rendered on a server, or shown inside another page, gives the link it
knows — `:url="route.fullPath"`, an address, or `:url="{ agent: 'mona' }"`. A
new `url` starts the form from it again.

**Before your app leaves the form**, ask its one check: `await
handle.form.leave()` in a router's `beforeRouteLeave`, before removing
`<FieldiaForm>`, and before changing a prop that mounts it again (`page`,
`form`, `dataSource`, `recordId`, `resume`, `url`, `user`, `context`, `dir`, `locale`,
`labels`, the names in `functions`). Vue unmounts at once, so nothing else can keep the person there. It
waits for a save on its way, then asks "Discard your changes?" only when their
work is at risk, and answers false when they choose to stay. `warn-on-leave` has
the browser's own Back, Reload or a closed tab ask first while there is a change
not saved.

A field's component or a slot's content that throws as it renders is kept to its
place: it shows a small box that names it, `@error="(error, where) => …"` is
told, and the error goes no further up Vue's tree. A page the viewer refuses says
why in the form's place, `@error` is told, and the app stays mounted. MIT licensed.
