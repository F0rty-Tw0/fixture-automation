import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import type { Question } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseMergeArgs } from './fixture-merge-cli.util.ts';
import type { MergeInput } from '../common/fixture-merge.type.ts';

const answering = (...answers: string[]): Question => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

const silence = (): void => undefined;

describe('FEATURE: fixture merge argument parsing', (): void => {
  describe('GIVEN three positionals with a spec and a schema', (): void => {
    it('WHEN parsing THEN it returns the validated merge input', async (): Promise<void> => {
      const args = ['corrupt.json', 'populated.json', 'out.json', '--spec', 'file:///spec.json', '--schema', 'invoice'];
      const spec = { url: 'file:///spec.json', schemaName: 'invoice' };
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json', spec };

      await expect(parseMergeArgs(args)).resolves.toStrictEqual(expected);
    });
  });

  describe('GIVEN three positionals without validation flags', (): void => {
    it('WHEN parsing THEN the spec is absent', async (): Promise<void> => {
      const args = ['corrupt.json', 'populated.json', 'out.json'];
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json' };

      await expect(parseMergeArgs(args)).resolves.toStrictEqual(expected);
    });
  });

  describe('GIVEN the help flag', (): void => {
    it('WHEN parsing THEN it returns nothing so the caller prints usage', async (): Promise<void> => {
      await expect(parseMergeArgs(['--help'])).resolves.toBeUndefined();
    });
  });

  describe('GIVEN a spec without a schema', (): void => {
    it('WHEN parsing THEN the schema name is left for the spec to supply', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'c.json', '--spec', 'file:///spec.json'];
      const spec = { url: 'file:///spec.json', schemaName: undefined };
      const expected: MergeInput = { corruptFile: 'a.json', populatedFile: 'b.json', outFile: 'c.json', spec };

      await expect(parseMergeArgs(args)).resolves.toStrictEqual(expected);
    });
  });

  describe('GIVEN a schema without a spec', (): void => {
    it('WHEN parsing THEN it rejects the half-configured validation', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'c.json', '--schema', 'invoice'];

      await expect(parseMergeArgs(args)).rejects.toThrow('--schema requires --spec');
    });
  });

  describe('GIVEN blank validation values', (): void => {
    it('WHEN parsing THEN it rejects the empty flags', async (): Promise<void> => {
      const args = ['a.json', 'b.json', 'c.json', '--spec', '', '--schema', ''];

      await expect(parseMergeArgs(args)).rejects.toThrow('--spec and --schema require non-empty values');
    });
  });

  describe.each([
    ['too few positionals', ['corrupt.json', 'populated.json']],
    ['too many positionals', ['a.json', 'b.json', 'c.json', 'd.json']]
  ])('GIVEN %s', (_name: string, args: string[]): void => {
    it('WHEN parsing THEN it reports the usage line', async (): Promise<void> => {
      await expect(parseMergeArgs(args)).rejects.toThrow('usage: <corrupt.json> <populated.json|populated.stub.ts> <out.json>');
    });
  });

  describe('GIVEN a terminal missing all three positionals', (): void => {
    afterEach((): void => {
      vi.restoreAllMocks();
    });

    it('WHEN answers fill the positionals and both flags THEN the spec is included', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('corrupt.json', 'populated.json', 'out.json', 'file:///spec.json', 'invoice'));
      const spec = { url: 'file:///spec.json', schemaName: 'invoice' };
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json', spec };

      await expect(parseMergeArgs([], promptedInputs(question))).resolves.toStrictEqual(expected);
      expect(question).toHaveBeenCalledTimes(5);
    });

    it('WHEN --spec is skipped THEN --schema is never asked', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('corrupt.json', 'populated.json', 'out.json', ''));
      const expected: MergeInput = { corruptFile: 'corrupt.json', populatedFile: 'populated.json', outFile: 'out.json' };

      await expect(parseMergeArgs([], promptedInputs(question))).resolves.toStrictEqual(expected);
      expect(question).toHaveBeenCalledTimes(4);
    });
  });

  describe('GIVEN all three positionals as arguments', (): void => {
    it('WHEN parsing THEN it never asks', async (): Promise<void> => {
      const args = ['corrupt.json', 'populated.json', 'out.json'];
      const question = vi.fn(answering('unused'));

      await parseMergeArgs(args, promptedInputs(question));

      expect(question).not.toHaveBeenCalled();
    });
  });
});
