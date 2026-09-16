import { isRecord } from '@fixture-automation/shared';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { parseAgentEnvelope } from '../utils/agent-response.util.ts';
import { modelNames } from '../utils/model-discovery.util.ts';

export const antigravityModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  const command: AgentCommand = { executable: 'agy', args: ['--output-format', 'json', 'models'], input: '' };
  const output = await runAgent(command, { ...options, tool: 'antigravity' });
  const envelope = parseAgentEnvelope(output, 'antigravity');

  if (envelope['status'] !== 'SUCCESS') throw new Error('Antigravity rejected model discovery');

  const result = envelope['command'];

  if (!isRecord(result) || result['name'] !== 'models') throw new Error('Antigravity returned no models command result');

  const data = result['data'];

  if (!isRecord(data)) throw new Error('Antigravity returned no model catalog');

  return modelNames(data['models'], 'id');
};
