import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Page } from '@fieldia/core';
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
