import { signal } from '@angular/core';

import { describe, expect, it, vi } from 'vitest';

import { RunToken } from './run-token.ts';

describe('FEATURE: run token', (): void => {
  const source = signal('compare-1');
  const runs = new RunToken(source);

  /** A load whose result lands only after `between` ran, as a late answer or merge does. */
  const landAfter = async (between: () => void, keep: (value: string) => void): Promise<string> => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const kept = runs.keepIfCurrent(async () => promise, keep);

    between();
    resolve('result');

    return kept;
  };

  it('GIVEN a run that stays current WHEN its result lands THEN keeps it', async (): Promise<void> => {
    const keep = vi.fn<(value: string) => void>();

    await landAfter((): void => undefined, keep);

    expect(keep).toHaveBeenCalledWith('result');
  });

  it.each([
    ['a new run starts', (): void => runs.renew()],
    ['the source changes', (): void => source.set('compare-2')]
  ])('GIVEN a run WHEN %s before its result lands THEN drops the result but still returns it', async (_label, between): Promise<void> => {
    const keep = vi.fn<(value: string) => void>();

    const returned = await landAfter(between, keep);

    expect(keep).not.toHaveBeenCalled();
    expect(returned).toBe('result');
  });
});
