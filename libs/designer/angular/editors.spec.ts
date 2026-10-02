import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { blankPage, createDesigner, type Designer, type SurveyEditorHandle } from '@fieldia/designer';
import { fakeGrafloria } from '../src/lib/test-screen';
import { FieldiaScreenEditorComponent, FieldiaSurveyEditorComponent } from './editors';

const kit = fakeGrafloria();

@Component({
  imports: [FieldiaSurveyEditorComponent, FieldiaScreenEditorComponent],
  template: `
    @if (shown()) {
      <fieldia-survey-editor [designer]="survey()" [preview]="false" (ready)="ready.push($event)" />
    }
    <fieldia-screen-editor [designer]="screen()" [grafloria]="grafloria" />
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly survey = signal<Designer>(createDesigner({ page: blankPage('survey', 'Event feedback') }));
  readonly screen = signal<Designer>(createDesigner({ page: blankPage('screen', 'Visit') }));
  readonly grafloria = kit.kit;
  readonly ready: SurveyEditorHandle[] = [];
}

describe('the editors in Angular', () => {
  it('mounts both editors, hands out the handle, mounts again for another designer, and takes them down', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('fieldia-survey-editor .fd-designer')).not.toBeNull();
    expect(el.querySelector('fieldia-screen-editor .fd-screen-designer')).not.toBeNull();
    const host = fixture.componentInstance;
    expect(host.ready).toHaveLength(1);
    host.survey().addQuestion('short-answer');
    expect(el.querySelectorAll('fieldia-survey-editor .fd-q')).toHaveLength(1);
    host.survey.set(createDesigner({ page: blankPage('survey', 'Another') }));
    await fixture.whenStable();
    expect(host.ready).toHaveLength(2);
    expect(el.querySelectorAll('fieldia-survey-editor .fd-designer')).toHaveLength(1);
    expect(el.querySelectorAll('fieldia-survey-editor .fd-q')).toHaveLength(0);
    host.shown.set(false);
    await fixture.whenStable();
    expect(el.querySelector('.fd-designer:not(.fd-screen-designer)')).toBeNull();
  });
});
