import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CliResult } from './test/common/cli-result.type.ts';
import { hasStackFrame, spawnTypesCli } from './test/utils/cli-result.spec.util.ts';
import { specUrl } from './test/utils/spec-url.spec.util.ts';

const TIMEOUT = 60000;
/** The pruned spec keeps only the root schema, since the invoice fixture references nothing. */
const INVOICE_SCHEMAS = { invoice: expect.any(Object) as object };
const INVOICE_ONLY = { schemas: INVOICE_SCHEMAS };
const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));

const cli = async (args: string[]): Promise<CliResult> => {
  return spawnTypesCli(args, PACKAGE_DIRECTORY);
};

const stderrLines = (result: CliResult): string[] => {
  return result.stderr.trimEnd().split('\n');
};

describe('FEATURE: OpenAPI types command line', (): void => {
  describe('GIVEN the help flag', (): void => {
    it(
      'WHEN running THEN it prints the help on stdout and succeeds',
      async (): Promise<void> => {
        const result = await cli(['--help']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('usage: openapi-types <spec-url> [out-file]');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a spec URL', (): void => {
    it(
      'WHEN running THEN it writes the declarations to stdout',
      async (): Promise<void> => {
        const result = await cli([specUrl().href]);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('export interface components');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a spec URL, a schema name and an out-file', (): void => {
    let directory: string;

    beforeAll(async (): Promise<void> => {
      directory = await mkdtemp(join(tmpdir(), 'openapi-types-'));
    });

    afterAll(async (): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    });

    it(
      'WHEN running THEN it writes the declarations and a pruned spec that names its root schema',
      async (): Promise<void> => {
        const outFile = join(directory, 'invoice.d.ts');
        const specFile = join(directory, 'invoice.spec.json');

        const result = await cli([specUrl().href, 'invoice', outFile]);

        const types = await readFile(outFile, 'utf8');
        const pruned: unknown = JSON.parse(await readFile(specFile, 'utf8'));
        const expected = { openapi: '3.0.0', 'x-root-schema': 'invoice', components: INVOICE_ONLY };

        expect(result.code).toBe(0);
        expect(result.stderr).toContain('(1 schemas reachable from invoice)');
        expect(types).toContain('export interface components');
        expect(pruned).toStrictEqual(expect.objectContaining(expected));
        expect(pruned).not.toHaveProperty('paths');
      },
      TIMEOUT
    );

    it(
      'WHEN the out-file lacks the .d.ts suffix THEN it is appended',
      async (): Promise<void> => {
        const outFile = join(directory, 'bare');

        const result = await cli([specUrl().href, 'invoice', outFile]);

        expect(result.code).toBe(0);
        await expect(readFile(`${outFile}.d.ts`, 'utf8')).resolves.toContain('export interface components');
        await expect(readFile(`${outFile}.spec.json`, 'utf8')).resolves.toContain('"x-root-schema"');
      },
      TIMEOUT
    );

    it(
      'WHEN the out-file is under a directory that does not exist THEN it creates it',
      async (): Promise<void> => {
        const outFile = join(directory, 'new', 'deep', 'invoice.d.ts');

        const result = await cli([specUrl().href, 'invoice', outFile]);

        expect(result.code).toBe(0);
        await expect(readFile(outFile, 'utf8')).resolves.toContain('export interface components');
        await expect(readFile(join(directory, 'new', 'deep', 'invoice.spec.json'), 'utf8')).resolves.toContain('"x-root-schema"');
      },
      TIMEOUT
    );

    it(
      'WHEN the schema name is misspelled THEN it suggests the schema that exists',
      async (): Promise<void> => {
        const result = await cli([specUrl().href, 'invoic', join(directory, 'typo.d.ts')]);

        expect(result.code).toBe(1);
        expect(stderrLines(result)).toStrictEqual([
          'openapi-types: schema not found: invoic',
          '  fix: did you mean invoice?',
          '  see: openapi-types --help'
        ]);
      },
      TIMEOUT
    );

    it(
      'WHEN the spec is YAML THEN it refuses to prune',
      async (): Promise<void> => {
        const result = await cli(['file:///spec.yaml', 'invoice', join(directory, 'yaml.d.ts')]);

        expect(result.code).toBe(1);
        expect(stderrLines(result)[0]).toBe('openapi-types: schema-name requires a JSON spec');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a bare filesystem path instead of a spec URL', (): void => {
    it(
      'WHEN running THEN it fails with three lines and no stack trace',
      async (): Promise<void> => {
        const result = await cli(['invoice.json']);
        const lines = stderrLines(result);

        expect(result.code).toBe(1);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('openapi-types: spec must be a URL, got bare path "invoice.json"');
        expect(lines[1]).toContain('fix: use file:///');
        expect(lines[2]).toBe('  see: openapi-types --help');
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN an unknown flag', (): void => {
    it(
      'WHEN running THEN it names the flag without the Node lecture',
      async (): Promise<void> => {
        const result = await cli(['--foo']);

        expect(result.code).toBe(1);
        expect(stderrLines(result)[0]).toBe("openapi-types: Unknown option '--foo'");
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
        expect(stderrLines(result)[0]).toBe('openapi-types: usage: <spec-url> [schema-name] [out-file]');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a host that answers 404', (): void => {
    let server: Server;
    let port = 0;

    beforeAll(async (): Promise<void> => {
      const serve = (request: IncomingMessage, response: ServerResponse): void => {
        request.resume();
        response.statusCode = 404;
        response.end('not found');
      };

      server = createServer(serve);
      await once(server.listen(0, '127.0.0.1'), 'listening');

      const address = server.address();
      const isTcp = typeof address === 'object' && address !== null;

      if (isTcp) port = address.port;
    });

    afterAll(async (): Promise<void> => {
      const closed = once(server, 'close');

      server.close();
      await closed;
    });

    it(
      'WHEN running THEN it reports the failed download without a stack trace',
      async (): Promise<void> => {
        const result = await cli([`http://127.0.0.1:${port}/spec.json`]);

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('openapi-types: Failed to load');
        expect(result.stderr).toContain('see: openapi-types --help');
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });

  describe('GIVEN a file URL pointing at nothing', (): void => {
    it(
      'WHEN running THEN it reports the missing spec file',
      async (): Promise<void> => {
        const absent = new URL('./test/fixtures/invoice/absent.json', import.meta.url).href;

        const result = await cli([absent]);

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('openapi-types: spec file not found:');
        expect(hasStackFrame(result.stderr)).toBe(false);
      },
      TIMEOUT
    );
  });
});
