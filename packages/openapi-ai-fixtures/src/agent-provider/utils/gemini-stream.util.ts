import { parseAgentEnvelope } from './agent-response.util.ts';

const EVENT_TYPES: Record<string, true> = {
  init: true,
  message: true,
  tool_use: true,
  tool_result: true,
  error: true,
  result: true
};

const requireString = (event: Record<string, unknown>, property: string): string => {
  const value = event[property];

  if (typeof value !== 'string') throw new Error(`Gemini CLI emitted a stream event without a string ${property}.`);

  return value;
};

const assistantContent = (event: Record<string, unknown>): string | undefined => {
  const role = requireString(event, 'role');

  if (role === 'user') return undefined;

  if (role !== 'assistant') throw new Error('Gemini CLI emitted a malformed message event with an unsupported role.');

  const content = requireString(event, 'content');

  const isDelta = event['delta'] === true;

  if (!isDelta) throw new Error('Gemini CLI emitted a malformed assistant message event without delta.');

  return content;
};

const resultStatus = (event: Record<string, unknown>): 'error' | 'success' => {
  const status = requireString(event, 'status');

  if (status === 'error' || status === 'success') return status;

  throw new Error('Gemini CLI emitted a malformed result event with an unsupported status.');
};

const assertStreamEvent = (event: Record<string, unknown>, initialized: boolean, completed: boolean): void => {
  if (completed) throw new Error('Gemini CLI emitted an event after its terminal result.');

  const type = requireString(event, 'type');

  if (!initialized && type !== 'init') throw new Error('Gemini CLI stream did not begin with an init event.');

  if (initialized && type === 'init') throw new Error('Gemini CLI emitted more than one init event.');

  const isSupported = EVENT_TYPES[type] === true;

  if (!isSupported) throw new Error(`Gemini CLI emitted an unsupported ${type} stream event.`);
};

/** Extracts assistant text only after Gemini's stream-json protocol completes successfully. */
export const parseGeminiStream = (output: string): string => {
  const lines = output.split(/\r?\n/);
  const content: string[] = [];
  let didInitialize = false;
  let didComplete = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const isBlank = trimmedLine.length === 0;

    if (isBlank) continue;

    const event = parseAgentEnvelope(line, 'gemini');
    const type = event['type'];

    assertStreamEvent(event, didInitialize, didComplete);

    if (type === 'init') didInitialize = true;

    if (type === 'message') {
      const messageContent = assistantContent(event);

      if (messageContent !== undefined) content.push(messageContent);
    }

    if (type === 'result') {
      const status = resultStatus(event);

      if (status === 'error') throw new Error('Gemini CLI reported a failed stream result.');

      didComplete = true;
    }
  }

  if (!didComplete) throw new Error('Gemini CLI stream ended without a terminal result.');

  const response = content.join('');

  if (response.length === 0) throw new Error('Gemini CLI completed without assistant response text.');

  return response;
};
