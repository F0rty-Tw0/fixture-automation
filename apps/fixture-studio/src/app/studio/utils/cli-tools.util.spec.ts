import type { AiToolStatus } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { installedChoice, installedTools, uncheckedTool } from './cli-tools.util.ts';

const MISSING_CLAUDE: AiToolStatus = { tool: 'claude', installed: false };
const INSTALLED_GEMINI: AiToolStatus = { tool: 'gemini', installed: true };
const INSTALLED_CODEX: AiToolStatus = { tool: 'codex', installed: true };

describe('FEATURE: CLI tool lists', (): void => {
  describe('GIVEN an install check', (): void => {
    it('WHEN the installed tools are listed THEN keeps only installed ones, in check order', (): void => {
      const tools = installedTools([MISSING_CLAUDE, INSTALLED_GEMINI, INSTALLED_CODEX]);

      expect(tools).toStrictEqual(['gemini', 'codex']);
    });

    it('WHEN nothing is installed THEN lists no tool', (): void => {
      const tools = installedTools([MISSING_CLAUDE]);

      expect(tools).toStrictEqual([]);
    });
  });

  describe('GIVEN a chosen tool', (): void => {
    it('WHEN it is installed THEN keeps it', (): void => {
      const tool = installedChoice([MISSING_CLAUDE, INSTALLED_GEMINI, INSTALLED_CODEX], 'codex');

      expect(tool).toBe('codex');
    });

    it('WHEN it is missing THEN picks the first installed tool', (): void => {
      const tool = installedChoice([MISSING_CLAUDE, INSTALLED_GEMINI, INSTALLED_CODEX], 'claude');

      expect(tool).toBe('gemini');
    });

    it('WHEN nothing is installed THEN keeps it', (): void => {
      const tool = installedChoice([MISSING_CLAUDE], 'claude');

      expect(tool).toBe('claude');
    });
  });

  it('GIVEN no install check WHEN a tool is offered THEN it is not marked missing', (): void => {
    const status = uncheckedTool('copilot');

    expect(status).toStrictEqual({ tool: 'copilot', installed: true });
  });
});
