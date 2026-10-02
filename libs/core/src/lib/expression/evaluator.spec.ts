/**
 * Tests for AST evaluator - Phase 2
 */

import { evaluate } from './evaluator';
import type { BinaryOpNode, UnaryOpNode, LiteralNode, IdentifierNode } from './parser';

describe('evaluate', () => {
  describe('Literals', () => {
    it('should evaluate string literals', () => {
      const ast: LiteralNode = { type: 'Literal', value: 'draft' };
      expect(evaluate(ast, {})).toBe('draft');
    });

    it('should evaluate number literals', () => {
      const ast: LiteralNode = { type: 'Literal', value: 42 };
      expect(evaluate(ast, {})).toBe(42);
    });

    it('should evaluate boolean literals', () => {
      const ast: LiteralNode = { type: 'Literal', value: true };
      expect(evaluate(ast, {})).toBe(true);
    });

    it('should evaluate list literals', () => {
      const ast: LiteralNode = { type: 'Literal', value: ['draft', 'sent'] };
      expect(evaluate(ast, {})).toEqual(['draft', 'sent']);
    });
  });

  describe('Identifiers', () => {
    it('should evaluate simple identifiers', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'state' };
      const context = { state: 'draft' };
      expect(evaluate(ast, context)).toBe('draft');
    });

    it('should evaluate nested identifiers', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'partner_id.country_id' };
      const context = {
        partner_id: {
          country_id: 5,
        },
      };
      expect(evaluate(ast, context)).toBe(5);
    });

    it('should return undefined for missing identifiers', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'unknown' };
      expect(evaluate(ast, {})).toBeUndefined();
    });

    it('should handle null in nested path', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'partner_id.country_id' };
      const context = { partner_id: null };
      expect(evaluate(ast, context)).toBeUndefined();
    });
  });

  describe('Comparison operators', () => {
    it('should evaluate equality', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '==',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: 'draft' },
      };
      expect(evaluate(ast, { state: 'draft' })).toBe(true);
      expect(evaluate(ast, { state: 'done' })).toBe(false);
    });

    it('should evaluate inequality', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '!=',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: 'draft' },
      };
      expect(evaluate(ast, { state: 'draft' })).toBe(false);
      expect(evaluate(ast, { state: 'done' })).toBe(true);
    });

    it('should evaluate <> as inequality', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '<>',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: 'draft' },
      };
      expect(evaluate(ast, { state: 'done' })).toBe(true);
    });

    it('should evaluate less than', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '<',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      };
      expect(evaluate(ast, { amount: 50 })).toBe(true);
      expect(evaluate(ast, { amount: 150 })).toBe(false);
    });

    it('should evaluate greater than', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '>',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      };
      expect(evaluate(ast, { amount: 150 })).toBe(true);
      expect(evaluate(ast, { amount: 50 })).toBe(false);
    });

    it('should evaluate less than or equal', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '<=',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      };
      expect(evaluate(ast, { amount: 100 })).toBe(true);
      expect(evaluate(ast, { amount: 99 })).toBe(true);
      expect(evaluate(ast, { amount: 101 })).toBe(false);
    });

    it('should evaluate greater than or equal', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '>=',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      };
      expect(evaluate(ast, { amount: 100 })).toBe(true);
      expect(evaluate(ast, { amount: 101 })).toBe(true);
      expect(evaluate(ast, { amount: 99 })).toBe(false);
    });
  });

  describe('In operator', () => {
    it('should evaluate "in" operator', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'in',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: ['draft', 'sent'] },
      };
      expect(evaluate(ast, { state: 'draft' })).toBe(true);
      expect(evaluate(ast, { state: 'done' })).toBe(false);
    });

    it('should evaluate "not in" operator', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'not in',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: ['done', 'cancel'] },
      };
      expect(evaluate(ast, { state: 'draft' })).toBe(true);
      expect(evaluate(ast, { state: 'done' })).toBe(false);
    });
  });

  describe('Logical operators', () => {
    it('should evaluate AND', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'and',
        left: { type: 'Literal', value: true },
        right: { type: 'Literal', value: true },
      };
      expect(evaluate(ast, {})).toBe(true);

      const astFalse: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'and',
        left: { type: 'Literal', value: true },
        right: { type: 'Literal', value: false },
      };
      expect(evaluate(astFalse, {})).toBe(false);
    });

    it('should evaluate OR', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'or',
        left: { type: 'Literal', value: false },
        right: { type: 'Literal', value: true },
      };
      expect(evaluate(ast, {})).toBe(true);

      const astFalse: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'or',
        left: { type: 'Literal', value: false },
        right: { type: 'Literal', value: false },
      };
      expect(evaluate(astFalse, {})).toBe(false);
    });

    it('should evaluate NOT', () => {
      const ast: UnaryOpNode = {
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Literal', value: true },
      };
      expect(evaluate(ast, {})).toBe(false);

      const astTrue: UnaryOpNode = {
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Literal', value: false },
      };
      expect(evaluate(astTrue, {})).toBe(true);
    });

    it('should use truthiness for AND', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'and',
        left: { type: 'Identifier', name: 'a' },
        right: { type: 'Identifier', name: 'b' },
      };
      expect(evaluate(ast, { a: 1, b: 2 })).toBe(true);
      expect(evaluate(ast, { a: 0, b: 1 })).toBe(false);
      expect(evaluate(ast, { a: '', b: 'text' })).toBe(false);
    });

    it('should use truthiness for OR', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'or',
        left: { type: 'Identifier', name: 'a' },
        right: { type: 'Identifier', name: 'b' },
      };
      expect(evaluate(ast, { a: 0, b: 1 })).toBe(true);
      expect(evaluate(ast, { a: '', b: 0 })).toBe(false);
      expect(evaluate(ast, { a: 'text', b: null })).toBe(true);
    });

    it('should use truthiness for NOT', () => {
      const ast: UnaryOpNode = {
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Identifier', name: 'partner_id' },
      };
      expect(evaluate(ast, { partner_id: 5 })).toBe(false);
      expect(evaluate(ast, { partner_id: null })).toBe(true);
      expect(evaluate(ast, { partner_id: 0 })).toBe(true);
      expect(evaluate(ast, { partner_id: '' })).toBe(true);
    });
  });

  describe('Complex expressions', () => {
    it('should evaluate nested binary operations', () => {
      // (a == 5) and (b > 10)
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'and',
        left: {
          type: 'BinaryOp',
          operator: '==',
          left: { type: 'Identifier', name: 'a' },
          right: { type: 'Literal', value: 5 },
        },
        right: {
          type: 'BinaryOp',
          operator: '>',
          left: { type: 'Identifier', name: 'b' },
          right: { type: 'Literal', value: 10 },
        },
      };
      expect(evaluate(ast, { a: 5, b: 15 })).toBe(true);
      expect(evaluate(ast, { a: 5, b: 5 })).toBe(false);
      expect(evaluate(ast, { a: 10, b: 15 })).toBe(false);
    });

    it('should evaluate deeply nested fields', () => {
      const ast: IdentifierNode = {
        type: 'Identifier',
        name: 'partner_id.country_id.name',
      };
      const context = {
        partner_id: {
          country_id: {
            name: 'USA',
          },
        },
      };
      expect(evaluate(ast, context)).toBe('USA');
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'value' };
      expect(evaluate(ast, { value: null })).toBeNull();
    });

    it('should handle undefined values', () => {
      const ast: IdentifierNode = { type: 'Identifier', name: 'missing' };
      expect(evaluate(ast, {})).toBeUndefined();
    });

    it('should handle zero as falsy in truthiness', () => {
      const ast: UnaryOpNode = {
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Identifier', name: 'count' },
      };
      expect(evaluate(ast, { count: 0 })).toBe(true);
    });

    it('should handle empty string as falsy', () => {
      const ast: UnaryOpNode = {
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Identifier', name: 'name' },
      };
      expect(evaluate(ast, { name: '' })).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw on unknown node type', () => {
      const ast: any = { type: 'UnknownType' };
      expect(() => evaluate(ast, {})).toThrow();
    });

    it('should throw on unknown operator', () => {
      const ast: BinaryOpNode = {
        type: 'BinaryOp',
        operator: 'unknown',
        left: { type: 'Literal', value: 1 },
        right: { type: 'Literal', value: 2 },
      };
      expect(() => evaluate(ast, {})).toThrow();
    });
  });
});
