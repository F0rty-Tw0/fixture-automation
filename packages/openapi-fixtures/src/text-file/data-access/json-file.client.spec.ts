import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readJsonFile, readTextFile, writeTextFile } from './json-file.client.ts';

let directory: string;

describe('FEATURE: labelled JSON file reading', (): void => {
  beforeAll(async (): Promise<void> => {
    directory = await mkdtemp(join(tmpdir(), 'json-file-'));
  });

  afterAll(async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('GIVEN a JSON file that exists', (): void => {
    it('WHEN read THEN returns the parsed value', async (): Promise<void> => {
      const file = join(directory, 'good.json');

      await writeFile(file, '{"id":"in_1"}');

      await expect(readJsonFile('--fixture', file)).resolves.toStrictEqual({ id: 'in_1' });
    });
  });

  describe('GIVEN a file that does not exist', (): void => {
    it('WHEN read as text THEN names the flag and the path', async (): Promise<void> => {
      const file = join(directory, 'absent.json');

      await expect(readTextFile('--missing', file)).rejects.toThrow(`--missing file "${file}" does not exist`);
    });

    it('WHEN read as JSON THEN names the flag and the path', async (): Promise<void> => {
      const file = join(directory, 'absent.json');

      await expect(readJsonFile('--fixture', file)).rejects.toThrow(`--fixture file "${file}" does not exist`);
    });
  });

  describe('GIVEN a file whose contents are not JSON', (): void => {
    it('WHEN read as JSON THEN names the file alongside the parser message', async (): Promise<void> => {
      const file = join(directory, 'broken.json');

      await writeFile(file, '{ not json');

      await expect(readJsonFile('--fixture', file)).rejects.toThrow(`--fixture file "${file}" is not valid JSON`);
    });
  });

  describe('GIVEN an out-file whose parent directory does not exist', (): void => {
    it('WHEN written THEN creates the directory and writes the file', async (): Promise<void> => {
      const file = join(directory, 'nested', 'deep', 'out.txt');

      await writeTextFile(file, 'hello');

      await expect(readFile(file, 'utf8')).resolves.toBe('hello');
    });
  });
});
