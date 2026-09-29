import { describe, expect, it } from 'vitest';

import { silentInputs } from './silent-inputs.util.ts';
import type { InputSpec } from '../common/input.type.ts';

const SPEC_URL: InputSpec = { label: 'spec-url', description: 'URL of the spec', example: 'file:///spec.json' };
const USAGE = 'usage: <spec-url>';

describe('FEATURE: silent inputs', (): void => {
  describe('GIVEN a required input', (): void => {
    it('WHEN the value is given THEN returns it', async (): Promise<void> => {
      await expect(silentInputs.required('file:///a.json', SPEC_URL, USAGE)).resolves.toBe('file:///a.json');
    });

    it.each([undefined, ''])('WHEN the value is %s THEN throws the usage', async (value): Promise<void> => {
      await expect(silentInputs.required(value, SPEC_URL, USAGE)).rejects.toThrow(USAGE);
    });

    it('WHEN a fix is given THEN the rejection carries it', async (): Promise<void> => {
      const failure = silentInputs.required(undefined, SPEC_URL, USAGE, 'pass --spec-url');

      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: 'pass --spec-url' }));
    });
  });

  describe('GIVEN an optional input', (): void => {
    it.each(['invoice', undefined])('WHEN the value is %s THEN returns it untouched', async (value): Promise<void> => {
      await expect(silentInputs.optional(value, SPEC_URL)).resolves.toBe(value);
    });
  });

  describe('GIVEN a flag', (): void => {
    it('WHEN true THEN returns true', async (): Promise<void> => {
      await expect(silentInputs.flag(true, SPEC_URL)).resolves.toBe(true);
    });

    it.each([false, undefined])('WHEN %s THEN returns false', async (value): Promise<void> => {
      await expect(silentInputs.flag(value, SPEC_URL)).resolves.toBe(false);
    });
  });
});
