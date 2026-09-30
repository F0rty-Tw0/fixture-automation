import { describe, expect, it } from 'vitest';

import { readsFiles, withReadFilesEnv } from './file-mode.util.ts';
import type { AiFixtureOptions, AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

describe('FEATURE: agent file mode', (): void => {
  describe('GIVEN no readsFiles override', (): void => {
    it('WHEN the tool is claude THEN the agent reads files', (): void => {
      const options: AiFixtureOptions = { tool: 'claude' };

      const isFileMode = readsFiles(options);

      expect(isFileMode).toBe(true);
    });

    it.each<AiTool>(['codex', 'gemini', 'copilot', 'antigravity'])(
      'WHEN the tool is %s THEN the agent gets the digest only',
      (tool: AiTool): void => {
        const options: AiFixtureOptions = { tool };

        const isFileMode = readsFiles(options);

        expect(isFileMode).toBe(false);
      }
    );
  });

  describe('GIVEN readsFiles is forced on', (): void => {
    it.each<AiTool>(['claude', 'gemini', 'copilot', 'antigravity'])(
      'WHEN the tool is %s THEN the agent reads files',
      (tool: AiTool): void => {
        const options: AiFixtureOptions = { tool, readsFiles: true };

        const isFileMode = readsFiles(options);

        expect(isFileMode).toBe(true);
      }
    );

    it('WHEN the tool is codex THEN the agent still gets the digest only', (): void => {
      const options: AiFixtureOptions = { tool: 'codex', readsFiles: true };

      const isFileMode = readsFiles(options);

      expect(isFileMode).toBe(false);
    });
  });

  describe('GIVEN readsFiles is forced off', (): void => {
    it('WHEN the tool is claude THEN the agent gets the digest only', (): void => {
      const options: AiFixtureOptions = { tool: 'claude', readsFiles: false };

      const isFileMode = readsFiles(options);

      expect(isFileMode).toBe(false);
    });
  });

  describe('GIVEN OPENAPI_AI_READ_FILES', (): void => {
    it.each<string>(['0', 'false', 'off', 'no', 'FALSE', ' Off ', 'No'])(
      'WHEN it is "%s" and the caller did not choose THEN file mode is off',
      (value: string): void => {
        const options: AiFixtureOptions = { tool: 'claude' };

        const resolved = withReadFilesEnv(options, value);

        expect(resolved).toStrictEqual({ tool: 'claude', readsFiles: false });
      }
    );

    it('WHEN it is 0 and the caller forced file mode on THEN the caller wins', (): void => {
      const options: AiFixtureOptions = { tool: 'claude', readsFiles: true };

      const resolved = withReadFilesEnv(options, '0');

      expect(resolved).toBe(options);
    });

    it.each<string | undefined>([undefined, '1', 'true', 'on', 'yes', '', 'disabled'])(
      'WHEN it is %s THEN the options are unchanged',
      (value: string | undefined): void => {
        const options: AiFixtureOptions = { tool: 'claude' };

        const resolved = withReadFilesEnv(options, value);

        expect(resolved).toBe(options);
      }
    );
  });
});
