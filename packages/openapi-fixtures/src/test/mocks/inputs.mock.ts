import { vi } from 'vitest';

import type { Inputs } from '../../common/input.type.ts';

/** Inputs of an open prompt session: every unset value is answered with `answer`, and every call is recorded. */
export const inputsMock = (answer: string): Inputs => {
  const required = vi.fn(async (value: string | undefined): Promise<string> => Promise.resolve(value ?? answer));
  const optional = vi.fn(async (value: string | undefined): Promise<string | undefined> => Promise.resolve(value ?? answer));
  const flag = vi.fn(async (value: boolean | undefined): Promise<boolean> => Promise.resolve(value === true));
  const inputs: Inputs = { required, optional, flag };

  return inputs;
};
