import { afterEach, describe, expect, it } from 'vitest';

import { typescriptStub } from './typescript-stub.util.ts';
import type { CompiledStub } from '../test/common/compiled-stub.type.ts';
import { compiledStub } from '../test/utils/compiled-stub.spec.util.ts';

describe('FEATURE: TypeScript fixture stubs', (): void => {
  let compiled: CompiledStub | undefined;

  afterEach(async (): Promise<void> => {
    await compiled?.dispose();
    compiled = undefined;
  });

  describe('GIVEN a schema with a literal union and optional properties', (): void => {
    it('WHEN emitting a stub THEN its consumer compiles with the complete schema type', async (): Promise<void> => {
      const invoice = { id: 'in_test', status: 'draft' };
      const exportName = 'INVOICE_STUB';
      const expected = { [exportName]: invoice };
      const json = JSON.stringify(invoice, null, 2);

      const source = typescriptStub('invoice', "./api's.types.d.ts", json);

      compiled = await compiledStub(source, 'invoice.consumer.ts');

      const result = compiled.value;

      expect(result).toStrictEqual(expected);
    });
  });

  describe('GIVEN schema names and data requiring safe TypeScript escaping', (): void => {
    it('WHEN emitting a stub THEN the typed export preserves all JSON properties', async (): Promise<void> => {
      const item: unknown = JSON.parse('{"count":1,"text":"quoted \\"value\\"\\nnext","__proto__":{"flag":true}}');
      const exportName = 'SCHEMA_2_INVOICE_ITEM_STUB';
      const expected = { [exportName]: item };
      const json = JSON.stringify(item, null, 2);

      const source = typescriptStub('2.Invoice"Item', "./api's.types.d.ts", json);

      compiled = await compiledStub(source, 'item.consumer.ts');

      const result = compiled.value;

      expect(result).toStrictEqual(expected);
    });
  });
});
