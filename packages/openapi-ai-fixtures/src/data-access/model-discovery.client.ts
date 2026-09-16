import { antigravityModels } from './antigravity-models.client.ts';
import { claudeModels } from './claude-models.client.ts';
import { codexModels } from './codex-models.client.ts';
import { copilotModels } from './copilot-models.client.ts';
import { geminiModels } from './gemini-models.client.ts';
import type { AiTool } from '../common/ai-fixtures.type.ts';
import type { ModelDiscovery, ModelDiscoveryOptions } from '../common/model.type.ts';

const DISCOVERY_TIMEOUT_MS = 120_000;

const providerModels: Record<AiTool, (options: ModelDiscoveryOptions) => Promise<string[]>> = {
  antigravity: antigravityModels,
  claude: claudeModels,
  codex: codexModels,
  copilot: copilotModels,
  gemini: geminiModels
};

/** Query the installed provider's selectable models without sending a generation prompt. Never substitutes a static catalog. */
export const discoverModels = async (tool: AiTool, options: ModelDiscoveryOptions = {}): Promise<ModelDiscovery> => {
  try {
    const timeoutMs = options.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
    const discoveryOptions: ModelDiscoveryOptions = { ...options, timeoutMs };
    const models = await providerModels[tool](discoveryOptions);

    if (models.length === 0) throw new Error('Provider returned no selectable models');

    const discovery: ModelDiscovery = { models, source: `${tool}-cli` };

    return discovery;
  } catch (cause: unknown) {
    const detail = cause instanceof Error ? cause.message : 'Unknown provider error';
    const message = `${tool} model discovery failed: ${detail}. Check the installed CLI version and login, or pass --model explicitly.`;

    throw new Error(message, { cause });
  }
};
