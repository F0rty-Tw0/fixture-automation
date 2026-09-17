import { describe, expect, it } from 'vitest';

import { runModelCli } from './test/utils/model-cli.spec.util.ts';
import { processFixture } from './test/utils/process-fixture.spec.util.ts';

const CODEX = processFixture('model-discovery', 'codex.mjs');

describe('FEATURE: AI model listing command', (): void => {
  describe('GIVEN a provider executable override with a paginated catalog', (): void => {
    it('WHEN listing without a spec THEN prints current model IDs separately from provenance', async (): Promise<void> => {
      const result = await runModelCli(['--tool', 'codex', '--executable', CODEX]);

      expect(result.stdout).toBe('new-model-a\nnew-model-b\n');
      expect(result.stderr).toContain('source: codex-cli');
    });
  });

  describe('GIVEN an unavailable provider executable', (): void => {
    it('WHEN listing THEN fails without printing stale model names', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'not-installed.exe');
      const listing = runModelCli(['--tool', 'claude', '--executable', executable]);

      await expect(listing).rejects.toMatchObject({ code: 1, stdout: '' });
    });
  });

  describe('GIVEN a model listing without a provider', (): void => {
    it('WHEN listing THEN rejects rather than choosing a provider', async (): Promise<void> => {
      const listing = runModelCli([]);

      await expect(listing).rejects.toMatchObject({ code: 1 });
    });
  });

  describe('GIVEN an invalid discovery timeout', (): void => {
    it('WHEN listing THEN rejects before invoking the provider', async (): Promise<void> => {
      const listing = runModelCli(['--tool', 'codex', '--executable', CODEX, '--timeout', '0']);

      await expect(listing).rejects.toMatchObject({ code: 1, stdout: '' });
    });
  });
});
