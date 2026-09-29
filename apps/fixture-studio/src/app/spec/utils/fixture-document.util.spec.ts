import type { GeneratedFixture } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { fixtureFormats, fixtureViews } from './fixture-document.util.ts';
import type { FixtureDocument } from '../../shared/document-view/common/document-view.type.ts';
import { GENERATED_FIXTURE_STUB } from '../../test/stubs/studio.stub.ts';
import { DEFAULT_GENERATE_OPTIONS } from '../common/generation.const.ts';
import type { GenerateOptions } from '../common/generation.type.ts';

describe('FEATURE: requested formats', (): void => {
  it('GIVEN the default options WHEN listed THEN returns JSON and stub', (): void => {
    expect(fixtureFormats(DEFAULT_GENERATE_OPTIONS)).toStrictEqual(['json', 'stub']);
  });

  it('GIVEN no format flag WHEN listed THEN returns none', (): void => {
    const options: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, json: false, stub: false };

    expect(fixtureFormats(options)).toStrictEqual([]);
  });
});

describe('FEATURE: fixture views', (): void => {
  describe('GIVEN a fixture with JSON and types', (): void => {
    const fixture: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, json: '{}', types: 'export type A = {};' };

    it('WHEN mapped THEN splits the endpoint id into method and path', (): void => {
      const [view] = fixtureViews([fixture]);

      expect(view?.method).toBe('GET');
      expect(view?.path).toBe('/v1/invoices');
    });

    it('WHEN mapped THEN lists only the present formats, named after the schema', (): void => {
      const json: FixtureDocument = { format: 'json', label: 'JSON fixture', fileName: 'InvoiceList.json', content: '{}', language: 'json' };
      const types: FixtureDocument = {
        format: 'types',
        label: 'Types',
        fileName: 'InvoiceList.d.ts',
        content: 'export type A = {};',
        language: 'typescript'
      };

      const [view] = fixtureViews([fixture]);

      expect(view?.documents).toStrictEqual([json, types]);
    });
  });

  it('GIVEN a stub fixture WHEN mapped THEN names the file with the stub extension', (): void => {
    const fixture: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, stub: 'export const A = {};' };

    const [view] = fixtureViews([fixture]);

    expect(view?.documents[0]?.fileName).toBe('InvoiceList.stub.ts');
  });
});
