import type { AiToolsResult } from '../../contract/common/studio-api.type.ts';
import type { StudioAi } from '../common/ai.type.ts';

/** Which CLIs are installed, and whether `STUDIO_AI_MOCK=1` answers instead; starts no CLI. */
export const detectCliTools = async (ai: StudioAi): Promise<AiToolsResult> => {
  const tools = await ai.detect();
  const result: AiToolsResult = { tools, mock: ai.isMock };

  return result;
};
