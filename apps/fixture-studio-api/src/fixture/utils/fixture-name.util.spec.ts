import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fixtureFileName } from './fixture-name.util.ts';
import type { FixtureNameQuery } from '../../contract/common/studio-api.type.ts';
import { mergedFileName } from '../test/utils/merged-file-name.spec.util.ts';

describe('FEATURE: fixture file name', (): void => {
  beforeEach((): void => {
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a concrete URL and no subdirectory', (): void => {
    it('WHEN named THEN matches the file the CLI merge writes for METHOD,url', async (): Promise<void> => {
      const query: FixtureNameQuery = { method: 'GET', url: 'v1/invoices/in_1' };
      const merged = await mergedFileName('GET,v1/invoices/in_1', undefined);

      const result = fixtureFileName(query);

      expect(result).toStrictEqual({ fileName: merged });
    });
  });

  describe('GIVEN a subdirectory', (): void => {
    it('WHEN named THEN matches the file the CLI merge writes under that subdirectory', async (): Promise<void> => {
      const query: FixtureNameQuery = { method: 'GET', url: '/custodies/v2', subdirectory: '/savings/' };
      const merged = await mergedFileName('GET,/custodies/v2', '/savings/');

      const result = fixtureFileName(query);

      expect(result).toStrictEqual({ fileName: merged });
      expect(result.fileName).toBe('A1eWVIW3jNsYQIoF4+npW9FHXp0=.json');
    });
  });

  describe('GIVEN the path template, as the wizard route flow reuses it', (): void => {
    it.each(['v1/invoices/{id}', '/v1/invoices/{id}'])(
      'WHEN %s is named THEN matches the file the wizard route flow writes',
      async (url): Promise<void> => {
        const query: FixtureNameQuery = { method: 'GET', url };
        const merged = await mergedFileName('GET,v1/invoices/{id}', undefined);

        const result = fixtureFileName(query);

        expect(result).toStrictEqual({ fileName: merged });
      }
    );
  });

  describe('GIVEN a lowercase method and a blank subdirectory', (): void => {
    it('WHEN named THEN hashes like the uppercase method without a prefix', (): void => {
      const query: FixtureNameQuery = { method: 'get', url: 'v1/invoices', subdirectory: ' ' };

      const result = fixtureFileName(query);

      expect(result.fileName).toBe('OWzbMzaHATEVIEad+9Zr9i1sJwQ=.json');
    });
  });
});
