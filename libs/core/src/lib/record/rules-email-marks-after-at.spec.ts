import type { FieldNode } from '../format/layout';
import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { createForm } from './form';
import { MESSAGES } from './messages';

/**
 * Found by the 0.23 input-rules check (email). 0.21 made an address with ":", ";" or "," before its @ fail the email
 * check, but the check (inputs.ts FORMATS.email, `[^@\s]+\.[^@\s]+` after the @) still passes those marks after it.
 * "ali@example.com;" — what Outlook copies from a To line, typed or pasted — is saved as a valid address, and so are
 * "ali@example.com," and "ali@exa,mple.com": no mail reaches them, and nothing says so. A domain has letters, digits,
 * dashes and dots only (an address literal in [ ] aside).
 */
function emailProblem(value: string) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { type: 'char', label: 'Email' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', widget: 'email' } as FieldNode] },
  } as Page;
  const form = createForm({ page, messages: MESSAGES.en });
  form.setValue('x', value);
  return form.problem('x');
}

describe('an email address with a mark after its @ that no domain has', () => {
  it.each(['ali@example.com;', 'ali@example.com,', 'ali@exa,mple.com', 'ali@example.com:', 'ali@example.com>', 'ali@exa;mple.com'])('%s fails the email check', (value) => {
    expect(emailProblem(value)).toBe(MESSAGES.en.email);
  });

  it('the same mark before the @ fails it (0.21), and a plain address passes', () => {
    expect(emailProblem('ali;x@example.com')).toBe(MESSAGES.en.email);
    expect(emailProblem('ali@example.com')).toBeNull();
  });
});
