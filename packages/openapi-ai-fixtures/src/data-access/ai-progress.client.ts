import { stripVTControlCharacters } from 'node:util';

import type { AiFixtureProgress } from '../common/ai-fixtures.type.ts';

const preserveLayout = (character: string): string => (character === '\n' || character === '\t' ? character : '');

/** Render provider progress to stderr without contaminating fixture JSON on stdout. */
export const createAiProgressReporter = (): ((progress: AiFixtureProgress) => void) => {
  let lineOpen = false;
  let previousStream: AiFixtureProgress['stream'] | undefined;
  const report = (progress: AiFixtureProgress): void => {
    const plain = stripVTControlCharacters(progress.text);
    const text = plain.replace(/\p{Cc}/gu, preserveLayout);

    if (text.length === 0) return;

    const separate = lineOpen && progress.stream !== previousStream;

    if (separate) process.stderr.write('\n');

    process.stderr.write(text);
    lineOpen = !text.endsWith('\n');
    previousStream = progress.stream;
  };

  return report;
};
