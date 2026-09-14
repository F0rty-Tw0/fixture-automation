import { FixtureError } from '../common/fixture.error.ts';
import type { InputSpec, Inputs } from '../common/input.type.ts';

const required = async (value: string | undefined, _input: InputSpec, usage: string, fix?: string): Promise<string> => {
  if (value) return Promise.resolve(value);

  return Promise.reject(new FixtureError(usage, fix));
};

const optional = async (value: string | undefined): Promise<string | undefined> => Promise.resolve(value);

const flag = async (value: boolean | undefined): Promise<boolean> => Promise.resolve(value === true);

/** Inputs for a pipe or CI run: nothing is asked, a missing required value is the usage error. */
export const silentInputs: Inputs = { required, optional, flag };
