import { afterEach, describe, expect, it, vi } from 'vitest';

import { choose } from './choose.client.ts';
import { WIZARD_INPUTS } from '../common/wizard.const.ts';
import { answering, silence } from '../test/utils/answering.spec.util.ts';

const OPTIONS = ['json', 'ts', 'both'];

describe('FEATURE: numbered choice prompt', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN three options', (): void => {
    it('WHEN a listed number is answered THEN returns the matching option', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('2'));

      const option = await choose(question, WIZARD_INPUTS.format, OPTIONS);

      expect(option).toBe('ts');
    });

    it.each(['', '9', 'ts'])(
      'WHEN %s is answered first THEN re-asks and accepts the next answer',
      async (answer: string): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);
        const question = vi.fn(answering(answer, '1'));

        const option = await choose(question, WIZARD_INPUTS.format, OPTIONS);

        expect(option).toBe('json');
        expect(question).toHaveBeenCalledTimes(2);
      }
    );

    it('WHEN three answers are unusable THEN fails instead of guessing', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);

      await expect(choose(answering('x', 'y', 'z'), WIZARD_INPUTS.format, OPTIONS)).rejects.toMatchObject({
        message: 'no format chosen after 3 attempts',
        fix: 'answer a number from 1 to 3'
      });
    });
  });
});
