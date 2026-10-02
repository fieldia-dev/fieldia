import { formatBytes, type FileValue } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import type { WidgetFactory } from './widgets';

/**
 * File and image fields. A chosen or dropped file is read into the value as
 * base64, the way a backend's binary fields carry it; a stored one may carry
 * a `url` instead. Size and type limits are checked by the field's validation.
 */

function read(file: File): Promise<FileValue> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve({ name: file.name, type: file.type, size: file.size, data: url.slice(url.indexOf(',') + 1) });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileWidget(kind: 'binary' | 'image'): WidgetFactory {
  return ({ form, name, field, id, document, labels = WIDGET_LABELS.en }) => {
    const element = document.createElement('div');
    element.className = `fd-file fd-file-${kind}`;
    const input = document.createElement('input');
    input.type = 'file';
    input.id = id;
    input.className = 'fd-sr-only';
    const accept = field.type === 'binary' ? field.accept : kind === 'image' ? ['image/*'] : undefined;
    if (accept) input.accept = accept.join(',');

    const preview = document.createElement('img');
    preview.className = 'fd-image-preview';
    preview.alt = field.label;
    preview.hidden = true;

    const pick = document.createElement('label');
    pick.className = 'fd-file-pick';
    pick.htmlFor = id;
    const pickText = document.createElement('span');
    pickText.className = 'fd-button';
    pickText.textContent = labels.upload;
    const hint = document.createElement('span');
    hint.className = 'fd-help';
    hint.textContent = labels.dropHere;
    pick.append(pickText, hint);

    const chosen = document.createElement('div');
    chosen.className = 'fd-file-chosen';
    const fileName = document.createElement('span');
    fileName.className = 'fd-file-name';
    const replace = document.createElement('button');
    replace.type = 'button';
    replace.className = 'fd-button fd-button-link';
    replace.textContent = labels.replace;
    replace.addEventListener('click', () => input.click());
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'fd-button fd-button-link';
    remove.textContent = labels.removeFile;
    remove.addEventListener('click', () => form.setValue(name, null));
    chosen.append(fileName, replace, remove);

    element.append(input, ...(kind === 'image' ? [preview] : []), pick, chosen);

    let readonly = false;
    const take = async (file: File | undefined) => {
      if (!file || readonly) return;
      form.setValue(name, await read(file));
    };
    input.addEventListener('change', () => {
      void take(input.files?.[0]);
      input.value = '';
    });
    element.addEventListener('dragover', (event) => {
      if (readonly) return;
      event.preventDefault();
      element.classList.add('fd-dragging');
    });
    element.addEventListener('dragleave', () => element.classList.remove('fd-dragging'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('fd-dragging');
      void take((event as DragEvent).dataTransfer?.files?.[0]);
    });

    return {
      element,
      focus: () => (pick.hidden ? replace : input).focus(),
      update(state) {
        readonly = state.readonly;
        const file = state.value as FileValue | null | undefined;
        pick.hidden = !!file || readonly;
        chosen.hidden = !file;
        replace.hidden = remove.hidden = readonly;
        input.disabled = readonly;
        input.setAttribute('aria-invalid', String(state.invalid));
        if (state.describedBy) input.setAttribute('aria-describedby', state.describedBy);
        fileName.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : '';
        if (kind === 'image') {
          const src = file ? (file.data ? `data:${file.type};base64,${file.data}` : file.url ?? '') : '';
          preview.hidden = !src;
          if (preview.getAttribute('src') !== src) {
            if (src) preview.src = src;
            else preview.removeAttribute('src');
          }
        }
      },
    };
  };
}

export const binaryWidget = fileWidget('binary');
export const imageWidget = fileWidget('image');
