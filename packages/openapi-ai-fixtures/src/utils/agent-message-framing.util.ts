import type { AgentMessage } from '../common/agent.type.ts';

export const contentLengthMessage = (pending: Buffer): AgentMessage | undefined => {
  const headerEnd = pending.indexOf('\r\n\r\n');

  if (headerEnd === -1) return undefined;

  const header = pending.toString('ascii', 0, headerEnd);
  const match = /^Content-Length:\s*(\d+)\s*$/im.exec(header);
  const length = Number(match?.[1]);
  const validLength = Number.isSafeInteger(length);

  if (!validLength || length < 0 || length > 8 * 1024 * 1024) throw new Error('Invalid provider Content-Length header');

  const bodyStart = headerEnd + 4;
  const end = bodyStart + length;

  if (pending.length < end) return undefined;

  const message = pending.toString('utf8', bodyStart, end);
  const rest = pending.subarray(end);
  const frame: AgentMessage = { message, rest };

  return frame;
};
