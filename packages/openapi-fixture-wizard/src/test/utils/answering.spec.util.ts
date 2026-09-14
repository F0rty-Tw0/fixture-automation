import type { Question } from '@fixture-automation/openapi-fixtures';

/** A fake terminal that returns the given answers in order, then blank lines. */
export const answering = (...answers: string[]): Question => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

export const silence = (): void => undefined;
