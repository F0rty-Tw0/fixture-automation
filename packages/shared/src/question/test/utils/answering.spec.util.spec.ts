import { describe, expect, it, vi } from 'vitest';

import { answering, silence } from './answering.spec.util.ts';

describe('FEATURE: fake terminal answers', (): void => {
  describe('GIVEN two queued answers', (): void => {
    describe('WHEN asked three times', (): void => {
      it('THEN returns the answers in order', async (): Promise<void> => {
        const ask = answering('first', 'second');

        const answers = [await ask('a?'), await ask('b?')];

        expect(answers).toStrictEqual(['first', 'second']);
      });

      it('THEN returns a blank line once the queue is empty', async (): Promise<void> => {
        const ask = answering('first', 'second');

        await ask('a?');
        await ask('b?');

        const answer = await ask('c?');

        expect(answer).toBe('');
      });
    });
  });

  describe('GIVEN a silenced sink', (): void => {
    it('WHEN called THEN returns undefined', (): void => {
      const sink = vi.fn(silence);

      sink();

      expect(sink).toHaveReturnedWith(undefined);
    });
  });
});
