import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { parseMergeArgs } from './fixture-merge-cli.util.ts';

const ENDPOINT_URL = 'https://api.example.com/v1/invoices/in_2';

describe('FEATURE: fixture merge argument parsing', (): void => {
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

  describe('GIVEN too few positional arguments', (): void => {
    it('WHEN parsing THEN it rejects a merge without a destination directory', async (): Promise<void> => {
      const args = ['a.json', 'b.json', '--endpoint-url', ENDPOINT_URL];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });

  describe('GIVEN too many positional arguments', (): void => {
    it('WHEN parsing THEN it rejects ambiguous input files', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'fixtures', 'extra.json', '--endpoint-url', ENDPOINT_URL];

      await expect(parseMergeArgs(args)).rejects.toThrow(FixtureError);
    });
  });
});
