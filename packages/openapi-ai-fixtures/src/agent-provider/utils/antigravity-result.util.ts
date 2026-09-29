import { parseAgentEnvelope } from './agent-response.util.ts';

const antigravityEvents = (text: string): Record<string, unknown>[] => {
  const isEmptyStream = text.trim().length === 0;

  if (isEmptyStream) throw new Error('antigravity returned an empty event stream');

  const lines = text.split(/\r?\n/);
  const lastLine = lines.at(-1);
  const isFinalNewline = lastLine === '';

  if (isFinalNewline) {
    lines.pop();
  }

  const events = lines.map((line): Record<string, unknown> => parseAgentEnvelope(line, 'antigravity'));

  return events;
};

const terminalResult = (events: Record<string, unknown>[]): unknown => {
  const terminalEvent = events.at(-1);

  if (terminalEvent?.['event'] !== 'result') throw new Error('antigravity stream did not end with a result event');

  const precedingEvents = events.slice(0, -1);
  const hasPriorResult = precedingEvents.some((event): boolean => event['event'] === 'result');

  if (hasPriorResult) {
    const message = 'antigravity stream returned more than one result event';

    throw new Error(message);
  }

  return terminalEvent['result'];
};

/** Extract the fixture from one complete Antigravity stream-json turn. */
export const parseAntigravityResult = (text: string): string => {
  const events = antigravityEvents(text);
  const result = terminalResult(events);
  const isObject = typeof result === 'object' && result !== null;
  const isArray = Array.isArray(result);

  if (!isObject || isArray) throw new Error('antigravity returned an invalid result event');

  const status = 'status' in result ? result.status : undefined;

  if (status !== 'SUCCESS') {
    const statusName = typeof status === 'string' ? status : 'missing';

    throw new Error(`antigravity failed with status ${statusName}`);
  }

  const hasStructuredOutput = 'structured_output' in result;

  if (hasStructuredOutput) return JSON.stringify(result.structured_output);
  const response = 'response' in result ? result.response : undefined;

  if (typeof response !== 'string') {
    const message = 'antigravity returned a successful result without fixture JSON';

    throw new Error(message);
  }

  return response;
};
