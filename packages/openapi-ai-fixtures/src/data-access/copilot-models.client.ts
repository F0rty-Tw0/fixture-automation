import { isRecord } from '@fixture-automation/shared';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRespond } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { modelNames, modelRpcRequest, modelRpcResult } from '../utils/model-discovery.util.ts';

const INITIALIZE_ID = 1;
const SESSION_ID = 2;

const modelConfigOption = (result: Record<string, unknown>): Record<string, unknown> | undefined => {
  const configOptions = result['configOptions'];
  const isList = Array.isArray(configOptions);

  if (!isList) return undefined;

  const entries: unknown[] = configOptions;

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    if (entry['category'] === 'model') return entry;
  }

  return undefined;
};

const configOptionEntries = (option: Record<string, unknown>): unknown[] => {
  const groups = option['groups'];
  const isGrouped = Array.isArray(groups);

  if (!isGrouped) {
    const options = option['options'];
    const isList = Array.isArray(options);

    if (!isList) throw new Error('Copilot returned an invalid model list');

    return options;
  }

  const entries: unknown[] = [];

  for (const group of groups) {
    if (!isRecord(group)) throw new Error('Copilot returned an invalid model entry');

    const options = group['options'];
    const isList = Array.isArray(options);

    if (!isList) throw new Error('Copilot returned an invalid model list');

    const groupEntries: unknown[] = options;

    entries.push(...groupEntries);
  }

  return entries;
};

const copilotModelNames = (result: Record<string, unknown>): string[] => {
  const option = modelConfigOption(result);

  if (option !== undefined) return modelNames(configOptionEntries(option), 'value');

  const catalog = result['models'];

  if (isRecord(catalog)) return modelNames(catalog['availableModels'], 'modelId');

  throw new Error('Copilot returned no model catalog');
};

const copilotCommand = (respond: AgentRespond): AgentCommand => {
  const clientCapabilities = {};
  const initializeParams = { clientCapabilities, protocolVersion: 1 };
  const input = modelRpcRequest(INITIALIZE_ID, 'initialize', initializeParams);
  const command: AgentCommand = {
    executable: 'copilot',
    args: ['--acp', '--no-auto-update'],
    input,
    respond
  };

  return command;
};

export const copilotModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  let models: string[] | undefined;
  let initialized = false;
  const respond: AgentRespond = (message, scratchDirectory): string | null | undefined => {
    const requestId = initialized ? SESSION_ID : INITIALIZE_ID;
    const result = modelRpcResult(message, requestId);

    if (result === undefined) return undefined;

    if (!initialized) {
      if (result['protocolVersion'] !== 1) throw new Error('Copilot returned an unsupported ACP protocol version');

      initialized = true;
      const params = { cwd: scratchDirectory, mcpServers: [] };

      return modelRpcRequest(SESSION_ID, 'session/new', params);
    }

    models = copilotModelNames(result);

    return null;
  };
  const command = copilotCommand(respond);

  await runAgent(command, { ...options, tool: 'copilot' });

  if (models === undefined) throw new Error('Copilot closed before returning its model catalog');

  return models;
};
