# @fieldia/angular

[Fieldia](https://fieldia.dev) forms in Angular 21 and 22: a standalone component
over `@fieldia/viewer`, so a page looks and behaves the same as in any other
framework.

```sh
npm install @fieldia/angular
```

```ts
import { Component } from '@angular/core';
import { FieldiaFormComponent } from '@fieldia/angular';
import { createMemoryDataSource } from '@fieldia/core';
import page from './customer.page.json';

@Component({
  selector: 'app-customer',
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [dataSource]="dataSource" [recordId]="1" skin="underline" />`,
})
export class CustomerComponent {
  readonly page = page;
  readonly dataSource = createMemoryDataSource();
}
```

Custom fields can be Angular components (`fieldTypes`), slot content goes in
`<ng-template fieldiaSlot="name">`, and `formState(form)` gives you a form's state
as a signal. The viewer's options are inputs of the same names, but for the
app's translator: `[translator]`, because a `[translate]` binding goes to the
element's own HTML attribute. MIT licensed.
