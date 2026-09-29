import { describe, expect, it } from 'vitest';

import { schemaSuggestion } from './schema-suggestion.util.ts';

describe('FEATURE: schema name suggestions', (): void => {
  describe('GIVEN names that share a prefix with the query', (): void => {
    it('WHEN suggesting THEN proposes the similar names', (): void => {
      const names = ['invoice', 'invoice_item', 'charge'];

      const suggestion = schemaSuggestion(names, 'invoic');

      expect(suggestion).toBe('did you mean invoice, invoice_item?');
    });
  });

  describe('GIVEN a query that differs only in case', (): void => {
    it('WHEN suggesting THEN still proposes the name', (): void => {
      const suggestion = schemaSuggestion(['Invoice'], 'INVOICE');

      expect(suggestion).toBe('did you mean Invoice?');
    });
  });

  describe('GIVEN no name resembling the query', (): void => {
    it('WHEN suggesting THEN lists the available names', (): void => {
      const suggestion = schemaSuggestion(['charge', 'refund'], 'invoice');

      expect(suggestion).toBe('available: charge, refund');
    });
  });

  describe('GIVEN more names than the listing cap', (): void => {
    it('WHEN suggesting THEN lists five and reports the total', (): void => {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

      const suggestion = schemaSuggestion(names, 'invoice');

      expect(suggestion).toBe('available: a, b, c, d, e, ... (7 total)');
    });
  });

  describe('GIVEN a document without schemas', (): void => {
    it('WHEN suggesting THEN says nothing is declared', (): void => {
      const suggestion = schemaSuggestion([], 'invoice');

      expect(suggestion).toBe('the document declares no schemas');
    });
  });
});
