import { finiteJson, recoveredJson } from './json-recovery.util.ts';
import type { AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { AgentJsonError } from '../common/agent-json.error.ts';
import type { AgentJson } from '../common/agent-provider.type.ts';

const JSON_CODE_FENCE = /^[\t \r\n]*```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```[\t \r\n]*$/iu;

const jsonResponseText = (text: string): string => {
  const match = JSON_CODE_FENCE.exec(text);

  return match?.[1] ?? text;
};

const isEnvelope = (value: unknown): value is Record<string, unknown> => {
  const isArray = Array.isArray(value);

  return typeof value === 'object' && value !== null && !isArray;
};

const recovered = (text: string, tool: AiTool, cause: unknown): AgentJson => {
  const [value, ...alternatives] = recoveredJson(text);

  if (value === undefined) throw new AgentJsonError(`${tool} returned invalid JSON`, text, { cause });

  const parsed: AgentJson = { value, isRecovered: true, alternatives };

  return parsed;
};

/**
 * The model's JSON value: plain JSON or one whole-response fence first, then the best JSON recovered from prose,
 * several fences or an unclosed fence (see `recoveredJson`), with the other recovered values as `alternatives`.
 * Only text holding no non-empty parseable JSON at all is an `AgentJsonError`.
 */
export const readAgentJson = (text: string, tool: AiTool): AgentJson => {
  const source = jsonResponseText(text);

  try {
    const value = finiteJson(source);
    const parsed: AgentJson = { value, isRecovered: false, alternatives: [] };

    return parsed;
  } catch (cause: unknown) {
    return recovered(text, tool, cause);
  }
};

export const parseAgentEnvelope = (text: string, tool: AiTool): Record<string, unknown> => {
  let value: unknown;

  try {
    value = finiteJson(text);
  } catch (cause: unknown) {
    throw new Error(`${tool} returned invalid JSON`, { cause });
  }

  if (!isEnvelope(value)) throw new Error(`${tool} returned an invalid response envelope`);

  return value;
};
