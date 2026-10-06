import type { ASTNode } from './parser';

/** Every node of an expression, each visited once, the outer before the inner. */
function walk(ast: ASTNode, visit: (node: ASTNode) => void): void {
  visit(ast);
  switch (ast.type) {
    case 'BinaryOp':
      walk(ast.left, visit);
      walk(ast.right, visit);
      return;
    case 'UnaryOp':
      walk(ast.operand, visit);
      return;
    case 'Call':
      for (const arg of ast.args) walk(arg, visit);
      return;
    default:
      return;
  }
}

/** The fields an expression reads, by their first name, once each, in order of appearance. Functions are not fields. */
export function fieldsRead(ast: ASTNode): string[] {
  const names: string[] = [];
  walk(ast, (node) => {
    if (node.type !== 'Identifier') return;
    const root = node.name.split('.')[0];
    if (!names.includes(root)) names.push(root);
  });
  return names;
}

/** The names an expression reads, whole — `partner_id.country_id`, `user.roles` — once each, in order of appearance. */
export function pathsRead(ast: ASTNode): string[] {
  const paths: string[] = [];
  walk(ast, (node) => {
    if (node.type === 'Identifier' && !paths.includes(node.name)) paths.push(node.name);
  });
  return paths;
}

/** The conditions on lines an expression counts or adds up by: `count(lines, "…")`, `sum(lines, 'x', "…")`. */
export function wheresRead(ast: ASTNode): { lines: string; condition: string }[] {
  const wheres: { lines: string; condition: string }[] = [];
  walk(ast, (node) => {
    if (node.type !== 'Call' || (node.name !== 'count' && node.name !== 'sum')) return;
    const [lines, condition] = node.name === 'count' ? [node.args[0], node.args[1]] : [node.args[0], node.args[2]];
    if (lines.type === 'Identifier' && condition?.type === 'Literal' && typeof condition.value === 'string') wheres.push({ lines: lines.name, condition: condition.value });
  });
  return wheres;
}

/** The line fields an expression adds up, as `sum(lines, 'subtotal')` names them. */
export function sumsRead(ast: ASTNode): { lines: string; field: string }[] {
  const sums: { lines: string; field: string }[] = [];
  walk(ast, (node) => {
    if (node.type !== 'Call' || node.name !== 'sum') return;
    const [lines, field] = node.args;
    if (lines.type === 'Identifier' && field?.type === 'Literal') sums.push({ lines: lines.name, field: field.value as string });
  });
  return sums;
}
