import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { AiTool } from '../common/ai-fixtures.type.ts';

export const TOOL_FIX = '--tool codex, or claude, antigravity, copilot, gemini';

export const parseAiTool = (value: string | undefined): AiTool => {
  switch (value) {
    case 'claude':
    case 'codex':
    case 'antigravity':
    case 'copilot':
    case 'gemini':
      return value;
    case undefined:
      throw new FixtureError('--tool is required', TOOL_FIX);
    default:
      throw new FixtureError(`--tool must be claude, codex, antigravity, copilot, or gemini, got "${value}"`, TOOL_FIX);
  }
};
