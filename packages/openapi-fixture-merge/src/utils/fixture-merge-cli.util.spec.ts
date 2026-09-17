import { FixtureError, promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { answering } from '@fixture-automation/shared/testing';

import { parseMergeArgs } from './fixture-merge-cli.util.ts';

const ENDPOINT_URL = 'https://api.example.com/v1/invoices/in_2';

describe('FEATURE: fixture merge argument parsing', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a schema without a spec', (): void => {
    it('WHEN parsing THEN it rejects incomplete validation configuration', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'fixtures', '--endpoint-url', ENDPOINT_URL, '--schema', 'invoice'];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });

  describe('GIVEN blank validation values', (): void => {
    it('WHEN parsing THEN it rejects the empty flags', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'fixtures', '--endpoint-url', ENDPOINT_URL, '--spec', '', '--schema', ''];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });

  describe('GIVEN a shaped merge and a subdirectory', (): void => {
    it('WHEN parsing THEN it trims both optional values', async (): Promise<void> => {
      const args = [
        'a.json',
        'b.json',
        'fixtures',
        '--endpoint-url',
        ENDPOINT_URL,
        '--object-shape',
        ' body ',
        '--subdirectory',
        ' /savings/ '
      ];

      const input = await parseMergeArgs(args);

      expect(input).toStrictEqual({
        corruptFile: 'a.json',
        populatedFile: 'b.json',
        outDir: 'fixtures',
        endpointUrl: ENDPOINT_URL,
        objectShape: 'body',
        subdirectory: '/savings/'
      });
    });
  });

  describe('GIVEN a blank endpoint URL', (): void => {
    it('WHEN parsing THEN it rejects a merge without endpoint identity', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'fixtures', '--endpoint-url', ''];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });

  describe('GIVEN no endpoint flag and a terminal answering method then target-url', (): void => {
    it('WHEN parsing THEN joins the prompted answers into the endpoint identity', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation((): void => undefined);
      const inputs = promptedInputs(answering('get', 'v1/invoices/in_1', '', '', ''));

      const input = await parseMergeArgs(['a.json', 'b.json', 'fixtures'], inputs);

      expect(input).toMatchObject({ endpointUrl: 'get,v1/invoices/in_1' });
    });
  });

  describe('GIVEN too few positional arguments', (): void => {
    it('WHEN parsing THEN it rejects a merge without a populated file', async (): Promise<void> => {
      const args = ['a.json', '--endpoint-url', ENDPOINT_URL];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });

  describe('GIVEN no out-dir positional in a silent, non-interactive run', (): void => {
    it('WHEN parsing THEN the out dir defaults to fixtures', async (): Promise<void> => {
      const args = ['a.json', 'b.json', '--endpoint-url', ENDPOINT_URL];

      const input = await parseMergeArgs(args);

      expect(input?.outDir).toBe('fixtures');
    });
  });

  describe('GIVEN an empty-string out-dir positional in a silent, non-interactive run', (): void => {
    it('WHEN parsing THEN the out dir falls back to fixtures', async (): Promise<void> => {
      const args = ['a.json', 'b.json', '', '--endpoint-url', ENDPOINT_URL];

      const input = await parseMergeArgs(args);

      expect(input?.outDir).toBe('fixtures');
    });
  });

  describe('GIVEN a terminal missing the populated file and the out-dir', (): void => {
    it('WHEN Enter answers out-dir THEN the out dir defaults to fixtures', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation((): void => undefined);
      const question = vi.fn(answering('b.json', '', 'get', 'v1/invoices/in_1', '', '', ''));

      const input = await parseMergeArgs(['a.json'], promptedInputs(question));

      expect(input).toMatchObject({ populatedFile: 'b.json', outDir: 'fixtures', endpointUrl: 'get,v1/invoices/in_1' });
      expect(question).toHaveBeenCalledTimes(7);
    });
  });

  describe('GIVEN too many positional arguments', (): void => {
    it('WHEN parsing THEN it rejects ambiguous input files', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'fixtures', 'extra.json', '--endpoint-url', ENDPOINT_URL];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });
});
