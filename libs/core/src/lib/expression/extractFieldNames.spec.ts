/**
 * Tests for extractFieldNames utility
 */

import { extractFieldNames, extractFieldNamesFromModifiers } from './extractFieldNames';

describe('extractFieldNames', () => {
  describe('Basic field extraction', () => {
    it('should extract single field name', () => {
      expect(extractFieldNames('state')).toEqual(['state']);
      expect(extractFieldNames('partner_id')).toEqual(['partner_id']);
    });

    it('should extract field from equality expression', () => {
      expect(extractFieldNames("state == 'draft'")).toEqual(['state']);
    });

    it('should extract fields from comparison expressions', () => {
      expect(extractFieldNames('amount > 100')).toEqual(['amount']);
      expect(extractFieldNames('count >= 5')).toEqual(['count']);
    });

    it('should extract multiple fields from AND expression', () => {
      const fields = extractFieldNames("state == 'draft' and amount > 100");
      expect(fields).toHaveLength(2);
      expect(fields).toContain('state');
      expect(fields).toContain('amount');
    });

    it('should extract multiple fields from OR expression', () => {
      const fields = extractFieldNames("state == 'draft' or state == 'sent'");
      // Should only return unique fields
      expect(fields).toEqual(['state']);
    });

    it('should extract field from NOT expression', () => {
      expect(extractFieldNames('not partner_id')).toEqual(['partner_id']);
      expect(extractFieldNames('not is_locked')).toEqual(['is_locked']);
    });
  });

  describe('Nested field access', () => {
    it('should extract root field from nested access', () => {
      expect(extractFieldNames('partner_id.country_id')).toEqual(['partner_id']);
    });

    it('should extract root field from deeply nested access', () => {
      expect(extractFieldNames('partner_id.country_id.name')).toEqual(['partner_id']);
    });

    it('should extract root field from nested comparison', () => {
      expect(extractFieldNames('partner_id.country_id.code == "US"')).toEqual(['partner_id']);
    });

    it('should extract multiple root fields from nested expression', () => {
      const fields = extractFieldNames('partner_id.country_id.code == "US" and company_id.name == "Acme"');
      expect(fields).toHaveLength(2);
      expect(fields).toContain('partner_id');
      expect(fields).toContain('company_id');
    });
  });

  describe('In operator', () => {
    it('should extract field from in operator', () => {
      expect(extractFieldNames("state in ['draft', 'sent']")).toEqual(['state']);
    });

    it('should extract field from not in operator', () => {
      expect(extractFieldNames("state not in ['done', 'cancel']")).toEqual(['state']);
    });
  });

  describe('Complex expressions', () => {
    it('should extract all fields from complex AND/OR expression', () => {
      const fields = extractFieldNames(
        "(state == 'draft' or state == 'sent') and amount > 100 and not is_locked"
      );
      expect(fields).toHaveLength(3);
      expect(fields).toContain('state');
      expect(fields).toContain('amount');
      expect(fields).toContain('is_locked');
    });

    it('should extract fields from real-world expression', () => {
      const fields = extractFieldNames(
        "state == 'draft' and user_id == create_uid and not is_locked"
      );
      expect(fields).toHaveLength(4);
      expect(fields).toContain('state');
      expect(fields).toContain('user_id');
      expect(fields).toContain('create_uid');
      expect(fields).toContain('is_locked');
    });

    it('should handle parentheses correctly', () => {
      const fields = extractFieldNames('(a and b) or (c and d)');
      expect(fields).toHaveLength(4);
      expect(fields).toContain('a');
      expect(fields).toContain('b');
      expect(fields).toContain('c');
      expect(fields).toContain('d');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for boolean expressions', () => {
      expect(extractFieldNames(true as any)).toEqual([]);
      expect(extractFieldNames(false as any)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(extractFieldNames(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(extractFieldNames('')).toEqual([]);
    });

    it('should return empty array for whitespace', () => {
      expect(extractFieldNames('   ')).toEqual([]);
    });

    it('should handle malformed expressions gracefully', () => {
      // Should not throw, should return empty or partial results
      expect(() => extractFieldNames('state ==')).not.toThrow();
      expect(() => extractFieldNames('((())')).not.toThrow();
    });

    it('should return unique fields', () => {
      const fields = extractFieldNames('state == "draft" and state != "done" or state == "sent"');
      expect(fields).toEqual(['state']);
    });
  });

  describe('Literals should not be extracted', () => {
    it('should not extract string literals', () => {
      expect(extractFieldNames("state == 'draft'")).toEqual(['state']);
      // 'draft' should not be in the result
    });

    it('should not extract number literals', () => {
      expect(extractFieldNames('amount > 100')).toEqual(['amount']);
      // 100 should not be in the result
    });

    it('should not extract list literals', () => {
      expect(extractFieldNames("state in ['draft', 'sent']")).toEqual(['state']);
      // List items should not be in the result
    });
  });
});

describe('extractFieldNamesFromModifiers', () => {
  it('should extract fields from single modifier', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: "state == 'draft'"
    });
    expect(fields).toEqual(['state']);
  });

  it('should extract fields from multiple modifiers', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: "state == 'draft'",
      readonly: 'amount > 100'
    });
    expect(fields).toHaveLength(2);
    expect(fields).toContain('state');
    expect(fields).toContain('amount');
  });

  it('should return unique fields across modifiers', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: "state == 'draft'",
      readonly: "state in ['done', 'cancel']",
      required: 'state != "draft"'
    });
    expect(fields).toEqual(['state']);
  });

  it('should handle boolean modifiers', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: false,
      readonly: true,
      required: "amount > 100"
    });
    expect(fields).toEqual(['amount']);
  });

  it('should handle undefined modifiers', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: undefined,
      readonly: "state == 'draft'"
    });
    expect(fields).toEqual(['state']);
  });

  it('should return empty array for empty modifiers', () => {
    expect(extractFieldNamesFromModifiers({})).toEqual([]);
  });

  it('should extract fields from complex real-world modifiers', () => {
    const fields = extractFieldNamesFromModifiers({
      invisible: "partner_id == null",
      readonly: "state in ['done', 'cancel']",
      required: "is_company and amount > 1000"
    });
    expect(fields).toHaveLength(4);
    expect(fields).toContain('partner_id');
    expect(fields).toContain('state');
    expect(fields).toContain('is_company');
    expect(fields).toContain('amount');
  });
});
