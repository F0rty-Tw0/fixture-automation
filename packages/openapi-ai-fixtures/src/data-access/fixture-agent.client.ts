import { antigravityFixture } from './antigravity.client.ts';
import { claudeFixture } from './claude.client.ts';
import { codexFixture } from './codex.client.ts';
import { copilotFixture } from './copilot.client.ts';
import { geminiFixture } from './gemini.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';

export const generateFixture = async (request: AgentRequest): Promise<unknown> => {
  switch (request.options.tool) {
    case 'claude':
      return claudeFixture(request);
    case 'codex':
      return codexFixture(request);
    case 'antigravity':
      return antigravityFixture(request);
    case 'copilot':
      return copilotFixture(request);
    case 'gemini':
      return geminiFixture(request);
  }
};
