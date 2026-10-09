import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { studioArgs } from './studio-args.schema.ts';

const USAGE_FIX = 'run fixture-studio [--port <n>] [--no-open]';

describe('FEATURE: studio command-line arguments', (): void => {
  describe('GIVEN no arguments', (): void => {
    it('WHEN parsed THEN leaves the port unset and opens the browser', (): void => {
      const args = studioArgs([]);

      expect(args).toStrictEqual({ port: undefined, isOpen: true });
    });
  });

  describe('GIVEN a port and --no-open', (): void => {
    it('WHEN parsed THEN takes the port and keeps the browser closed', (): void => {
      const args = studioArgs(['--port', '4000', '--no-open']);

      expect(args).toStrictEqual({ port: 4000, isOpen: false });
    });
  });

  describe('GIVEN an invalid port', (): void => {
    it.each<[string]>([['0'], ['x'], ['70000']])('WHEN --port is "%s" THEN fails naming the range and a fix', (raw: string): void => {
      const message = `--port must be an integer from 1 to 65535, got "${raw}"`;

      expect((): unknown => studioArgs(['--port', raw])).toThrow(expect.objectContaining({ message, fix: 'pass e.g. --port 3333' }));
    });
  });

  describe('GIVEN an unknown flag', (): void => {
    it('WHEN parsed THEN fails naming the flag and the usage', (): void => {
      const message = 'unknown option "--verbose"';

      expect((): unknown => studioArgs(['--verbose'])).toThrow(expect.objectContaining({ message, fix: USAGE_FIX }));
    });
  });

  describe('GIVEN malformed arguments', (): void => {
    it.each<[string[]]>([[['extra']], [['--port']]])('WHEN parsed %j THEN fails with the usage fix', (argv: string[]): void => {
      expect((): unknown => studioArgs(argv)).toThrow(FixtureError);
      expect((): unknown => studioArgs(argv)).toThrow(expect.objectContaining({ fix: USAGE_FIX }));
    });
  });
});
