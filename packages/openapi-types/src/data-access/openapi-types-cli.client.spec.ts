import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { answering, silence } from '@fixture-automation/shared/testing';

import { runTypesCli } from './openapi-types-cli.client.ts';
import { specUrl } from '../test/utils/spec-url.spec.util.ts';

const SPEC_URL = specUrl().href;

const capturedStdout = (): string[] => {
  const chunks: string[] = [];
  const write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  vi.spyOn(process.stdout, 'write').mockImplementation(write);

  return chunks;
};

describe('FEATURE: OpenAPI types command line in a terminal', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN no arguments', (): void => {
    it('WHEN the spec URL is typed and the optionals are skipped THEN writes the declarations to stdout', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const chunks = capturedStdout();
      const question = vi.fn(answering(SPEC_URL, '', ''));

      await runTypesCli([], promptedInputs(question));

      expect(chunks.join('')).toContain('export');
      expect(question).toHaveBeenCalledTimes(3);
    });
  });

  describe('GIVEN the spec URL as an argument', (): void => {
    it('WHEN running THEN never asks', async (): Promise<void> => {
      capturedStdout();
      const question = vi.fn(answering('unused'));

      await runTypesCli([SPEC_URL], promptedInputs(question));

      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a schema name is answered but the out-file is skipped', (): void => {
    it('WHEN running THEN it rejects asking for an out-file', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering(SPEC_URL, 'invoice', ''));

      await expect(runTypesCli([], promptedInputs(question))).rejects.toThrow('schema-name needs an out-file');
    });
  });

  describe('GIVEN the schema is skipped but the out-file is answered', (): void => {
    let directory: string;

    beforeAll(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'openapi-types-'));
    });

    afterAll(async (): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    });

    it('WHEN running THEN it writes the declarations to the answered out-file', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const outFile = join(directory, 'invoice.d.ts');
      const question = vi.fn(answering(SPEC_URL, '', outFile));

      await runTypesCli([], promptedInputs(question));

      await expect(readFile(outFile, 'utf8')).resolves.toContain('export');
    });
  });
});
