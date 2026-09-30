import { patternPrompt } from './fixture-prompt.util.ts';
import type { AgentFile } from '../../agent-process/common/agent-process.type.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import { readsFiles } from '../../agent-provider/utils/file-mode.util.ts';
import type { PatternPromptInput } from '../../missing-patterns/common/missing-pattern.type.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

const BASELINE_FILE = 'baseline.json';

/**
 * The pattern prompt request; in file mode the whole baseline is staged as `baseline.json` and the prompt names it.
 * The file is indented because agent search tools skip overlong lines and read tools page by line.
 */
export const patternRequest = (input: PatternPromptInput, options: AiFixtureOptions): AgentRequest => {
  const isFileMode = readsFiles(options);

  if (!isFileMode) {
    const prompt = patternPrompt(input);
    const request: AgentRequest = { prompt, options };

    return request;
  }

  const staged: PatternPromptInput = { ...input, baselineFile: BASELINE_FILE };
  const prompt = patternPrompt(staged);
  const content = JSON.stringify(input.fixture, null, 2);
  const baseline: AgentFile = { path: BASELINE_FILE, content };
  const files = [baseline];
  const request: AgentRequest = { prompt, options, files };

  return request;
};
