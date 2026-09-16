import { isRecord } from '@fixture-automation/shared';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRespond } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { modelRpcResult } from '../utils/model-discovery.util.ts';

type DiscoveryPhase = 'connect' | 'models' | 'shutdown';

const framedRequest = (id: number, method: string, params: Record<string, unknown>): string => {
  const request = { jsonrpc: '2.0', id, method, params };
  const body = JSON.stringify(request);
  const contentLength = Buffer.byteLength(body, 'utf8');

  return `Content-Length: ${contentLength}\r\n\r\n${body}`;
};

const isKnownPolicyState = (state: unknown): boolean => state === 'enabled' || state === 'disabled' || state === 'unconfigured';

const copilotModelNames = (result: Record<string, unknown>): string[] => {
  const entries = result['models'];
  const isList = Array.isArray(entries);

  if (!isList) throw new Error('Copilot returned an invalid model list');

  const models = new Set<string>();

  for (const entry of entries) {
    if (!isRecord(entry)) throw new Error('Copilot returned an invalid model entry');

    const id = entry['id'];

    if (typeof id !== 'string') throw new Error('Copilot returned a model without an identifier');

    const trimmed = id.trim();

    if (trimmed.length === 0) throw new Error('Copilot returned a model without an identifier');

    const policy = entry['policy'];

    if (policy !== undefined) {
      if (!isRecord(policy)) throw new Error('Copilot returned an invalid model policy');

      const state = policy['state'];

      const isKnownState = isKnownPolicyState(state);

      if (!isKnownState) throw new Error('Copilot returned an invalid model policy');

      if (state === 'disabled') continue;
    }

    models.add(id);
  }

  return [...models];
};

const requireSupportedProtocol = (result: Record<string, unknown>): void => {
  const protocolVersion = result['protocolVersion'];

  if (protocolVersion !== 3) throw new Error('Copilot returned an unsupported SDK protocol version');
};

const requireConnection = (result: Record<string, unknown>): void => {
  if (result['ok'] !== true) throw new Error('Copilot rejected the discovery connection');

  requireSupportedProtocol(result);
};

export const copilotModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  const connectionToken = process.env['COPILOT_CONNECTION_TOKEN'];
  const connectParams: Record<string, unknown> = {};

  if (connectionToken !== undefined) connectParams['token'] = connectionToken;
  let id = 1;
  let models: string[] | undefined;
  let phase: DiscoveryPhase = 'connect';
  let completedModels: string[] | undefined;
  const respond: AgentRespond = (message): string | null | undefined => {
    const result = modelRpcResult(message, id);

    if (result === undefined) return undefined;

    if (phase === 'connect') {
      requireConnection(result);
      id += 1;
      phase = 'models';

      return framedRequest(id, 'models.list', {});
    }

    if (phase === 'models') {
      models = copilotModelNames(result);
      id += 1;
      phase = 'shutdown';

      return framedRequest(id, 'runtime.shutdown', {});
    }

    completedModels = models;

    return null;
  };
  const command: AgentCommand = {
    executable: 'copilot',
    args: ['--headless', '--stdio', '--no-auto-update', '--log-level', 'none'],
    input: framedRequest(id, 'connect', connectParams),
    messageFormat: 'content-length',
    respond,
    stopOnComplete: true
  };

  await runAgent(command, { ...options, tool: 'copilot' });

  if (completedModels === undefined) throw new Error('Copilot closed before returning its model catalog');

  return completedModels;
};
