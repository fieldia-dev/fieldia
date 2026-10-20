import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/**
 * A signature, on a binary field, that signs answers: the answers it signs fields of this page — never itself — and
 * the signer's name in a field that holds words (a text, or a link's name).
 */
export function checkSignature(node: FieldNode, path: string, tools: FieldTools): void {
  const options = node.options ?? {};
  const signs = options['signs'];
  if (Array.isArray(signs)) {
    signs.forEach((name, i) => {
      if (typeof name !== 'string') return;
      if (name === node.field) tools.report(`${path}.options.signs[${i}]`, 'a signature signs other answers than its own');
      else tools.need(name, `${path}.options.signs[${i}]`);
    });
  }
  const signer = options['signerField'];
  if (typeof signer === 'string' && has(tools.page.fields, signer)) {
    const type = tools.page.fields[signer].type;
    if (type !== 'char' && type !== 'many2one') tools.report(`${path}.options.signerField`, `"${signer}" is a ${type}; the signer's name is kept in a char field, or is a many2one's record`);
  }
  if (signer !== undefined && signs === undefined) tools.report(`${path}.options.signerField`, 'signerField names who signs the answers in signs: say which it signs');
}
