/**
 * Comprehensive integration tests for evaluateModifier - Phase 2
 *
 * These tests verify the complete modifier evaluation system including:
 * - Tokenizer, Parser, and Evaluator working together
 * - All operators and syntax from Flectra
 * - Edge cases and error handling
 */

import { evaluateModifier, isModifierValid } from './evaluateModifier';

describe('evaluateModifier', () => {
  describe('Boolean values', () => {
    it('should handle boolean true/false', () => {
      expect(evaluateModifier(true, {})).toBe(true);
      expect(evaluateModifier(false, {})).toBe(false);
    });

    it('should handle string boolean values', () => {
      expect(evaluateModifier('True', {})).toBe(true);
      expect(evaluateModifier('False', {})).toBe(false);
      expect(evaluateModifier('true', {})).toBe(true);
      expect(evaluateModifier('false', {})).toBe(false);
      expect(evaluateModifier('1', {})).toBe(true);
      expect(evaluateModifier('0', {})).toBe(false);
    });

    it('should handle undefined', () => {
      expect(evaluateModifier(undefined, {})).toBe(false);
    });

    it('should handle empty string', () => {
      expect(evaluateModifier('', {})).toBe(false);
    });
  });

  describe('Simple comparisons', () => {
    it('should evaluate equality', () => {
      const ctx = { state: 'draft', count: 5 };

      expect(evaluateModifier("state == 'draft'", ctx)).toBe(true);
      expect(evaluateModifier("state == 'done'", ctx)).toBe(false);
      expect(evaluateModifier('count == 5', ctx)).toBe(true);
      expect(evaluateModifier('count == 10', ctx)).toBe(false);
    });

    it('should evaluate inequality', () => {
      const ctx = { state: 'draft' };

      expect(evaluateModifier("state != 'draft'", ctx)).toBe(false);
      expect(evaluateModifier("state != 'done'", ctx)).toBe(true);
      expect(evaluateModifier("state <> 'done'", ctx)).toBe(true); // Flectra uses <>
    });

    it('should evaluate comparison operators', () => {
      const ctx = { amount: 100 };

      expect(evaluateModifier('amount > 50', ctx)).toBe(true);
      expect(evaluateModifier('amount < 150', ctx)).toBe(true);
      expect(evaluateModifier('amount >= 100', ctx)).toBe(true);
      expect(evaluateModifier('amount <= 100', ctx)).toBe(true);
      expect(evaluateModifier('amount > 200', ctx)).toBe(false);
      expect(evaluateModifier('amount < 50', ctx)).toBe(false);
    });
  });

  describe('In operator', () => {
    it('should evaluate "in" operator with arrays', () => {
      const ctx = { state: 'draft' };

      expect(evaluateModifier("state in ['draft', 'sent']", ctx)).toBe(true);
      expect(evaluateModifier("state in ['done', 'cancel']", ctx)).toBe(false);
    });

    it('should evaluate "not in" operator', () => {
      const ctx = { state: 'draft' };

      expect(evaluateModifier("state not in ['done', 'cancel']", ctx)).toBe(true);
      expect(evaluateModifier("state not in ['draft', 'sent']", ctx)).toBe(false);
    });

    it('should handle numeric values in lists', () => {
      const ctx = { count: 5 };

      expect(evaluateModifier('count in [1, 5, 10]', ctx)).toBe(true);
      expect(evaluateModifier('count in [2, 4, 6]', ctx)).toBe(false);
    });
  });

  describe('Logical operators', () => {
    it('should evaluate AND', () => {
      const ctx = { state: 'draft', amount: 100 };

      expect(evaluateModifier("state == 'draft' and amount > 50", ctx)).toBe(true);
      expect(evaluateModifier("state == 'draft' and amount > 200", ctx)).toBe(false);
      expect(evaluateModifier("state == 'done' and amount > 50", ctx)).toBe(false);
    });

    it('should evaluate OR', () => {
      const ctx = { state: 'draft' };

      expect(evaluateModifier("state == 'draft' or state == 'sent'", ctx)).toBe(true);
      expect(evaluateModifier("state == 'done' or state == 'cancel'", ctx)).toBe(false);
      expect(evaluateModifier("state == 'done' or state == 'draft'", ctx)).toBe(true);
    });

    it('should evaluate NOT', () => {
      const ctx = { partner_id: null, active: true };

      expect(evaluateModifier('not partner_id', ctx)).toBe(true);
      expect(evaluateModifier('not active', ctx)).toBe(false);
    });

    it('should handle operator precedence', () => {
      const ctx = { a: true, b: false, c: true };

      // a and b or c -> (a and b) or c -> false or c -> true
      expect(evaluateModifier('a and b or c', ctx)).toBe(true);

      // a or b and c -> a or (b and c) -> true or false -> true
      expect(evaluateModifier('a or b and c', ctx)).toBe(true);
    });
  });

  describe('Truthiness checks', () => {
    it('should check field truthiness', () => {
      expect(evaluateModifier('partner_id', { partner_id: 5 })).toBe(true);
      expect(evaluateModifier('partner_id', { partner_id: null })).toBe(false);
      expect(evaluateModifier('partner_id', { partner_id: 0 })).toBe(false);
      expect(evaluateModifier('partner_id', { partner_id: '' })).toBe(false);
      expect(evaluateModifier('partner_id', { partner_id: false })).toBe(false);
      // Changed from the React engine: an empty list is false, as in Python (see semantics.spec.ts)
      expect(evaluateModifier('partner_id', { partner_id: [] })).toBe(false);
    });

    it('should handle non-existent fields as falsy', () => {
      expect(evaluateModifier('unknown_field', {})).toBe(false);
    });
  });

  describe('Nested field access', () => {
    it('should access nested object properties', () => {
      const ctx = {
        partner_id: {
          country_id: { id: 5, name: 'USA' },
        },
      };

      expect(evaluateModifier('partner_id.country_id.id == 5', ctx)).toBe(true);
      expect(evaluateModifier('partner_id.country_id.name == "USA"', ctx)).toBe(true);
      expect(evaluateModifier('partner_id.country_id.id == 10', ctx)).toBe(false);
    });

    it('should handle missing nested properties', () => {
      const ctx = { partner_id: null };

      expect(evaluateModifier('partner_id.country_id', ctx)).toBe(false);
      expect(evaluateModifier('partner_id.country_id.id == 5', ctx)).toBe(false);
    });

    it('should handle deep nesting', () => {
      const ctx = {
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      };

      expect(evaluateModifier('a.b.c.d == "value"', ctx)).toBe(true);
    });
  });

  describe('Parentheses', () => {
    it('should evaluate expressions with parentheses', () => {
      const ctx = { a: true, b: false, c: true };

      expect(evaluateModifier('(a or b) and c', ctx)).toBe(true);
      expect(evaluateModifier('a or (b and c)', ctx)).toBe(true);
      expect(evaluateModifier('(a and b) or c', ctx)).toBe(true);
    });

    it('should handle nested parentheses', () => {
      const ctx = { a: true, b: true, c: false };

      expect(evaluateModifier('((a and b) or c)', ctx)).toBe(true);
      expect(evaluateModifier('(a and (b or c))', ctx)).toBe(true);
    });
  });

  describe('Complex real-world expressions', () => {
    it('should evaluate sale order state conditions', () => {
      const ctx = { state: 'draft', invoice_status: 'to invoice', amount_total: 150 };

      // Invoice button visible when state is draft or sent
      expect(evaluateModifier("state in ['draft', 'sent']", ctx)).toBe(true);

      // Confirm button disabled when state is done
      expect(evaluateModifier("state == 'done' or state == 'cancel'", ctx)).toBe(false);

      // Show warning when not invoiced and amount > 100
      expect(evaluateModifier("invoice_status == 'to invoice' and amount_total > 100", ctx)).toBe(true);
    });

    it('should evaluate partner visibility conditions', () => {
      const ctx = {
        is_company: true,
        company_name: 'Acme Corp',
        country_id: { code: 'US' },
      };

      // Show company fields only for companies
      expect(evaluateModifier('is_company', ctx)).toBe(true);

      // Show VAT field for EU countries
      expect(evaluateModifier("country_id.code in ['BE', 'FR', 'DE']", ctx)).toBe(false);
      expect(evaluateModifier("country_id.code in ['US', 'CA']", ctx)).toBe(true);
    });

    it('should evaluate form state conditions', () => {
      const ctx = {
        state: 'draft',
        user_id: 5,
        create_uid: 5,
        is_locked: false,
      };

      // Editable when draft and created by current user and not locked
      expect(
        evaluateModifier("state == 'draft' and user_id == create_uid and not is_locked", ctx)
      ).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty expression', () => {
      expect(evaluateModifier('', {})).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(evaluateModifier('   ', {})).toBe(false);
    });

    it('should handle malformed expressions gracefully', () => {
      // Should not throw, should return false
      expect(evaluateModifier('state ==', { state: 'draft' })).toBe(false);
      expect(evaluateModifier('and or not', {})).toBe(false);
      expect(evaluateModifier('((())', {})).toBe(false);
    });

    it('should handle undefined variables', () => {
      expect(evaluateModifier('unknown_field == 5', {})).toBe(false);
      expect(evaluateModifier('unknown_field', {})).toBe(false);
    });

    it('should handle null comparisons', () => {
      const ctx = { value: null };

      // Changed from the React engine: null is a value, not a field name (see semantics.spec.ts)
      expect(evaluateModifier('value == null', ctx)).toBe(true);
      expect(evaluateModifier('not value', ctx)).toBe(true);
    });

    it('should be case-insensitive for operators', () => {
      const ctx = { a: true, b: false };

      expect(evaluateModifier('a AND b', ctx)).toBe(false);
      expect(evaluateModifier('a Or b', ctx)).toBe(true);
      expect(evaluateModifier('NOT a', ctx)).toBe(false);
    });
  });

  describe('isModifierValid', () => {
    it('should return true for valid expressions', () => {
      expect(isModifierValid(true)).toBe(true);
      expect(isModifierValid(false)).toBe(true);
      expect(isModifierValid(undefined)).toBe(true);
      expect(isModifierValid('')).toBe(true);
      expect(isModifierValid('state == "draft"')).toBe(true);
      expect(isModifierValid('a and b or c')).toBe(true);
    });

    it('should return false for invalid expressions', () => {
      expect(isModifierValid('state ==')).toBe(false);
      expect(isModifierValid('((())')).toBe(false);
      expect(isModifierValid('== state')).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should evaluate simple expressions quickly', () => {
      const ctx = { state: 'draft', amount: 100 };
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        evaluateModifier("state == 'draft' and amount > 50", ctx);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 1000 evaluations in < 100ms
    });

    it('should evaluate complex expressions reasonably quickly', () => {
      const ctx = {
        state: 'draft',
        amount: 100,
        partner_id: { country_id: { code: 'US' } },
      };
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        evaluateModifier(
          "(state in ['draft', 'sent'] and amount > 50) or (partner_id.country_id.code in ['US', 'CA'] and not is_locked)",
          { ...ctx, is_locked: false }
        );
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 evaluations in < 100ms
    });
  });
});
