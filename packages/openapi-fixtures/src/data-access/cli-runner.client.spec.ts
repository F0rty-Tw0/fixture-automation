import { parseArgs } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCli } from './cli-runner.client.ts';
import { FixtureError } from '../common/fixture.error.ts';

const captured = (): string[] => {
  const lines: string[] = [];
  const write = (chunk: unknown): boolean => {
    lines.push(String(chunk));

    return true;
  };

  vi.spyOn(process.stderr, 'write').mockImplementation(write);

  return lines;
};

const failing = (error: unknown): (() => Promise<void>) => {
  return async (): Promise<void> => Promise.reject(error);
};

describe('FEATURE: command line failure reporting', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  describe('GIVEN a fixture error carrying a fix', (): void => {
    it('WHEN the command runs THEN it prints three lines and fails', async (): Promise<void> => {
      const lines = captured();
      const error = new FixtureError('spec must be a URL', 'use file:///spec.json');

      await runCli('openapi-fixtures', failing(error));

      expect(lines).toStrictEqual([
        'openapi-fixtures: spec must be a URL\n',
        '  fix: use file:///spec.json\n',
        '  see: openapi-fixtures --help\n'
      ]);
      expect(process.exitCode).toBe(1);
    });
  });

  describe('GIVEN a fixture error without a fix', (): void => {
    it('WHEN the command runs THEN it omits the fix line', async (): Promise<void> => {
      const lines = captured();

      await runCli('openapi-fixtures', failing(new FixtureError('schema not found')));

      expect(lines).toStrictEqual(['openapi-fixtures: schema not found\n', '  see: openapi-fixtures --help\n']);
    });
  });

  describe('GIVEN an unknown command line option', (): void => {
    it('WHEN the command runs THEN it drops the positional-argument lecture', async (): Promise<void> => {
      const lines = captured();
      const parse = async (): Promise<void> => {
        parseArgs({ args: ['--foo'], options: {}, allowPositionals: true });

        return Promise.resolve();
      };

      await runCli('openapi-fixtures', parse);

      expect(lines[0]).toBe("openapi-fixtures: Unknown option '--foo'\n");
      expect(lines).toHaveLength(2);
    });
  });

  describe('GIVEN a missing path reported by Node', (): void => {
    it('WHEN the command runs THEN it names the path and offers the parent directory', async (): Promise<void> => {
      const lines = captured();
      const error = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT', path: 'nope-dir/out.json' });

      await runCli('openapi-fixtures', failing(error));

      expect(lines).toStrictEqual([
        'openapi-fixtures: no such file or directory: nope-dir/out.json\n',
        '  fix: create the parent directory, or check the path\n',
        '  see: openapi-fixtures --help\n'
      ]);
    });
  });

  describe('GIVEN a value that is not an error', (): void => {
    it('WHEN the command runs THEN it prints the value', async (): Promise<void> => {
      const lines = captured();

      await runCli('openapi-fixtures', failing('boom'));

      expect(lines[0]).toBe('openapi-fixtures: boom\n');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('GIVEN a command that succeeds', (): void => {
    it('WHEN the command runs THEN it writes nothing and leaves the exit code alone', async (): Promise<void> => {
      const lines = captured();

      await runCli('openapi-fixtures', async (): Promise<void> => Promise.resolve());

      expect(lines).toStrictEqual([]);
      expect(process.exitCode).toBe(0);
    });
  });
});
