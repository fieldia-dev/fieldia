import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Page, Value } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import type { PartFailure, WidgetFactory } from '@fieldia/widgets';
import { FieldiaFormComponent } from './fieldia-form.component';

/**
 * A part of the page that throws — here the app's own widget, as it is drawn — shows a small box that names it, the
 * rest of the form works on, and `(partError)` hears where it was.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'angular-contained',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' }, price: { type: 'float', label: 'Price' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname' },
      { type: 'field', id: 'f-price', field: 'price', widget: 'fancy' },
    ],
  },
};

const widgets: Record<string, WidgetFactory> = {
  'float.fancy': () => {
    throw new Error('it fell over');
  },
};

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [widgets]="widgets" (partError)="failures.push($event)" />`,
})
class HostComponent {
  readonly page = page;
  readonly widgets = widgets;
  readonly failures: { error: unknown; where: PartFailure }[] = [];
}

let consoleError: jest.SpyInstance;
beforeEach(() => (consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)));
afterEach(() => consoleError.mockRestore());

describe('<fieldia-form> with a part that throws', () => {
  it('shows its box, keeps the rest, and emits partError with where it was', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-node="f-price"] .fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(element.querySelector('[data-node="f-nickname"] input')).not.toBeNull();
    expect(fixture.componentInstance.failures).toEqual([{ error: expect.objectContaining({ message: 'it fell over' }), where: { stage: 'draw', part: 'field', field: 'price', node: 'f-price', widget: 'float.fancy' } }]);
  });
});

/** The app's price tag: typed in, and it throws as it is handed a four-digit price. */
@Component({
  selector: 'test-price-tag',
  template: `<input [id]="id" aria-label="price" [value]="text()" (input)="write($event)" />`,
})
class PriceTagComponent {
  @Input() id = '';
  @Input() onChange: (value: Value) => void = () => undefined;
  private price: Value | undefined;
  @Input() set value(value: Value | undefined) {
    if (typeof value === 'number' && value >= 1000) throw new Error('four digits');
    this.price = value;
  }
  text() {
    return String(this.price ?? '');
  }
  write(event: Event) {
    this.onChange(Number((event.target as HTMLInputElement).value));
  }
}

@Component({
  imports: [FieldiaFormComponent],
  template: `<fieldia-form [page]="page" [values]="values" [fieldTypes]="fieldTypes" (ready)="handle = $event" />`,
})
class TagHostComponent {
  readonly page = page;
  readonly values = { price: 450 };
  readonly fieldTypes = { 'float.fancy': PriceTagComponent };
  handle: ViewerHandle | null = null;
}

describe("<fieldia-form> with a component that throws on the person's change", () => {
  it('keeps no half-typed value: the field goes back to what it showed, the box says so and takes the focus', async () => {
    const fixture = TestBed.createComponent(TagHostComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input[aria-label="price"]') as HTMLInputElement;
    expect(input.value).toBe('450');
    input.focus();
    // A person clicks into it and types 1200: the first key makes 4501.
    input.value = '4501';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const box = element.querySelector('[data-node="f-price"] .fd-broken') as HTMLElement;
    expect(box.querySelector('.fd-broken-kept')?.textContent).toBe('Your change was not kept: it is back to 450.00.');
    expect(document.activeElement).toBe(box);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.handle?.form.getState().values['price']).toBe(450);
    fixture.nativeElement.remove();
  });
});
