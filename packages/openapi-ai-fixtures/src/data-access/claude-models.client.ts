import { isRecord } from '@fixture-automation/shared';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRespond } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { modelNames } from '../utils/model-discovery.util.ts';

export const claudeModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  let models: string[] | undefined;
  const respond: AgentRespond = (line): string | null | undefined => {
    const message: unknown = JSON.parse(line);

    if (!isRecord(message)) throw new Error('Claude returned an invalid control message');

    if (message['type'] !== 'control_response') return undefined;

    const response = message['response'];

    if (!isRecord(response)) throw new Error('Claude returned an invalid control response');

    if (response['request_id'] !== 'models') return undefined;

    if (response['subtype'] !== 'success') {
      const error = response['error'];
      const reason = typeof error === 'string' ? error : 'Claude rejected model discovery';

      throw new Error(reason);
    }

    const result = response['response'];

    if (!isRecord(result)) throw new Error('Claude returned no initialization result');

    models = modelNames(result['models'], 'value');

    return null;
  };
  const request = { subtype: 'initialize', hooks: null };
  const message = { type: 'control_request', request_id: 'models', request };
  const command: AgentCommand = {
    executable: 'claude',
    args: [
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--safe-mode',
      '--tools',
      '',
      '--strict-mcp-config',
      '--no-session-persistence'
    ],
    input: `${JSON.stringify(message)}\n`,
    respond
  };

  await runAgent(command, { ...options, tool: 'claude' });

  if (models === undefined) throw new Error('Claude closed before returning its model catalog');

  return models;
};
