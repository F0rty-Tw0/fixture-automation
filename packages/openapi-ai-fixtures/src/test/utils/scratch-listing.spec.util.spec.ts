import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scratchFilePaths } from './scratch-listing.spec.util.ts';

describe('FEATURE: scratch directory listing', (): void => {
  describe('GIVEN a directory with a top-level file and files in nested folders', (): void => {
    let directory: string;

    beforeAll(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'scratch-listing-spec-'));

      await mkdir(join(directory, '.github', 'agents'), { recursive: true });
      await mkdir(join(directory, 'empty'));
      await writeFile(join(directory, 'baseline.json'), '{}', 'utf8');
      await writeFile(join(directory, '.github', 'agents', 'fixture-enricher.agent.md'), 'agent', 'utf8');
    });

    afterAll(async (): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    });

    it('WHEN its entries are listed THEN only the files remain, as sorted "/"-joined relative paths', async (): Promise<void> => {
      const entries = await readdir(directory, { recursive: true, withFileTypes: true });

      const paths = scratchFilePaths(directory, entries);

      expect(paths).toStrictEqual(['.github/agents/fixture-enricher.agent.md', 'baseline.json']);
    });
  });
});
