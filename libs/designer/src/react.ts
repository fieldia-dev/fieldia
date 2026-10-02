import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import type { Skin } from '@fieldia/viewer';
import type { Designer } from './lib/designer';
import type { Grafloria } from './lib/grafloria';
import { mountScreenEditor, type ScreenEditorHandle } from './lib/screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './lib/survey-editor';

/**
 * The designer's editors as React components: `@fieldia/designer/react`. Each
 * mounts the plain-DOM editor into its own element and takes it down when it
 * goes; a new designer, skin or kit mounts it again. The ref is the handle.
 */

interface Common {
  designer: Designer;
  skin?: Skin;
  className?: string;
  style?: CSSProperties;
}

export interface SurveyEditorProps extends Common {
  /** The preview beside the editor; on unless false. */
  preview?: boolean;
}

export interface ScreenEditorProps extends Common {
  /** Grafloria's dashboard kit: `import * as grafloria from '@grafloria/element'`. */
  grafloria: Grafloria;
}

export const SurveyEditor = forwardRef<SurveyEditorHandle | null, SurveyEditorProps>(function SurveyEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<SurveyEditorHandle | null>(null);
  useImperativeHandle(ref, () => handle as SurveyEditorHandle, [handle]);
  useEffect(() => {
    const mounted = mountSurveyEditor(host.current as HTMLDivElement, { designer: props.designer, skin: props.skin, preview: props.preview });
    setHandle(mounted);
    return () => {
      mounted.destroy();
      setHandle(null);
    };
  }, [props.designer, props.skin, props.preview]);
  return createElement('div', { ref: host, className: props.className, style: props.style });
});

export const ScreenEditor = forwardRef<ScreenEditorHandle | null, ScreenEditorProps>(function ScreenEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<ScreenEditorHandle | null>(null);
  useImperativeHandle(ref, () => handle as ScreenEditorHandle, [handle]);
  useEffect(() => {
    const mounted = mountScreenEditor(host.current as HTMLDivElement, { designer: props.designer, grafloria: props.grafloria, skin: props.skin });
    setHandle(mounted);
    return () => {
      mounted.destroy();
      setHandle(null);
    };
  }, [props.designer, props.grafloria, props.skin]);
  return createElement('div', { ref: host, className: props.className, style: props.style });
});
