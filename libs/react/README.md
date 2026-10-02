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
a row through `onOpenRecord`. MIT licensed.
