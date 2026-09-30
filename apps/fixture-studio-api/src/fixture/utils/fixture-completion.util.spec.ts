import type { SpecSchema } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { fixtureCompletion } from './fixture-completion.util.ts';
import { fixtureJson } from './fixture-merge.util.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import type { CompletionInput } from '../common/fixture.type.ts';
import { listSpec, schemasSpec } from '../test/utils/list-spec.spec.util.ts';

const PARTIAL_INVOICE = { id: 'in_9', amount_due: 5 };
const DRAFT_INVOICE = { ...PARTIAL_INVOICE, status: 'draft' };
const MISTYPED_INVOICE = { ...PARTIAL_INVOICE, amount_due: '5' };

describe('FEATURE: fixture completion from the sampler', (): void => {
  let spec: OpenApiSpec;

  const input = (schemaName: string, baseline: unknown, keepPresent = false): CompletionInput => {
    const built: CompletionInput = {
      spec,
      schemaName,
      fixture: baseline,
      baseline,
      objectShape: undefined,
      requiredOnly: true,
      keepPresent
    };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    spec = listSpec(await studioSpec());
  });

  describe('GIVEN an object baseline for an object schema', (): void => {
    it('WHEN completed THEN the absent required key is filled with no warning', (): void => {
      const completion = fixtureCompletion(input('invoice', PARTIAL_INVOICE));

      expect(completion).toStrictEqual({ json: fixtureJson(DRAFT_INVOICE), warnings: [] });
    });

    it('WHEN completed replacing THEN a value of the wrong type is replaced by the sample', (): void => {
      const completion = fixtureCompletion(input('invoice', MISTYPED_INVOICE));

      expect(completion.json).toContain('"amount_due": 0');
    });

    it('WHEN completed with keepPresent THEN a value of the wrong type is kept', (): void => {
      const completion = fixtureCompletion(input('invoice', MISTYPED_INVOICE, true));

      expect(completion.json).toContain('"amount_due": "5"');
    });
  });

  describe('GIVEN a list baseline', (): void => {
    it('WHEN completed against the item schema THEN every element is filled', (): void => {
      const completion = fixtureCompletion(input('invoice', [PARTIAL_INVOICE, PARTIAL_INVOICE]));

      expect(completion.json).toBe(fixtureJson([DRAFT_INVOICE, DRAFT_INVOICE]));
    });

    it('WHEN completed against an array schema THEN every element is filled from its item sample', (): void => {
      const completion = fixtureCompletion(input('invoiceList', [PARTIAL_INVOICE, PARTIAL_INVOICE]));

      expect(completion.json).toBe(fixtureJson([DRAFT_INVOICE, DRAFT_INVOICE]));
    });

    it('WHEN the array schema samples no item THEN the list is kept as it is', (): void => {
      const completion = fixtureCompletion(input('bareList', [PARTIAL_INVOICE]));

      expect(completion).toStrictEqual({ json: fixtureJson([PARTIAL_INVOICE]), warnings: [] });
    });
  });

  describe('GIVEN a baseline whose JSON kind differs from the sample', (): void => {
    it.each<[string, string, unknown, string]>([
      ['an object for an array schema', 'invoiceList', PARTIAL_INVOICE, "is an object but the endpoint's schema describes a list"],
      ['a string for an object schema', 'invoice', 'in_9', "is a string but the endpoint's schema describes an object"],
      ['null for an object schema', 'invoice', null, "is null but the endpoint's schema describes an object"]
    ])(
      'WHEN it is %s THEN the baseline is kept and a warning names both kinds',
      (_label: string, schemaName: string, baseline: unknown, kinds: string): void => {
        const warning = `The fixture ${kinds}, so nothing was filled in.`;

        const completion = fixtureCompletion(input(schemaName, baseline));

        expect(completion).toStrictEqual({ json: fixtureJson(baseline), warnings: [warning] });
      }
    );
  });

  describe('GIVEN a schema the sampler cannot read', (): void => {
    it('WHEN completed THEN the baseline is kept and a warning says nothing was filled in', (): void => {
      const pet: SpecSchema = { $ref: '#pet' };
      const properties = { pet };
      const keeper: SpecSchema = { type: 'object', required: ['pet'], properties };
      const anchored = schemasSpec({ keeper }, '3.1.0');
      const keeperInput = input('keeper', {});
      const completionInput: CompletionInput = { ...keeperInput, spec: anchored };
      const warning = 'The example generator could not read this schema (Invalid JSON pointer: pet), so nothing was filled in.';

      const completion = fixtureCompletion(completionInput);

      expect(completion).toStrictEqual({ json: fixtureJson({}), warnings: [warning] });
    });
  });
});
