import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRequest } from '../common/agent.type.ts';
import { parseAgentEnvelope } from '../utils/agent-response.util.ts';
import { selectedModel } from '../utils/model-flag.util.ts';

const isEnvelope = (value: unknown): value is Record<string, unknown> => {
  const isArray = Array.isArray(value);

  return typeof value === 'object' && value !== null && !isArray;
};

const eventError = (event: Record<string, unknown>): string => {
  const error = event['error'];

  if (!isEnvelope(error)) return 'Codex reported a failed turn';

  const message = error['message'];

  if (typeof message !== 'string' || message.length === 0) return 'Codex reported a failed turn';

  return message;
};

const agentText = (item: unknown): string | undefined => {
  const isItemEnvelope = isEnvelope(item);

  if (!isItemEnvelope || item['type'] !== 'agent_message') return undefined;

  const text = item['text'];

  if (typeof text !== 'string') throw new Error('codex completed an agent message without fixture JSON');

  return text;
};

const codexResult = (output: string): string => {
  const lines = output.split('\n');
  let result: string | undefined;
  let didComplete = false;

  for (const line of lines) {
    const isBlank = line.trim().length === 0;

    if (isBlank) continue;

    const event = parseAgentEnvelope(line, 'codex');

    const type = event['type'];

    if (type === 'error' || type === 'turn.failed') {
      const message = eventError(event);

      throw new Error(`codex failed: ${message}`);
    }

    if (type === 'item.completed') {
      const text = agentText(event['item']);

      if (text !== undefined) result = text;
    }

    if (type === 'turn.completed') didComplete = true;
  }

  if (!didComplete) throw new Error('codex did not complete its response');

  if (result === undefined) throw new Error('codex completed without an agent response');

  return result;
};

const CODEX_ARGS = [
  'exec',
  '--ignore-user-config',
  '--ignore-rules',
  '--skip-git-repo-check',
  '--ephemeral',
  '-s',
  'read-only',
  '--json',
  '--config',
  'features.apps=false',
  '--config',
  'features.hooks=false',
  '--config',
  'features.multi_agent=false',
  '--config',
  'features.remote_plugin=false',
  '--config',
  'features.shell_tool=false',
  '--config',
  'tools.web_search=false',
  '--config',
  'web_search="disabled"'
];

/** `-` is the stdin placeholder and must stay last, so a model flag goes immediately before it. */
const codexArgs = (model: string | undefined): string[] => {
  if (model === undefined) return [...CODEX_ARGS, '-'];

  return [...CODEX_ARGS, '-m', model, '-'];
};

/** Enrich a fixture through an installed Codex CLI in restricted ephemeral mode. */
export const codexFixture = async (request: AgentRequest): Promise<string> => {
  const args = codexArgs(selectedModel(request.options));
  const command: AgentCommand = {
    executable: 'codex',
    args,
    input: request.prompt
  };
  const output = await runAgent(command, request.options);
  const result = codexResult(output);

  return result;
};
