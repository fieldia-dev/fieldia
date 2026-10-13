import Ajv2020 from 'ajv/dist/2020';
import { pageJsonSchema, validatePage, type Page } from '../../index';

/**
 * A field's photos made smaller before they are kept (`shrink`): the longest
 * side in pixels and the quality a JPEG is written at, or `false` to keep
 * every photo as it was taken. On a picture field and a file field alike.
 */

function page(field: Record<string, unknown>): Page {
  return {
    fieldia: '0.1',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: { photos: { label: 'Photos', ...field } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f', field: 'photos' }] },
  } as unknown as Page;
}
const problems = (input: unknown) => {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('shrink, in the format', () => {
  it('takes a longest side and a quality, either alone, or false, on a picture or a file field', () => {
    expect(problems(page({ type: 'image', multiple: true, shrink: { maxSide: 1600, quality: 0.8 } }))).toEqual([]);
    expect(problems(page({ type: 'image', shrink: { maxSide: 2560 } }))).toEqual([]);
    expect(problems(page({ type: 'binary', accept: ['image/*', 'application/pdf'], shrink: { quality: 0.9 } }))).toEqual([]);
    expect(problems(page({ type: 'image', shrink: false }))).toEqual([]);
  });

  it('refuses a side too small to see or too large to draw, a quality past 1 or below 0.3, and words it does not know', () => {
    expect(problems(page({ type: 'image', shrink: { maxSide: 100 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: { maxSide: 20000 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: { maxSide: 1600.5 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: { quality: 1.2 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: { quality: 0.1 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: { width: 800 } }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
    expect(problems(page({ type: 'image', shrink: true }))).toEqual([expect.stringMatching(/^fields\.photos\.shrink/)]);
  });

  it('says the same in the JSON Schema', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(pageJsonSchema());
    expect(validate(page({ type: 'image', shrink: { maxSide: 1600, quality: 0.8 } }))).toBe(true);
    expect(validate(page({ type: 'binary', shrink: false }))).toBe(true);
    expect(validate(page({ type: 'image', shrink: { maxSide: 100 } }))).toBe(false);
    expect(validate(page({ type: 'image', shrink: { quality: 2 } }))).toBe(false);
    expect(validate(page({ type: 'image', shrink: true }))).toBe(false);
  });
});
