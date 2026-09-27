import { mkdir, writeFile } from 'node:fs/promises';
import { delimiter } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectAiTools } from './ai-tool-install.client.ts';
import type { AiTool, AiToolInstall } from '../common/ai-fixtures.type.ts';
import type { ProcessWorkspace } from '../test/common/process.type.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const installedTools = (installs: AiToolInstall[]): AiTool[] => {
  const found = installs.filter((install) => install.installed);

  return found.map((install) => install.tool);
};

describe('FEATURE: AI tool install detection', (): void => {
  let workspace: ProcessWorkspace;

  beforeEach(async (): Promise<void> => {
    workspace = await processWorkspace();
  });

  afterEach(async (): Promise<void> => {
    await workspace.dispose();
  });

  describe('GIVEN a POSIX PATH', (): void => {
    it('WHEN a tool file sits in a PATH directory THEN reports it installed, every tool in order', async (): Promise<void> => {
      await writeFile(workspace.file('claude'), '');
      await writeFile(workspace.file('agy'), '');
      const env = { PATH: `/missing-dir${delimiter}${workspace.directory}` };

      const installs = await detectAiTools(env, 'linux');

      const expected: AiToolInstall[] = [
        { tool: 'claude', installed: true },
        { tool: 'codex', installed: false },
        { tool: 'antigravity', installed: true },
        { tool: 'copilot', installed: false },
        { tool: 'gemini', installed: false }
      ];

      expect(installs).toStrictEqual(expected);
    });

    it('WHEN a directory carries the tool name THEN it is not an install', async (): Promise<void> => {
      await mkdir(workspace.file('codex'));
      const env = { PATH: workspace.directory };

      const installs = await detectAiTools(env, 'linux');

      expect(installedTools(installs)).toStrictEqual([]);
    });

    it('WHEN PATH is unset THEN reports nothing installed', async (): Promise<void> => {
      const installs = await detectAiTools({}, 'linux');

      expect(installedTools(installs)).toStrictEqual([]);
    });
  });

  describe('GIVEN a Windows PATH', (): void => {
    it('WHEN a tool has a PATHEXT extension THEN reports it installed, reading Path and PATHEXT in any case', async (): Promise<void> => {
      await writeFile(workspace.file('gemini.CMD'), '');
      await writeFile(workspace.file('codex.PS1'), '');
      const env = { Path: `${workspace.directory}${delimiter}`, pathext: '.EXE;.CMD' };

      const installs = await detectAiTools(env, 'win32');

      expect(installedTools(installs)).toStrictEqual(['gemini']);
    });

    it('WHEN only the extensionless shim exists THEN it is not an install', async (): Promise<void> => {
      await writeFile(workspace.file('copilot'), '');
      const env = { PATH: workspace.directory, PATHEXT: '.EXE;.CMD' };

      const installs = await detectAiTools(env, 'win32');

      expect(installedTools(installs)).toStrictEqual([]);
    });

    it('WHEN PATHEXT is unset THEN tries the Windows default extensions', async (): Promise<void> => {
      await writeFile(workspace.file('copilot.EXE'), '');
      const env = { PATH: workspace.directory };

      const installs = await detectAiTools(env, 'win32');

      expect(installedTools(installs)).toStrictEqual(['copilot']);
    });
  });
});
