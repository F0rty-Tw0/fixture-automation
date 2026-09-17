import { FixtureError, promptedInputs, silentInputs } from '@fixture-automation/openapi-fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { answering } from '@fixture-automation/shared/testing';

import { endpointUrlInput } from './endpoint-prompt.util.ts';

const USAGE = 'usage: test';

describe('FEATURE: endpoint prompt', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN an --endpoint-url flag value', (): void => {
    it('WHEN resolving the endpoint THEN returns the flag untouched without prompting', async (): Promise<void> => {
      const question = vi.fn(answering());
      const inputs = promptedInputs(question);

      const endpointUrl = await endpointUrlInput(inputs, 'GET, custodies/v2', USAGE);

      expect(endpointUrl).toBe('GET, custodies/v2');
      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN no flag and a terminal answering method then target-url', (): void => {
    it('WHEN resolving the endpoint THEN joins the answers as method,path', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation((): void => undefined);
      const inputs = promptedInputs(answering('get', 'v1/invoices/in_1'));

      const endpointUrl = await endpointUrlInput(inputs, undefined, USAGE);

      expect(endpointUrl).toBe('get,v1/invoices/in_1');
    });
  });

  describe('GIVEN no flag and an unknown method answer', (): void => {
    it('WHEN resolving the endpoint THEN rejects before asking the target-url', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation((): void => undefined);
      const inputs = promptedInputs(answering('fetch', 'v1/invoices/in_1'));
      const expected = new FixtureError('unknown HTTP method: fetch', 'use one of get, post, put, patch, delete, head, options');

      await expect(endpointUrlInput(inputs, undefined, USAGE)).rejects.toThrow(expected);
    });
  });

  describe('GIVEN no flag and no terminal', (): void => {
    it('WHEN resolving the endpoint THEN throws the usage error', async (): Promise<void> => {
      await expect(endpointUrlInput(silentInputs, undefined, USAGE)).rejects.toThrow(new FixtureError(USAGE));
    });
  });
});
