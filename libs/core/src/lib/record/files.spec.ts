import Ajv2020 from 'ajv/dist/2020';
import { checkValue, createForm, emptyValue, expressionContext, MESSAGES, pageJsonSchema, validatePage, type Field, type FileValue, type Page } from '../../index';

/**
 * Several files in one field: a file or an image field with `multiple` holds a
 * list of files, as few as `minFiles` and as many as `maxFiles`. Each file is
 * checked on its own against the kinds the field takes and its largest size.
 */

function page(fields: Record<string, unknown>, options?: Record<string, unknown>): Page {
  return {
    fieldia: '0.1',
    id: 'files',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((name) => ({ type: 'field', id: `n-${name}`, field: name, ...(options ? { options } : {}) })) },
  } as Page;
}
const problems = (input: unknown) => {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};
const file = (name: string, type: string, size = 10): FileValue => ({ name, type, size, data: 'eA==' });

describe('several files, in the format', () => {
  it('takes several files on a file field and an image field, with the fewest and the most', () => {
    expect(problems(page({ docs: { type: 'binary', label: 'Documents', multiple: true, minFiles: 1, maxFiles: 5 } }))).toEqual([]);
    expect(problems(page({ photos: { type: 'image', label: 'Photos', multiple: true, maxFiles: 6 } }))).toEqual([]);
    expect(problems(page({ photos: { type: 'image', label: 'Photos', multiple: true, minFiles: 0 } }))).toEqual([]);
  });

  it('refuses a fewest or a most without several files, with words that say so', () => {
    expect(problems(page({ docs: { type: 'binary', label: 'Documents', maxFiles: 5 } }))).toEqual(['fields.docs.maxFiles: the fewest and the most files are for a field of several files: set multiple']);
    expect(problems(page({ docs: { type: 'image', label: 'Photos', multiple: false, minFiles: 2 } }))).toEqual(['fields.docs.minFiles: the fewest and the most files are for a field of several files: set multiple']);
  });

  it('refuses a fewest above the most, and counts that are not whole', () => {
    expect(problems(page({ docs: { type: 'binary', label: 'Documents', multiple: true, minFiles: 4, maxFiles: 3 } }))).toEqual(['fields.docs.minFiles: the fewest files cannot be more than the most']);
    expect(problems(page({ docs: { type: 'binary', label: 'Documents', multiple: true, maxFiles: 0 } }))).toEqual([expect.stringMatching(/^fields\.docs\.maxFiles: /)]);
    expect(problems(page({ docs: { type: 'binary', label: 'Documents', multiple: true, minFiles: 1.5 } }))).toEqual([expect.stringMatching(/^fields\.docs\.minFiles: /)]);
  });

  it('keeps an image field to images: it takes no list of kinds', () => {
    expect(problems(page({ photos: { type: 'image', label: 'Photos', accept: ['application/pdf'] } }))).toEqual([expect.stringMatching(/^fields\.photos: /)]);
  });

  it('shows the files as a list or as thumbnails, and offers the camera, from the layout node', () => {
    expect(problems(page({ photos: { type: 'image', label: 'Photos', multiple: true } }, { files: 'thumbnails', camera: true }))).toEqual([]);
  });

  it('says the same in the JSON Schema', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(pageJsonSchema());
    expect(validate(page({ docs: { type: 'binary', label: 'Documents', multiple: true, minFiles: 1, maxFiles: 5 } }))).toBe(true);
    expect(validate(page({ docs: { type: 'binary', label: 'Documents', maxFiles: 5 } }))).toBe(false);
    expect(validate(page({ docs: { type: 'image', label: 'Photos', multiple: false, minFiles: 1 } }))).toBe(false);
  });
});

describe('several files, as values', () => {
  const docs = { type: 'binary', label: 'Documents', multiple: true, accept: ['application/pdf', 'image/*'], maxSize: 1048576, minFiles: 2, maxFiles: 3 } as Field;

  it('starts as an empty list, and is empty until a file is added', () => {
    expect(emptyValue(docs)).toEqual([]);
    expect(emptyValue({ type: 'binary', label: 'One' } as Field)).toBeNull();
    expect(checkValue(docs, [], true)).toBe('Documents is required');
    expect(checkValue(docs, [], false)).toBeUndefined();
  });

  it('wants as few and as many files as the field says', () => {
    expect(checkValue(docs, [file('a.pdf', 'application/pdf')], false)).toBe('Add at least 2 files to Documents');
    expect(checkValue(docs, [file('a.pdf', 'application/pdf'), file('b.png', 'image/png')], false)).toBeUndefined();
    const four = ['a', 'b', 'c', 'd'].map((n) => file(`${n}.pdf`, 'application/pdf'));
    expect(checkValue(docs, four, false)).toBe('Too many files for Documents: at most 3');
  });

  it('checks each file against the kinds it takes and its largest size, by the file’s name', () => {
    expect(checkValue(docs, [file('a.pdf', 'application/pdf'), file('setup.exe', 'application/x-msdownload')], false)).toBe('setup.exe must be a PDF or image file');
    expect(checkValue(docs, [file('a.pdf', 'application/pdf'), file('scan.png', 'image/png', 2 * 1048576)], false)).toBe('scan.png is larger than 1 MB');
    expect(checkValue(docs, [file('a.pdf', 'application/pdf'), { name: 'b' } as unknown as FileValue], false)).toBe('Documents must be a file');
  });

  it('takes a lone file as a list of one, as a backend may send it', () => {
    expect(checkValue({ ...docs, minFiles: undefined } as Field, file('a.pdf', 'application/pdf'), false)).toBeUndefined();
  });

  it('checks an image field’s files are images', () => {
    const photos = { type: 'image', label: 'Photos', multiple: true } as Field;
    expect(checkValue(photos, [file('a.png', 'image/png'), file('notes.txt', 'text/plain')], false)).toBe('notes.txt must be an image file');
    expect(checkValue({ type: 'image', label: 'Photo' } as Field, file('notes.txt', 'text/plain'), false)).toBe('Photo must be an image file');
  });

  it('says it in every language', () => {
    expect(checkValue(docs, [file('a.pdf', 'application/pdf')], false, MESSAGES.ar)).toBe('أضف إلى Documents ملفات لا يقل عددها عن 2');
    expect(checkValue(docs, ['a', 'b', 'c', 'd'].map((n) => file(`${n}.pdf`, 'application/pdf')), false, MESSAGES.de)).toBe('Zu viele Dateien für Documents: höchstens 3');
    expect(checkValue(docs, [file('a.pdf', 'application/pdf')], false, MESSAGES.fr)).toBe('Ajoutez au moins 2 fichiers à Documents');
  });

  it('reads as its files’ names in a rule', () => {
    const fields = { docs } as Record<string, Field>;
    expect(expressionContext({ docs: [file('a.pdf', 'application/pdf'), file('b.png', 'image/png')] }, fields)).toEqual({ docs: ['a.pdf', 'b.png'] });
  });

  it('is required, and checked, by the form', () => {
    const form = createForm({ page: page({ docs: { ...docs, required: true } }) });
    expect(form.getState().values['docs']).toEqual([]);
    form.setValue('docs', [file('a.pdf', 'application/pdf')]);
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['docs']).toBe('Add at least 2 files to Documents');
  });
});
