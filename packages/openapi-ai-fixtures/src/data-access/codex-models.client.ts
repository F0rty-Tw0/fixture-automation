import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRespond } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { modelNames, modelRpcRequest, modelRpcResult } from '../utils/model-discovery.util.ts';

export const codexModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  const models = new Set<string>();
  const cursors = new Set<string>();
  let id = 0;
  let catalog: string[] | undefined;
  const respond: AgentRespond = (line): string | null | undefined => {
    const result = modelRpcResult(line, id);

    if (result === undefined) return undefined;

    if (id === 0) {
      id += 1;
      const request = modelRpcRequest(id, 'model/list', { includeHidden: false });

      return `{"method":"initialized","params":{}}\n${request}`;
    }

    const names = modelNames(result['data'], 'model');

    for (const name of names) models.add(name);

    const cursor = result['nextCursor'];

    if (cursor === null || cursor === undefined) {
      catalog = [...models];

      return null;
    }

    if (typeof cursor !== 'string' || cursor.length === 0) throw new Error('Codex returned an invalid model cursor');

    const repeated = cursors.has(cursor);

    if (repeated) throw new Error('Codex repeated a model cursor');

    cursors.add(cursor);
    id += 1;

    return modelRpcRequest(id, 'model/list', { includeHidden: false, cursor });
  };
  const clientInfo = { name: 'fixture_automation', version: '0.0.1' };
  const command: AgentCommand = {
    executable: 'codex',
    args: ['app-server'],
    input: modelRpcRequest(id, 'initialize', { clientInfo }),
    respond
  };

  await runAgent(command, { ...options, tool: 'codex' });

  if (catalog === undefined) throw new Error('Codex closed before returning its model catalog');

  return catalog;
};
