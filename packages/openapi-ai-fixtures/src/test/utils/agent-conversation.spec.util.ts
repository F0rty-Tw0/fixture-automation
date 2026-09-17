import type { AgentCommand } from '../../common/agent.type.ts';

/**
 * A `runAgent` stand-in that feeds `lines` to the command's `respond` until it completes with `null`,
 * as the input pipe would; a throwing responder rejects the run. Replies written back land in `replies`.
 */
export const scriptedConversation = (lines: string[], replies: string[]): ((command: AgentCommand) => Promise<string>) => {
  const conversation = async (command: AgentCommand): Promise<string> => {
    for (const line of lines) {
      const reply = command.respond?.(line, '');

      if (reply === null) break;

      if (reply !== undefined) replies.push(reply);
    }

    return Promise.resolve('');
  };

  return conversation;
};
