import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { runFixturesCli } from './fixtures-cli.client.ts';
import { promptedInputs } from './input-prompt.client.ts';
import type { CliResult } from '../test/common/cli-result.type.ts';
import { answering, silence } from '../test/utils/answering.spec.util.ts';
import { hasStackFrame, spawnFixturesCli } from '../test/utils/cli-result.spec.util.ts';

const TIMEOUT = 30000;
const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url));
const SPEC_URL = new URL('../test/fixtures/invoice/spec.json', import.meta.url).href;

const cli = async (args: string[]): Promise<CliResult> => {
  return spawnFixturesCli(args, PACKAGE_DIRECTORY);
};

const stderrLines = (result: CliResult): string[] => {
  return result.stderr.trimEnd().split('\n');
};

const capturedStdout = (): string[] => {
  const chunks: string[] = [];
  const write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  vi.spyOn(process.stdout, 'write').mockImplementation(write);

  return chunks;
};

describe('FEATURE: fixtures command line', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN the help flag', (): void => {
    it(
      'WHEN running THEN it prints the help on stdout and succeeds',
      async (): Promise<void> => {
        const result = await cli(['--help']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('usage: openapi-fixtures <spec-url> [schema-name]');
        expect(result.stdout).toContain('--required-only');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a spec URL and a schema name', (): void => {
    it(
      'WHEN running THEN it writes the fixture to stdout',
      async (): Promise<void> => {
        const result = await cli([SPEC_URL, 'invoice']);

        expect(result.code).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ id: 'in_123', status: 'draft' });
      },
      TIMEOUT
    );
  });

  describe('GIVEN a pruned spec carrying x-root-schema', (): void => {
    let directory: string;
    let prunedUrl: string;

    beforeAll(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'openapi-fixtures-'));

      const text = await readFile(new URL(SPEC_URL), 'utf8');
      const spec = JSON.parse(text) as object;
      const pruned = { ...spec, 'x-root-schema': 'invoice' };
      const file = join(directory, 'invoice.spec.json');

      await writeFile(file, JSON.stringify(pruned));
      prunedUrl = pathToFileURL(file).href;
    });

    afterAll(async (): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    });

    it(
      'WHEN running with only the spec THEN it samples the root schema to stdout',
      async (): Promise<void> => {
        const result = await cli([prunedUrl]);

        expect(result.code).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ id: 'in_123' });
      },
      TIMEOUT
    );

    it(
      'WHEN the second positional is not a schema THEN it is the out-file',
      async (): Promise<void> => {
        const outFile = join(directory, 'out.json');

        const result = await cli([prunedUrl, outFile]);

        expect(result.code).toBe(0);
        expect(result.stdout).toBe('');
        expect(JSON.parse(await readFile(outFile, 'utf8'))).toMatchObject({ id: 'in_123' });
      },
      TIMEOUT
    );

    it(
      'WHEN the plain spec is given without a schema THEN it asks for the name',
      async (): Promise<void> => {
        const result = await cli([SPEC_URL]);

        expect(result.code).toBe(1);
        expect(stderrLines(result)[0]).toBe('openapi-fixtures: schema name required');
        expect(stderrLines(result)[1]).toContain('fix: pass <schema-name>, or use a spec written by openapi-types');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a bare filesystem path instead of a spec URL', (): void => {
    it(
      'WHEN running THEN it fails with three lines and no stack trace',
      async (): Promise<void> => {
        const result = await cli(['invoice.json', 'invoice']);
        const lines = stderrLines(result);

        expect(result.code).toBe(1);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('openapi-fixtures: spec must be a URL, got bare path "invoice.json"');
        expect(lines[1]).toContain('fix: use file:///');
        expect(lines[2]).toBe('  see: openapi-fixtures --help');
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a misspelled schema name', (): void => {
    it(
      'WHEN running THEN it suggests the schema that exists',
      async (): Promise<void> => {
        const result = await cli([SPEC_URL, 'invoic']);

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('openapi-fixtures: schema not found: invoic');
        expect(result.stderr).toContain('fix: did you mean invoice?');
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN an unknown flag', (): void => {
    it(
      'WHEN running THEN it names the flag without the Node lecture',
      async (): Promise<void> => {
        const result = await cli([SPEC_URL, 'invoice', '--foo']);

        expect(result.code).toBe(1);
        expect(stderrLines(result)[0]).toBe("openapi-fixtures: Unknown option '--foo'");
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN no arguments', (): void => {
    it(
      'WHEN running THEN it prints the one-line usage',
      async (): Promise<void> => {
        const result = await cli([]);

        expect(result.code).toBe(1);
        expect(stderrLines(result)[0]).toContain('usage: <spec-url> [schema-name]');
      },
      TIMEOUT
    );
  });

  describe('GIVEN no arguments in a terminal', (): void => {
    it('WHEN the spec URL and schema are typed THEN writes the fixture to stdout', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const chunks = capturedStdout();
      const question = vi.fn(answering(SPEC_URL, 'invoice', '', '', ''));

      await runFixturesCli([], promptedInputs(question));

      expect(JSON.parse(chunks.join(''))).toMatchObject({ id: 'in_123', status: 'draft' });
      expect(question).toHaveBeenCalledTimes(5);
    });
  });

  describe('GIVEN the spec URL and schema as arguments', (): void => {
    it('WHEN running THEN never asks', async (): Promise<void> => {
      capturedStdout();
      const question = vi.fn(answering('unused'));

      await runFixturesCli([SPEC_URL, 'invoice'], promptedInputs(question));

      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a types file that does not exist', (): void => {
    it(
      'WHEN running THEN it names the flag and the path',
      async (): Promise<void> => {
        const result = await cli([SPEC_URL, 'invoice', 'stub.ts', '--ts', 'absent.d.ts']);

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('openapi-fixtures: --ts file "absent.d.ts" does not exist');
      },
      TIMEOUT
    );
  });
});
