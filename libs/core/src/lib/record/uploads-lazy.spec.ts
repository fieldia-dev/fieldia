import { createForm, createMemoryDataSource, formUploadsPart, type Page, type UploadedFile, type UploadFile } from '../../index';

/**
 * The uploads' work is a part of its own (files-part.ts): it comes with the files part, or the first time a form
 * sends a file. Before it has come, a file picked is taken at once — its id given, shown waiting its turn — and sent
 * once the part is in; a save storing the bytes a field holds waits for it.
 */

const page = {
  fieldia: '0.1',
  id: 'listing',
  data: { kind: 'record', model: 'listing' },
  fields: { name: { type: 'char', label: 'Name' }, plan: { type: 'binary', label: 'Floor plan' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-plan', field: 'plan' }] },
} as Page;

describe('files sent before the uploads part has come', () => {
  it('takes a file at once, waiting its turn, and sends it once the part is in', async () => {
    const sent: string[] = [];
    const upload = async (file: UploadFile): Promise<UploadedFile> => {
      sent.push(file.name);
      return { url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type };
    };
    const dataSource = { ...createMemoryDataSource({ records: {} }), upload };
    const form = createForm({ page, dataSource, recordId: null });
    expect(formUploadsPart.loaded).toBeUndefined();
    const ids = form.upload('plan', [new File([new Uint8Array(4)], 'plan.pdf', { type: 'application/pdf' })]);
    expect(ids).toHaveLength(1);
    expect(form.getState().uploads.map((one) => one.status)).toEqual(['waiting']);
    for (let i = 0; i < 50 && form.getState().uploads.length; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(formUploadsPart.loaded).toBeDefined();
    expect(sent).toEqual(['plan.pdf']);
    expect((form.getState().values['plan'] as { url?: string }).url).toBe('https://files.example/plan.pdf');
  });
});
