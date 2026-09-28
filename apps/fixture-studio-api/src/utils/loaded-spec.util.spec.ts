import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { loadedSpec } from './loaded-spec.util.ts';
import { studioSpec } from '../test/utils/studio-spec.spec.util.ts';

const NON_STRING_INFO = { title: 1, version: null };

describe('FEATURE: loaded spec summary', (): void => {
  describe('GIVEN a spec with info.title and info.version', (): void => {
    it('WHEN summarized THEN carries the id, title, version and every endpoint', async (): Promise<void> => {
      const spec = await studioSpec();

      const loaded = loadedSpec('spec-1', spec);

      expect(loaded).toMatchObject({ specId: 'spec-1', title: 'Studio API', version: '2.1.0' });
      expect(loaded.endpoints).toHaveLength(5);
    });
  });

  describe('GIVEN a spec without usable info', (): void => {
    it.each<[string, OpenApiSpec]>([
      ['no info', { openapi: '3.0.0' }],
      ['non-string fields', { openapi: '3.0.0', info: NON_STRING_INFO }]
    ])('WHEN it has %s THEN title and version are empty', (_label: string, spec: OpenApiSpec): void => {
      const loaded = loadedSpec('spec-2', spec);

      expect(loaded).toStrictEqual({ specId: 'spec-2', title: '', version: '', endpoints: [] });
    });
  });
});
