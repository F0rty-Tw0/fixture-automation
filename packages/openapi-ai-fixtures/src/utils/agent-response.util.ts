import { AgentJsonError } from './agent-json.error.ts';
import type { AiTool } from '../common/ai-fixtures.type.ts';

const isEnvelope = (value: unknown): value is Record<string, unknown> => {
  const isArray = Array.isArray(value);

  return typeof value === 'object' && value !== null && !isArray;
};

const jsonValue = (_key: string, value: unknown): unknown => {
  if (typeof value !== 'number') return value;

  const isFinite = Number.isFinite(value);

  if (!isFinite) throw new Error('JSON number exceeds the finite JavaScript range');

  return value;
};

export const parseAgentJson = (text: string, tool: AiTool): unknown => {
  try {
    const value: unknown = JSON.parse(text, jsonValue);

    return value;
  } catch (cause: unknown) {
    throw new AgentJsonError(`${tool} returned invalid JSON`, text, { cause });
  }
};

export const parseAgentEnvelope = (text: string, tool: AiTool): Record<string, unknown> => {
  let value: unknown;

  try {
    value = JSON.parse(text, jsonValue);
  } catch (cause: unknown) {
    throw new Error(`${tool} returned invalid JSON`, { cause });
  }

  if (!isEnvelope(value)) throw new Error(`${tool} returned an invalid response envelope`);

  return value;
};
