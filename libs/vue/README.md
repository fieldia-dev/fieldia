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
slots, and `useFormState(form)` gives you a form's state as a ref. MIT licensed.
