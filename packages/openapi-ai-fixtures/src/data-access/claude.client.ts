import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRequest } from '../common/agent.type.ts';
import { parseAgentEnvelope } from '../utils/agent-response.util.ts';
import { selectedModel } from '../utils/model-flag.util.ts';

const claudeResult = (envelope: Record<string, unknown>): string => {
  const type = envelope['type'];
  const subtype = envelope['subtype'];
  const isError = envelope['is_error'];
  const result = envelope['result'];
  const isSuccessful = type === 'result' && subtype === 'success' && isError === false;

  if (!isSuccessful) {
    const hasErrorMessage = typeof result === 'string' && result.length > 0;
    const message = hasErrorMessage ? result : 'Claude reported an unsuccessful result';

    throw new Error(`claude failed: ${message}`);
  }

  if (typeof result !== 'string') throw new Error('claude returned a successful result without fixture JSON');

  return result;
};

/** Enrich a fixture through an installed Claude Code CLI without agent tools. */
export const claudeFixture = async (request: AgentRequest): Promise<string> => {
  const args = [
    '-p',
    '--input-format',
    'text',
    '--output-format',
    'json',
    '--safe-mode',
    '--tools',
    '',
    '--disallowedTools',
    'mcp__*',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--permission-prompts',
    'none'
  ];
  const model = selectedModel(request.options);

  if (model !== undefined) args.push('--model', model);

  const command: AgentCommand = {
    executable: 'claude',
    args,
    input: request.prompt
  };
  const output = await runAgent(command, request.options);
  const envelope = parseAgentEnvelope(output, 'claude');
  const result = claudeResult(envelope);

  return result;
};
