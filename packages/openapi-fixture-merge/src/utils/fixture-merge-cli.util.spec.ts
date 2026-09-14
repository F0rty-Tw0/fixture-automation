import { describe, expect, it } from 'vitest';

import { parseMergeArgs } from './fixture-merge-cli.util.ts';
import type { MergeInput } from '../common/fixture-merge.type.ts';

describe('FEATURE: fixture merge argument parsing', (): void => {
  describe('GIVEN three positionals with a spec and a schema', (): void => {
    it('WHEN parsing THEN it returns the validated merge input', (): void => {
      const args = ['corrupt.json', 'populated.json', 'out.json', '--spec', 'file:///spec.json', '--schema', 'invoice'];
      const spec = { url: 'file:///spec.json', schemaName: 'invoice' };
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json', spec };

      expect(parseMergeArgs(args)).toStrictEqual(expected);
    });
  });

  describe('GIVEN three positionals without validation flags', (): void => {
    it('WHEN parsing THEN the spec is absent', (): void => {
      const args = ['corrupt.json', 'populated.json', 'out.json'];
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json' };

      expect(parseMergeArgs(args)).toStrictEqual(expected);
    });
  });

  describe('GIVEN the help flag', (): void => {
    it('WHEN parsing THEN it returns nothing so the caller prints usage', (): void => {
      expect(parseMergeArgs(['--help'])).toBeUndefined();
    });
  });

  describe('GIVEN a spec without a schema', (): void => {
    it('WHEN parsing THEN the schema name is left for the spec to supply', (): void => {
      const args = ['a.json', 'b.json', 'c.json', '--spec', 'file:///spec.json'];
      const spec = { url: 'file:///spec.json', schemaName: undefined };
      const expected: MergeInput = { corruptFile: 'a.json', populatedFile: 'b.json', outFile: 'c.json', spec };

      expect(parseMergeArgs(args)).toStrictEqual(expected);
    });
  });

  describe('GIVEN a schema without a spec', (): void => {
    it('WHEN parsing THEN it rejects the half-configured validation', (): void => {
      const args = ['a.json', 'b.json', 'c.json', '--schema', 'invoice'];

      expect((): unknown => parseMergeArgs(args)).toThrow('--schema requires --spec');
    });
  });

  describe('GIVEN blank validation values', (): void => {
    it('WHEN parsing THEN it rejects the empty flags', (): void => {
      const args = ['a.json', 'b.json', 'c.json', '--spec', '', '--schema', ''];

      expect((): unknown => parseMergeArgs(args)).toThrow('--spec and --schema require non-empty values');
    });
  });

  describe.each([
    ['too few positionals', ['corrupt.json', 'populated.json']],
    ['too many positionals', ['a.json', 'b.json', 'c.json', 'd.json']]
  ])('GIVEN %s', (_name: string, args: string[]): void => {
    it('WHEN parsing THEN it reports the usage line', (): void => {
      expect((): unknown => parseMergeArgs(args)).toThrow('usage: <corrupt.json> <populated.json|populated.stub.ts> <out.json>');
    });
  });
});
