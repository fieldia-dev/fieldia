/**
 * Tests for expression parser - Phase 2
 */

import { ExpressionParser } from './parser';
import type { ASTNode } from './parser';
import { tokenize } from './tokenizer';

describe('ExpressionParser', () => {
  function parse(expr: string): ASTNode {
    const tokens = tokenize(expr);
    const parser = new ExpressionParser(tokens);
    return parser.parse();
  }

  describe('Literals', () => {
    it('should parse string literals', () => {
      const ast = parse("'draft'");
      expect(ast).toEqual({
        type: 'Literal',
        value: 'draft',
      });
    });

    it('should parse number literals', () => {
      const ast = parse('42');
      expect(ast).toEqual({
        type: 'Literal',
        value: 42,
      });
    });

    it('should parse list literals', () => {
      const ast = parse("['draft', 'sent']");
      expect(ast).toEqual({
        type: 'Literal',
        value: ['draft', 'sent'],
      });
    });
  });

  describe('Identifiers', () => {
    it('should parse simple identifiers', () => {
      const ast = parse('partner_id');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'partner_id',
      });
    });

    it('should parse dotted identifiers', () => {
      const ast = parse('partner_id.country_id');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'partner_id.country_id',
      });
    });
  });

  describe('Comparison operators', () => {
    it('should parse equality', () => {
      const ast = parse("state == 'draft'");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '==',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: 'draft' },
      });
    });

    it('should parse inequality', () => {
      const ast = parse("state != 'draft'");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '!=',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: 'draft' },
      });
    });

    it('should parse less than', () => {
      const ast = parse('amount < 100');
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '<',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      });
    });

    it('should parse greater than or equal', () => {
      const ast = parse('amount >= 100');
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '>=',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 100 },
      });
    });

    it('should parse "in" operator', () => {
      const ast = parse("state in ['draft', 'sent']");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'in',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: ['draft', 'sent'] },
      });
    });

    it('should parse "not in" operator', () => {
      const ast = parse("state not in ['done', 'cancel']");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'not in',
        left: { type: 'Identifier', name: 'state' },
        right: { type: 'Literal', value: ['done', 'cancel'] },
      });
    });
  });

  describe('Logical operators', () => {
    it('should parse NOT', () => {
      const ast = parse('not partner_id');
      expect(ast).toEqual({
        type: 'UnaryOp',
        operator: 'not',
        operand: { type: 'Identifier', name: 'partner_id' },
      });
    });

    it('should parse AND', () => {
      const ast = parse("state == 'draft' and amount > 100");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'and',
        left: {
          type: 'BinaryOp',
          operator: '==',
          left: { type: 'Identifier', name: 'state' },
          right: { type: 'Literal', value: 'draft' },
        },
        right: {
          type: 'BinaryOp',
          operator: '>',
          left: { type: 'Identifier', name: 'amount' },
          right: { type: 'Literal', value: 100 },
        },
      });
    });

    it('should parse OR', () => {
      const ast = parse("state == 'draft' or state == 'sent'");
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: 'or',
        left: {
          type: 'BinaryOp',
          operator: '==',
          left: { type: 'Identifier', name: 'state' },
          right: { type: 'Literal', value: 'draft' },
        },
        right: {
          type: 'BinaryOp',
          operator: '==',
          left: { type: 'Identifier', name: 'state' },
          right: { type: 'Literal', value: 'sent' },
        },
      });
    });
  });

  describe('Operator precedence', () => {
    it('should give AND higher precedence than OR', () => {
      // a or b and c -> a or (b and c)
      const ast = parse('a or b and c');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('or');
      expect((ast as any).right.type).toBe('BinaryOp');
      expect((ast as any).right.operator).toBe('and');
    });

    it('should give NOT highest precedence', () => {
      // not a and b -> (not a) and b
      const ast = parse('not a and b');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('and');
      expect((ast as any).left.type).toBe('UnaryOp');
      expect((ast as any).left.operator).toBe('not');
    });

    it('should give comparison higher precedence than AND', () => {
      // a == b and c == d -> (a == b) and (c == d)
      const ast = parse('a == b and c == d');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('and');
      expect((ast as any).left.type).toBe('BinaryOp');
      expect((ast as any).left.operator).toBe('==');
      expect((ast as any).right.type).toBe('BinaryOp');
      expect((ast as any).right.operator).toBe('==');
    });
  });

  describe('Parentheses', () => {
    it('should parse simple parenthesized expression', () => {
      const ast = parse('(a)');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'a',
      });
    });

    it('should override precedence with parentheses', () => {
      // (a or b) and c
      const ast = parse('(a or b) and c');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('and');
      expect((ast as any).left.type).toBe('BinaryOp');
      expect((ast as any).left.operator).toBe('or');
    });

    it('should handle nested parentheses', () => {
      const ast = parse('((a))');
      expect(ast).toEqual({
        type: 'Identifier',
        name: 'a',
      });
    });
  });

  describe('Complex expressions', () => {
    it('should parse complex AND/OR combination', () => {
      // (state == 'draft' or state == 'sent') and amount > 100
      const ast = parse("(state == 'draft' or state == 'sent') and amount > 100");
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('and');
    });

    it('should parse nested field access in comparison', () => {
      const ast = parse('partner_id.country_id.id == 5');
      expect(ast).toEqual({
        type: 'BinaryOp',
        operator: '==',
        left: { type: 'Identifier', name: 'partner_id.country_id.id' },
        right: { type: 'Literal', value: 5 },
      });
    });

    it('should parse multiple AND conditions', () => {
      const ast = parse('a and b and c');
      expect(ast.type).toBe('BinaryOp');
      expect((ast as any).operator).toBe('and');
      expect((ast as any).left.type).toBe('BinaryOp');
      expect((ast as any).left.operator).toBe('and');
    });
  });

  describe('Error handling', () => {
    it('should throw on empty expression', () => {
      expect(() => parse('')).toThrow();
    });

    it('should throw on unexpected end of expression', () => {
      expect(() => parse('state ==')).toThrow();
    });

    it('should throw on unmatched parenthesis', () => {
      expect(() => parse('(state == "draft"')).toThrow();
    });

    it('should throw on unexpected token', () => {
      expect(() => parse('== state')).toThrow();
    });
  });
});
