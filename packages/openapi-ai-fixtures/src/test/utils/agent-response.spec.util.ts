import type { AiTool } from '../../common/ai-fixtures.type.ts';

const geminiStreamResponse = (text: string): string => {
  const init = {
    model: 'gemini-test',
    session_id: 'session-1',
    timestamp: '2026-09-16T00:00:00.000Z',
    type: 'init'
  };
  const message = {
    content: text,
    delta: true,
    role: 'assistant',
    timestamp: '2026-09-16T00:00:01.000Z',
    type: 'message'
  };
  const result = {
    stats: {},
    status: 'success',
    timestamp: '2026-09-16T00:00:02.000Z',
    type: 'result'
  };
  const events = [init, message, result];
  const lines = events.map((event): string => JSON.stringify(event));

  return `${lines.join('\n')}\n`;
};

export const agentResponse = (tool: AiTool, text: string): string => {
  switch (tool) {
    case 'claude':
      return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text });
    case 'codex': {
      const item = { type: 'agent_message', text };
      const completed = JSON.stringify({ type: 'item.completed', item });
      const turn = JSON.stringify({ type: 'turn.completed' });

      return `${completed}\n${turn}\n`;
    }
    case 'antigravity': {
      const result = { status: 'SUCCESS', response: text };

      return `${JSON.stringify({ event: 'result', result })}\n`;
    }
    case 'copilot':
      return text;
    case 'gemini':
      return geminiStreamResponse(text);
  }
};
