// The JIT compiler links the partial-compiled editors at runtime, as an Angular CLI app links them at build time.
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import * as grafloria from '@grafloria/element';
import { blankPage, createDesigner, createMemoryPageStore } from '@fieldia/designer';
import { FieldiaScreenEditorComponent, FieldiaSurveyEditorComponent } from '@fieldia/designer/angular';

/** The designer's editors as Angular components. `?editor=screen` shows the screen editor. */
const params = new URLSearchParams(location.search);
const screen = params.get('editor') === 'screen';
const store = createMemoryPageStore();
const designer = createDesigner({ page: screen ? blankPage('screen', 'New screen') : blankPage('survey', 'Event feedback'), store });
Object.assign(window, { fieldiaDesigner: { designer, store } });

@Component({
  selector: 'demo-root',
  imports: [FieldiaSurveyEditorComponent, FieldiaScreenEditorComponent],
  template: `
    @if (screen) {
      <fieldia-screen-editor [designer]="designer" [grafloria]="grafloria" skin="outlined" />
    } @else {
      <fieldia-survey-editor [designer]="designer" skin="outlined" />
    }
  `,
})
class DemoComponent {
  readonly screen = screen;
  readonly designer = designer;
  readonly grafloria = grafloria;
}

const app = document.getElementById('app') as HTMLElement;
app.append(document.createElement('demo-root'));
bootstrapApplication(DemoComponent, { providers: [provideZonelessChangeDetection()] }).catch((error) => {
  app.textContent = `The Angular designer demo failed to start: ${String(error)}`;
});
