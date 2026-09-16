import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import type { Question } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFixtureDiffCli } from './fixture-diff-cli.client.ts';
import { nestedFile } from '../test/utils/nested-spec.spec.util.ts';
import { parseCorruptArgs, parseDiffArgs } from '../utils/fixture-diff-cli.util.ts';

const answering = (...answers: string[]): Question => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

const silence = (): void => undefined;

describe('FEATURE: fixture diff command line in a terminal', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a terminal missing the command and corrupt args', (): void => {
    it('WHEN corrupt is chosen and the paths are typed THEN writes the corrupted fixture to the out file', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const directory = await mkdtemp(join(tmpdir(), 'fixture-diff-prompt-'));

      try {
        const outFile = join(directory, 'corrupt.json');
        const question = vi.fn(answering('corrupt', nestedFile('order.json'), outFile, 'id'));

        await runFixtureDiffCli([], promptedInputs(question));

        const corrupted: unknown = JSON.parse(await readFile(outFile, 'utf8'));

        expect(corrupted).not.toHaveProperty('id');
        expect(question).toHaveBeenCalledTimes(4);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
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

  describe('GIVEN --drop is missing in a silent, non-interactive run', (): void => {
    it('WHEN parsing corrupt args THEN the fix names the drop syntax', async (): Promise<void> => {
      const failure = parseCorruptArgs(['fixture.json', 'out.json']);

      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: 'example: --drop id,customer.email,lines[1].sku' }));
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
