import type { AiFillEvent } from '@fixture-automation/fixture-studio-api/contract';

/** One JSON document per line, each line ended, as the API streams `ai-fill`. */
export const ndjsonOf = (events: AiFillEvent[]): string => {
  const lines = events.map((event: AiFillEvent): string => `${JSON.stringify(event)}\n`);

  return lines.join('');
};
