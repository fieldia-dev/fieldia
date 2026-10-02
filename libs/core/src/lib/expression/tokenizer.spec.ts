/**
 * Tests for tokenizer - Phase 2
 */

import { tokenize } from './tokenizer';

describe('tokenizer', () => {
  describe('Basic tokens', () => {
    it('should tokenize simple identifiers', () => {
      const tokens = tokenize('partner_id');
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'partner_id', position: 0 },
      ]);
    });

    it('should tokenize dotted identifiers', () => {
      const tokens = tokenize('partner_id.country_id.name');
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'partner_id.country_id.name', position: 0 },
      ]);
    });

    it('should tokenize numbers', () => {
      const tokens = tokenize('42');
      expect(tokens).toEqual([
        { type: 'NUMBER', value: '42', position: 0 },
      ]);

      const tokensFloat = tokenize('3.14');
      expect(tokensFloat).toEqual([
        { type: 'NUMBER', value: '3.14', position: 0 },
      ]);
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = tokenize("'draft'");
      expect(tokens).toEqual([
        { type: 'STRING', value: "'draft'", position: 0 },
      ]);
    });

    it('should tokenize double-quoted strings', () => {
      const tokens = tokenize('"draft"');
      expect(tokens).toEqual([
        { type: 'STRING', value: '"draft"', position: 0 },
      ]);
    });

    it('should tokenize lists', () => {
      const tokens = tokenize("['draft', 'sent']");
      expect(tokens).toEqual([
        { type: 'LIST', value: "['draft', 'sent']", position: 0 },
      ]);
    });

    it('should tokenize parentheses', () => {
      const tokens = tokenize('(a)');
      expect(tokens).toEqual([
        { type: 'PAREN', value: '(', position: 0 },
        { type: 'IDENTIFIER', value: 'a', position: 1 },
        { type: 'PAREN', value: ')', position: 2 },
      ]);
    });
  });

  describe('Operators', () => {
    it('should tokenize comparison operators', () => {
      expect(tokenize('==')[0].type).toBe('OPERATOR');
      expect(tokenize('!=')[0].type).toBe('OPERATOR');
      expect(tokenize('<>')[0].type).toBe('OPERATOR');
      expect(tokenize('<')[0].type).toBe('OPERATOR');
      expect(tokenize('>')[0].type).toBe('OPERATOR');
      expect(tokenize('<=')[0].type).toBe('OPERATOR');
      expect(tokenize('>=')[0].type).toBe('OPERATOR');
    });

    it('should tokenize "in" operator', () => {
      const tokens = tokenize("state in ['draft']");
      expect(tokens[1]).toEqual({ type: 'OPERATOR', value: 'in', position: 1 });
    });

    it('should tokenize "not in" operator', () => {
      const tokens = tokenize("state not in ['draft']");
      expect(tokens[1]).toEqual({ type: 'OPERATOR', value: 'not in', position: 1 });
    });

    it('should tokenize logical operators', () => {
      expect(tokenize('and')[0].type).toBe('LOGICAL');
      expect(tokenize('or')[0].type).toBe('LOGICAL');
      expect(tokenize('not')[0].type).toBe('LOGICAL');
    });
  });

  describe('Complex expressions', () => {
    it('should tokenize equality expression', () => {
      const tokens = tokenize("state == 'draft'");
      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'state', position: 0 },
        { type: 'OPERATOR', value: '==', position: 1 },
        { type: 'STRING', value: "'draft'", position: 2 },
      ]);
    });

    it('should tokenize AND expression', () => {
      const tokens = tokenize("state == 'draft' and amount > 100");
      expect(tokens).toHaveLength(7);
      expect(tokens[3]).toEqual({ type: 'LOGICAL', value: 'and', position: 3 });
    });

    it('should tokenize OR expression', () => {
      const tokens = tokenize("state == 'draft' or state == 'sent'");
      expect(tokens).toHaveLength(7);
      expect(tokens[3]).toEqual({ type: 'LOGICAL', value: 'or', position: 3 });
    });

    it('should tokenize NOT expression', () => {
      const tokens = tokenize('not partner_id');
      expect(tokens).toEqual([
        { type: 'LOGICAL', value: 'not', position: 0 },
        { type: 'IDENTIFIER', value: 'partner_id', position: 1 },
      ]);
    });

    it('should tokenize expression with parentheses', () => {
      const tokens = tokenize("(state == 'draft') and amount > 100");
      expect(tokens[0]).toEqual({ type: 'PAREN', value: '(', position: 0 });
      expect(tokens[4]).toEqual({ type: 'PAREN', value: ')', position: 4 });
    });

    it('should tokenize nested field access', () => {
      const tokens = tokenize('partner_id.country_id.id == 5');
      expect(tokens[0]).toEqual({
        type: 'IDENTIFIER',
        value: 'partner_id.country_id.id',
        position: 0,
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle whitespace', () => {
      const tokens = tokenize('   state   ==   "draft"   ');
      expect(tokens).toHaveLength(3);
    });

    it('should handle multiple spaces between tokens', () => {
      const tokens = tokenize('state    ==    "draft"');
      expect(tokens).toHaveLength(3);
    });

    it('should handle strings with spaces', () => {
      const tokens = tokenize('"Hello World"');
      expect(tokens[0].value).toBe('"Hello World"');
    });

    it('should handle complex list syntax', () => {
      const tokens = tokenize("state in ['draft', 'sent', 'done']");
      expect(tokens[2].value).toBe("['draft', 'sent', 'done']");
    });
  });

  describe('Case sensitivity', () => {
    it('should handle uppercase logical operators', () => {
      expect(tokenize('AND')[0].type).toBe('LOGICAL');
      expect(tokenize('OR')[0].type).toBe('LOGICAL');
      expect(tokenize('NOT')[0].type).toBe('LOGICAL');
    });

    it('should handle mixed case logical operators', () => {
      expect(tokenize('And')[0].type).toBe('LOGICAL');
      expect(tokenize('Or')[0].type).toBe('LOGICAL');
      expect(tokenize('Not')[0].type).toBe('LOGICAL');
    });
  });
});
