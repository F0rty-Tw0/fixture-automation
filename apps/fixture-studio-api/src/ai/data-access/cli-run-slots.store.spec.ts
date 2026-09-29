import { describe, expect, it } from 'vitest';

import { CliRunSlots } from './cli-run-slots.store.ts';

describe('FEATURE: CLI run slots', (): void => {
  describe('GIVEN two running CLIs', (): void => {
    it('WHEN a third claims a slot THEN it fails with a 429 and a fix', (): void => {
      const slots = new CliRunSlots();

      slots.claim();
      slots.claim();

      expect((): void => slots.claim()).toThrow(
        expect.objectContaining({
          statusCode: 429,
          message: 'too many AI CLI runs at once',
          fix: 'wait for a running fill or model lookup to finish'
        })
      );
    });

    it('WHEN one is released THEN the next claim succeeds', (): void => {
      const slots = new CliRunSlots();

      slots.claim();
      slots.claim();
      slots.release();

      expect((): void => slots.claim()).not.toThrow();
    });
  });
});
