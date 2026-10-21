import type { Field, LineField } from './field';
import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/**
 * Proof the person owns an email or a phone (`options.verify` on a field's node): `true`, or `{ "by": [...] }` naming
 * the ways a code may be sent — `sms`, `whatsapp`, `call`, `email`, or the app's own as `{ "value", "label" }` — on a
 * text field drawn as an email or a phone, never on a table's line. In the one-tag script these checks come with the
 * verify part, which a page with such a field asks for (later-checks.ts).
 */
export function checkVerify(node: FieldNode, def: Field | LineField | undefined, path: string, line: boolean, tools: FieldTools): void {
  const asked = node.options?.['verify'];
  const at = `${path}.options.verify`;
  if (asked === false) return;
  if (line) return tools.report(at, 'a code proves the email or phone of the person answering: a field of the page, never a table’s line');
  if (def && (def.type !== 'char' || (node.widget !== 'email' && node.widget !== 'phone'))) return tools.report(at, `a code proves an email or a phone: "${node.field}" is shown as neither — give it "widget": "email" or "phone"`);
  if (asked === true) return;
  if (!asked || typeof asked !== 'object' || Array.isArray(asked)) return tools.report(at, 'verify is true, or { "by": ["whatsapp", "sms"] }: the ways a code may be sent');
  const by = (asked as { by?: unknown }).by;
  for (const key of Object.keys(asked)) if (key !== 'by') tools.report(`${at}.${key}`, `verify takes "by" alone: the ways a code may be sent`);
  if (by === undefined) return;
  if (!Array.isArray(by) || !by.length) return tools.report(`${at}.by`, 'by names one way or more a code may be sent: "sms", "whatsapp", "call", "email", or { "value", "label" } of your own');
  const seen = new Set<string>();
  by.forEach((one, i) => {
    const value = typeof one === 'string' ? one : one && typeof one === 'object' && !Array.isArray(one) ? (one as { value?: unknown }).value : undefined;
    const label = one && typeof one === 'object' && !Array.isArray(one) ? (one as { label?: unknown }).label : undefined;
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(value)) return tools.report(`${at}.by[${i}]`, 'a way a code is sent is a short name in small letters ("whatsapp"), or { "value": "viber", "label": "Viber" }');
    if (typeof one === 'object' && (typeof label !== 'string' || !label.trim())) tools.report(`${at}.by[${i}].label`, `the words people read for "${value}": "label": "Viber"`);
    if (seen.has(value)) tools.report(`${at}.by[${i}]`, `"${value}" is named twice`);
    seen.add(value);
  });
}
