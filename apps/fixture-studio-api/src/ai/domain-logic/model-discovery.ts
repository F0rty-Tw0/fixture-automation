import type { AiModelsResult, AiTool } from '../../contract/common/studio-api.type.ts';
import { statusError } from '../../shared/http/utils/status-error.util.ts';
import type { FillRun } from '../common/ai.type.ts';

const MODELS_TIMEOUT_MS = 120_000;
const DISCOVERY_FIX = 'check that the CLI is installed and logged in, or type the model name';

/** Asks `tool`'s CLI for its model IDs while holding one CLI slot; a failed lookup becomes a 502. */
export const discoverCliModels = async (run: FillRun, tool: AiTool, signal: AbortSignal): Promise<AiModelsResult> => {
  const { ai, slots } = run;
  const discoveryOptions = { signal, timeoutMs: MODELS_TIMEOUT_MS };

  slots.claim();

  try {
    const discovery = await ai.discover(tool, discoveryOptions);
    const result: AiModelsResult = { models: discovery.models, source: discovery.source };

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'model discovery failed';

    throw statusError(502, message, DISCOVERY_FIX);
  } finally {
    slots.release();
  }
};
