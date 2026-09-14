import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFixturesCli } from './fixtures-cli.client.ts';
import { promptedInputs } from './input-prompt.client.ts';
import type { Question } from '../common/input.type.ts';
import { fixtureUrl } from '../test/utils/fixture-url.spec.util.ts';

const SPEC_URL = fixtureUrl().href;

const answering = (...answers: string[]): Question => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

const silence = (): void => undefined;

const capturedStdout = (): string[] => {
  const chunks: string[] = [];
  const write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  vi.spyOn(process.stdout, 'write').mockImplementation(write);

  return chunks;
};

describe('FEATURE: fixtures command line in a terminal', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN no arguments', (): void => {
    it('WHEN the spec URL and schema are typed THEN writes the fixture to stdout', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const chunks = capturedStdout();
      const question = vi.fn(answering(SPEC_URL, 'invoice', '', '', ''));

      await runFixturesCli([], promptedInputs(question));

      expect(JSON.parse(chunks.join(''))).toMatchObject({ id: 'in_123', status: 'draft' });
      expect(question).toHaveBeenCalledTimes(5);
    });
  });

  describe('GIVEN the spec URL and schema as arguments', (): void => {
    it('WHEN running THEN never asks', async (): Promise<void> => {
      capturedStdout();
      const question = vi.fn(answering('unused'));

      await runFixturesCli([SPEC_URL, 'invoice'], promptedInputs(question));

      expect(question).not.toHaveBeenCalled();
    });
  });
});
