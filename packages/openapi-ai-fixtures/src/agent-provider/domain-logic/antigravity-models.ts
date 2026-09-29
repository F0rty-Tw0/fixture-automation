import { isRecord } from '@fixture-automation/shared';

import type { AgentCommand } from '../../agent-process/common/agent-process.type.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { ModelDiscoveryOptions } from '../../model-discovery/common/model.type.ts';
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
