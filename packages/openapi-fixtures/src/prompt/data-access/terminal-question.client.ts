import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';

import type { Question } from '../common/input.type.ts';

/** Asks on stderr so a piped stdout keeps only the tool's output. */
export const terminalQuestion: Question = async (prompt: string): Promise<string> => {
  const reader = createInterface({ input: process.stdin, output: process.stderr });
  const styledPrompt = styleText(['bold', 'cyan'], prompt, { stream: process.stderr });

  try {
    return await reader.question(styledPrompt);
  } finally {
    reader.close();
  }
};
