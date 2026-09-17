import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseCorruptArgs, parseDiffArgs } from './fixture-diff-cli.util.ts';
import { CORRUPT_USAGE, DIFF_USAGE } from '../common/fixture-diff-cli.const.ts';
import { answering } from '../test/utils/answering.spec.util.ts';

const DROP_FIX = 'example: --drop id,customer.email,lines[1].sku';
const DIFF_ARGS = ['file:///spec.json', '--fixture', 'corrupt.json', '--out-dir', 'out'];
const DIFF_FLAGS = DIFF_ARGS.slice(1);

const silence = (): void => undefined;

describe('FEATURE: fixture diff command line argument parsing', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN corrupt args holding the fixture, out file and a spaced drop list', (): void => {
    it('WHEN parsing corrupt args THEN the trimmed paths are returned with both files', async (): Promise<void> => {
      const args = ['fixture.json', 'out.json', '--drop', ' id , customer.email '];
      const expected = { fixtureFile: 'fixture.json', outFile: 'out.json', paths: ['id', 'customer.email'] };

      const parsed = await parseCorruptArgs(args);

      expect(parsed).toStrictEqual(expected);
    });
  });

  describe('GIVEN corrupt args whose drop list holds an empty path', (): void => {
    it('WHEN parsing corrupt args THEN it fails with the drop syntax', async (): Promise<void> => {
      const failure = parseCorruptArgs(['fixture.json', 'out.json', '--drop', 'id,,sku']);

      await expect(failure).rejects.toThrow('--drop requires a comma separated list of fixture paths');
    });
  });

  describe('GIVEN the corrupt help flag', (): void => {
    it('WHEN parsing corrupt args THEN nothing is returned', async (): Promise<void> => {
      const parsed = await parseCorruptArgs(['-h']);

      expect(parsed).toBeUndefined();
    });
  });

  describe('GIVEN three corrupt positionals', (): void => {
    it('WHEN parsing corrupt args THEN it fails with the corrupt usage', async (): Promise<void> => {
      const failure = parseCorruptArgs(['a.json', 'b.json', 'c.json', '--drop', 'id']);

      await expect(failure).rejects.toThrow(CORRUPT_USAGE);
    });
  });

  describe('GIVEN --drop is missing in a silent, non-interactive run', (): void => {
    it('WHEN parsing corrupt args THEN the fix names the drop syntax', async (): Promise<void> => {
      const failure = parseCorruptArgs(['fixture.json', 'out.json']);

      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: DROP_FIX }));
    });
  });

  describe('GIVEN the out file is missing in a silent, non-interactive run', (): void => {
    it('WHEN parsing corrupt args THEN it fails with the corrupt usage', async (): Promise<void> => {
      const failure = parseCorruptArgs(['fixture.json', '--drop', 'id']);

      await expect(failure).rejects.toThrow(CORRUPT_USAGE);
    });
  });

  describe('GIVEN spec-url, --fixture, --out-dir and --object-shape as arguments', (): void => {
    it('WHEN parsing diff args THEN never asks and retains the object shape', async (): Promise<void> => {
      const question = vi.fn(answering('unused'));
      const args = ['file:///spec.json', '--fixture', 'corrupt.json', '--out-dir', 'out', '--object-shape', 'body'];

      const parsed = await parseDiffArgs(args, promptedInputs(question));

      expect(parsed).toMatchObject({
        specUrl: 'file:///spec.json',
        fixtureFile: 'corrupt.json',
        outDir: 'out',
        objectShape: 'body',
        requiredOnly: false
      });
      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN diff args with a schema name, --required-only and a padded --object-shape', (): void => {
    it('WHEN parsing diff args THEN the schema name, flag and trimmed shape are returned', async (): Promise<void> => {
      const args = ['file:///spec.json', 'order', ...DIFF_FLAGS, '--required-only', '--object-shape', ' body '];
      const expected = {
        specUrl: 'file:///spec.json',
        schemaName: 'order',
        fixtureFile: 'corrupt.json',
        outDir: 'out',
        requiredOnly: true,
        objectShape: 'body'
      };

      const parsed = await parseDiffArgs(args);

      expect(parsed).toStrictEqual(expected);
    });
  });

  describe('GIVEN diff args with a blank --object-shape', (): void => {
    it('WHEN parsing diff args THEN the object shape is absent', async (): Promise<void> => {
      const parsed = await parseDiffArgs([...DIFF_ARGS, '--object-shape', '  ']);

      expect(parsed?.objectShape).toBeUndefined();
    });
  });

  describe('GIVEN the diff help flag', (): void => {
    it('WHEN parsing diff args THEN nothing is returned', async (): Promise<void> => {
      const parsed = await parseDiffArgs(['--help']);

      expect(parsed).toBeUndefined();
    });
  });

  describe('GIVEN three diff positionals', (): void => {
    it('WHEN parsing diff args THEN it fails with the diff usage', async (): Promise<void> => {
      const failure = parseDiffArgs(['file:///spec.json', 'order', 'extra', '--fixture', 'c.json', '--out-dir', 'out']);

      await expect(failure).rejects.toThrow(DIFF_USAGE);
    });
  });

  describe('GIVEN --fixture is missing in a silent, non-interactive run', (): void => {
    it('WHEN parsing diff args THEN it names the flag and points at the corrupt output', async (): Promise<void> => {
      const failure = parseDiffArgs(['file:///spec.json', '--out-dir', 'out']);

      await expect(failure).rejects.toThrow('--fixture requires an existing JSON fixture file');
      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: 'pass the corrupt fixture written by corrupt' }));
    });
  });

  describe('GIVEN --out-dir is missing in a silent, non-interactive run', (): void => {
    it('WHEN parsing diff args THEN it names the flag', async (): Promise<void> => {
      const failure = parseDiffArgs(['file:///spec.json', '--fixture', 'corrupt.json']);

      await expect(failure).rejects.toThrow('--out-dir requires a destination directory');
    });
  });

  describe('GIVEN a terminal missing spec-url, --fixture and --out-dir', (): void => {
    it('WHEN schema-name and object-shape are skipped and required-only is confirmed THEN resolves the rest', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = answering('file:///spec.json', 'corrupt.json', 'out', '', '', 'y');

      const parsed = await parseDiffArgs([], promptedInputs(question));

      expect(parsed).toMatchObject({
        specUrl: 'file:///spec.json',
        fixtureFile: 'corrupt.json',
        outDir: 'out',
        schemaName: undefined,
        objectShape: undefined,
        requiredOnly: true
      });
    });
  });
});
