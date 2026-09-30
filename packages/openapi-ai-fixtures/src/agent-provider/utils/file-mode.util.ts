import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { FILE_MODE_TOOLS } from '../common/agent-provider.const.ts';

/** Whether this run stages the baseline for the agent to read: the caller's choice, else the tool's default; never Codex. */
export const readsFiles = (options: AiFixtureOptions): boolean => {
  if (options.tool === 'codex') return false;

  return options.readsFiles ?? FILE_MODE_TOOLS[options.tool];
};

/** `options` with file mode off when `OPENAPI_AI_READ_FILES` is `0` and the caller left `readsFiles` unset; any other value changes nothing. */
export const withReadFilesEnv = (options: AiFixtureOptions, readFilesEnv: string | undefined): AiFixtureOptions => {
  const isSwitchedOff = options.readsFiles === undefined && readFilesEnv === '0';

  if (!isSwitchedOff) return options;

  const digestOnly: AiFixtureOptions = { ...options, readsFiles: false };

  return digestOnly;
};
