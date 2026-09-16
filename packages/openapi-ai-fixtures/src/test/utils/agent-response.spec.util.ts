import type { AiTool } from '../../common/ai-fixtures.type.ts';

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
      return JSON.stringify({ response: text });
  }
};
