import type { AiToolsResult } from '../../contract/common/studio-api.type.ts';
import type { StudioAi } from '../common/ai.type.ts';
import { detectCliTools } from '../domain-logic/tool-detection.ts';

type AiToolsHandler = () => Promise<AiToolsResult>;

export const aiToolsHandler = (ai: StudioAi): AiToolsHandler => {
  const handler = async (): Promise<AiToolsResult> => detectCliTools(ai);

  return handler;
};
