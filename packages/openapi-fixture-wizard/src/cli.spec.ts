import { describe, expect, it } from 'vitest';

import { spawnWizardCli } from './test/utils/wizard-cli.spec.util.ts';

const TIMEOUT = 30000;

describe('FEATURE: wizard command line', (): void => {
  describe('GIVEN no terminal', (): void => {
    it(
      'WHEN running THEN fails with the three-line terminal error',
      async (): Promise<void> => {
        const result = await spawnWizardCli([]);

        expect(result.code).toBe(1);
        expect(result.stderr.trimEnd().split('\n')).toStrictEqual([
          'openapi-fixture-wizard: the wizard needs a terminal',
          '  fix: run the individual CLIs instead',
          '  see: openapi-fixture-wizard --help'
        ]);
      },
      TIMEOUT
    );
  });

  describe('GIVEN the help flag', (): void => {
    it(
      'WHEN running THEN prints the prompts on stdout and succeeds',
      async (): Promise<void> => {
        const result = await spawnWizardCli(['--help']);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('usage: openapi-fixture-wizard');
        expect(result.stdout).toContain('existing-fixture');
      },
      TIMEOUT
    );
  });
});
