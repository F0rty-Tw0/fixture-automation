import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFixtureDiffCli } from './fixture-diff-cli.client.ts';
import type { DiffProject } from '../test/common/diff-project.type.ts';
import { answering } from '../test/utils/answering.spec.util.ts';
import { diffProject } from '../test/utils/diff-project.spec.util.ts';
import { dropPaths } from '../utils/drop-path.util.ts';

const DROPPED = ['id', 'customer.email', 'lines[1].sku'];
const TIMEOUT = 60000;

let project: DiffProject | undefined;

const started = async (): Promise<DiffProject> => {
  project = await diffProject();

  return project;
};

const silence = (): void => undefined;

describe('FEATURE: fixture diff command line', (): void => {
  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await project?.dispose();
    project = undefined;
  });

  describe('GIVEN a terminal missing the command and corrupt args', (): void => {
    it('WHEN corrupt is chosen and the paths are typed THEN writes the corrupted fixture to the out file', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const active = await started();
      const question = vi.fn(answering('corrupt', active.fixtureFile, active.corruptFile, 'id'));

      await runFixtureDiffCli([], promptedInputs(question));

      const corrupted: unknown = JSON.parse(await readFile(active.corruptFile, 'utf8'));

      expect(corrupted).not.toHaveProperty('id');
      expect(question).toHaveBeenCalledTimes(4);
    });
  });

  describe('GIVEN a sampled fixture and its spec', (): void => {
    it(
      'WHEN corrupting and then diffing THEN missing.json, missing.d.ts and missing.stub.ts describe the dropped paths',
      async (): Promise<void> => {
        const active = await started();
        const dropArgs = ['corrupt', active.fixtureFile, active.corruptFile, '--drop', DROPPED.join(',')];
        const diffArgs = ['diff', active.specUrl, 'order', '--fixture', active.corruptFile, '--out-dir', active.directory];

        await active.run(dropArgs);
        await active.run([...diffArgs, '--required-only']);

        const missing: unknown = JSON.parse(await readFile(join(active.directory, 'missing.json'), 'utf8'));
        const stub = await readFile(join(active.directory, 'missing.stub.ts'), 'utf8');
        const types = await readFile(join(active.directory, 'missing.d.ts'), 'utf8');
        const expected = { schemaName: 'order', paths: DROPPED };

        expect(missing).toMatchObject(expected);
        expect(stub).toContain('MISSING_STUB');
        expect(types).toContain('missing:');
      },
      TIMEOUT
    );

    it(
      'WHEN diffing a body-wrapped corrupted fixture THEN missing.json retains the body envelope and prefixes the paths',
      async (): Promise<void> => {
        const active = await started();
        const complete: unknown = JSON.parse(await readFile(active.fixtureFile, 'utf8'));
        const body = dropPaths(complete, DROPPED);
        const fixture = { body };
        const expectedPaths = DROPPED.map((path) => `body.${path}`);
        const diffArgs = [
          'diff',
          active.specUrl,
          'order',
          '--fixture',
          active.corruptFile,
          '--out-dir',
          active.directory,
          '--object-shape',
          'body',
          '--required-only'
        ];

        await writeFile(active.corruptFile, JSON.stringify(fixture));
        await active.run(diffArgs);

        const missing: unknown = JSON.parse(await readFile(join(active.directory, 'missing.json'), 'utf8'));
        const bodySchema = { type: 'object' };
        const properties = { body: bodySchema };
        const schema = { type: 'object', required: ['body'], properties };
        const expected = { paths: expectedPaths, schema };

        expect(missing).toMatchObject(expected);
      },
      TIMEOUT
    );

    it(
      'WHEN diffing a complete fixture THEN it reports no missing fields',
      async (): Promise<void> => {
        const active = await started();
        const diffArgs = ['diff', active.specUrl, 'order', '--fixture', active.fixtureFile, '--out-dir', active.directory];

        const result = await active.run([...diffArgs, '--required-only']);

        expect(result.stderr).toContain('no missing fields');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a pruned spec carrying x-root-schema', (): void => {
    it(
      'WHEN diffing without a schema name THEN the root schema is used',
      async (): Promise<void> => {
        const active = await started();
        const spec = JSON.parse(await readFile(join(active.directory, 'spec.json'), 'utf8')) as object;
        const pruned = { ...spec, 'x-root-schema': 'order' };
        const prunedFile = join(active.directory, 'pruned.json');

        await writeFile(prunedFile, JSON.stringify(pruned));

        const prunedUrl = pathToFileURL(prunedFile).href;
        const dropArgs = ['corrupt', active.fixtureFile, active.corruptFile, '--drop', DROPPED.join(',')];
        const diffArgs = ['diff', prunedUrl, '--fixture', active.corruptFile, '--out-dir', active.directory];

        await active.run(dropArgs);
        await active.run([...diffArgs, '--required-only']);

        const missing: unknown = JSON.parse(await readFile(join(active.directory, 'missing.json'), 'utf8'));
        const expected = { schemaName: 'order', paths: DROPPED };

        expect(missing).toMatchObject(expected);
      },
      TIMEOUT
    );

    it(
      'WHEN diffing a plain spec without a schema name THEN it asks for one',
      async (): Promise<void> => {
        const active = await started();
        const diffArgs = ['diff', active.specUrl, '--fixture', active.fixtureFile, '--out-dir', active.directory];
        const failure = active.run(diffArgs);

        await expect(failure).rejects.toThrow('openapi-fixture-diff: schema name required');
        await expect(failure).rejects.toThrow('fix: pass <schema-name>, or use a spec written by openapi-types');
      },
      TIMEOUT
    );
  });

  describe('GIVEN an unknown subcommand', (): void => {
    it(
      'WHEN running the command line THEN it fails with the usage text',
      async (): Promise<void> => {
        const active = await started();

        await expect(active.run(['populate'])).rejects.toThrow('openapi-fixture-diff: usage: corrupt');
      },
      TIMEOUT
    );
  });

  describe('GIVEN the help flag', (): void => {
    it.each([['--help'], ['diff', '--help'], ['corrupt', '--help']])(
      'WHEN running %s THEN it prints the help and succeeds',
      async (...args: string[]): Promise<void> => {
        const active = await started();

        const result = await active.run(args);

        expect(result.stdout).toContain('usage: openapi-fixture-diff <command>');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a --fixture file that does not exist', (): void => {
    it(
      'WHEN diffing THEN it names the flag and points at the help',
      async (): Promise<void> => {
        const active = await started();
        const args = ['diff', active.specUrl, 'order', '--fixture', 'nope.json', '--out-dir', active.directory];

        const failure = active.run(args);

        await expect(failure).rejects.toThrow('--fixture file "nope.json" does not exist');
        await expect(failure).rejects.toThrow('see: openapi-fixture-diff --help');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a --fixture file holding broken JSON', (): void => {
    it(
      'WHEN diffing THEN it names the file alongside the parser message',
      async (): Promise<void> => {
        const active = await started();
        const broken = join(active.directory, 'broken.json');

        await writeFile(broken, '{ not json');

        const args = ['diff', active.specUrl, 'order', '--fixture', broken, '--out-dir', active.directory];

        await expect(active.run(args)).rejects.toThrow('is not valid JSON');
      },
      TIMEOUT
    );
  });

  describe('GIVEN a dropped path the fixture does not have', (): void => {
    it(
      'WHEN corrupting THEN it lists the keys that are present',
      async (): Promise<void> => {
        const active = await started();
        const args = ['corrupt', active.fixtureFile, active.corruptFile, '--drop', 'nope.zzz'];

        const failure = active.run(args);

        await expect(failure).rejects.toThrow('unknown fixture path "nope.zzz"');
        await expect(failure).rejects.toThrow('available:');
      },
      TIMEOUT
    );
  });
});
