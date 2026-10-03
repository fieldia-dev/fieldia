import { Component, ElementRef, effect, inject, input, output, untracked, type OnDestroy } from '@angular/core';
import { mountScreenEditor, mountSurveyEditor, type Designer, type ScreenEditorHandle, type SurveyEditorHandle } from '@fieldia/designer';
import type { Skin } from '@fieldia/viewer';

/**
 * The designer's editors as Angular components: `@fieldia/designer/angular`.
 * Each mounts the plain-DOM editor into its own element and takes it down
 * when it goes; a new designer, skin or kit mounts it again. `ready` hands
 * out the handle.
 */

@Component({ selector: 'fieldia-survey-editor', template: '', host: { style: 'display: block' } })
export class FieldiaSurveyEditorComponent implements OnDestroy {
  readonly designer = input.required<Designer>();
  readonly skin = input<Skin | undefined>(undefined);
  /** The preview beside the editor. */
  readonly preview = input<boolean>(true);
  readonly ready = output<SurveyEditorHandle>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private handle: SurveyEditorHandle | null = null;

  constructor() {
    effect(() => {
      const options = { designer: this.designer(), skin: this.skin(), preview: this.preview() };
      untracked(() => {
        this.handle?.destroy();
        this.handle = mountSurveyEditor(this.host.nativeElement, options);
        this.ready.emit(this.handle);
      });
    });
  }

  ngOnDestroy(): void {
    this.handle?.destroy();
    this.handle = null;
  }
}

@Component({ selector: 'fieldia-screen-editor', template: '', host: { style: 'display: block' } })
export class FieldiaScreenEditorComponent implements OnDestroy {
  readonly designer = input.required<Designer>();
  readonly skin = input<Skin | undefined>(undefined);
  readonly ready = output<ScreenEditorHandle>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private handle: ScreenEditorHandle | null = null;

  constructor() {
    effect(() => {
      const options = { designer: this.designer(), skin: this.skin() };
      untracked(() => {
        this.handle?.destroy();
        this.handle = mountScreenEditor(this.host.nativeElement, options);
        this.ready.emit(this.handle);
      });
    });
  }

  ngOnDestroy(): void {
    this.handle?.destroy();
    this.handle = null;
  }
}
