import { afterEach, describe, expect, it, vi } from 'vitest';

import { promptedInputs } from './input-prompt.client.ts';
import type { InputSpec, Question } from '../common/input.type.ts';

const SPEC_URL: InputSpec = { label: 'spec-url', description: 'URL of the spec', example: 'file:///spec.json' };
const SCHEMA: InputSpec = { label: 'schema-name', description: 'a key under components.schemas', example: 'invoice' };
const REQUIRED_ONLY: InputSpec = { label: '--required-only', description: 'required properties only', example: '' };
const USAGE = 'usage: <spec-url> [schema-name]';

const answering = (...answers: string[]): Question => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

const silence = (): void => undefined;

describe('FEATURE: prompted inputs', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a required input with a value', (): void => {
    it('WHEN resolving THEN returns it without asking', async (): Promise<void> => {
      const question = vi.fn(answering('other'));

      const value = await promptedInputs(question).required('file:///a.json', SPEC_URL, USAGE);

      expect(value).toBe('file:///a.json');
      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a required input without a value', (): void => {
    it('WHEN an answer is typed THEN returns it trimmed', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('  file:///a.json  '));

      const value = await promptedInputs(question).required(undefined, SPEC_URL, USAGE);

      expect(value).toBe('file:///a.json');
    });

    it('WHEN a blank precedes the answer THEN re-asks', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);

      const value = await promptedInputs(answering('', 'file:///a.json')).required(undefined, SPEC_URL, USAGE);

      expect(value).toBe('file:///a.json');
    });

    it('WHEN three answers are blank THEN throws with the usage as the fix', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const failure = promptedInputs(answering('', ' ', '')).required(undefined, SPEC_URL, USAGE);

      await expect(failure).rejects.toThrow('no spec-url given after 3 attempts');
      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: USAGE }));
    });
  });

  describe('GIVEN an optional input when nothing was prompted', (): void => {
    it.each(['invoice', undefined])('WHEN the value is %s THEN returns it without asking', async (value): Promise<void> => {
      const question = vi.fn(answering('other'));

      const resolved = await promptedInputs(question).optional(value, SCHEMA);

      expect(resolved).toBe(value);
      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN an optional input after a required prompt', (): void => {
    it('WHEN an answer is typed THEN returns it', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const inputs = promptedInputs(answering('file:///a.json', 'invoice'));

      await inputs.required(undefined, SPEC_URL, USAGE);
      const value = await inputs.optional(undefined, SCHEMA);

      expect(value).toBe('invoice');
    });

    it('WHEN Enter is pressed THEN returns undefined', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const inputs = promptedInputs(answering('file:///a.json', ''));

      await inputs.required(undefined, SPEC_URL, USAGE);

      await expect(inputs.optional(undefined, SCHEMA)).resolves.toBeUndefined();
    });

    it('WHEN the value is given THEN returns it without asking', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('file:///a.json'));
      const inputs = promptedInputs(question);

      await inputs.required(undefined, SPEC_URL, USAGE);
      const value = await inputs.optional('refund', SCHEMA);

      expect(value).toBe('refund');
      expect(question).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN a flag when nothing was prompted', (): void => {
    it.each([true, false, undefined])('WHEN the value is %s THEN returns it as a boolean', async (value): Promise<void> => {
      const question = vi.fn(answering('y'));

      const resolved = await promptedInputs(question).flag(value, REQUIRED_ONLY);

      expect(resolved).toBe(value === true);
      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a flag after a required prompt', (): void => {
    it.each([
      ['y', true],
      ['yes', true],
      ['YES', true],
      ['', false],
      ['n', false]
    ])('WHEN %s is typed THEN returns %s', async (answer: string, expected: boolean): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const inputs = promptedInputs(answering('file:///a.json', answer));

      await inputs.required(undefined, SPEC_URL, USAGE);
      const value = await inputs.flag(undefined, REQUIRED_ONLY);

      expect(value).toBe(expected);
    });
  });
});
