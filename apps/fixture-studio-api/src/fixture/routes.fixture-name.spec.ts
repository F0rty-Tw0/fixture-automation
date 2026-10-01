import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MOCK_AI } from '../ai/data-access/ai-mock.client.ts';
import type { FixtureNameResult } from '../contract/common/studio-api.type.ts';
import { studioServer } from '../test/utils/studio-spec.spec.util.ts';

describe('FEATURE: fixture name route', (): void => {
  let fastify: FastifyInstance;

  const name = async (query: Record<string, string>): Promise<LightMyRequestResponse> => {
    return fastify.inject({ method: 'GET', url: '/api/fixture-name', query });
  };

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('GIVEN a method, a concrete URL and a subdirectory', (): void => {
    it('WHEN named THEN answers the file name the CLI merge writes', async (): Promise<void> => {
      const query = { method: 'GET', url: ' /custodies/v2 ', subdirectory: '/savings/' };

      const response = await name(query);

      expect(response.statusCode).toBe(200);
      expect(response.json<FixtureNameResult>()).toStrictEqual({ fileName: 'A1eWVIW3jNsYQIoF4+npW9FHXp0=.json' });
    });
  });

  describe('GIVEN no subdirectory', (): void => {
    it('WHEN named THEN answers the unprefixed file name', async (): Promise<void> => {
      const query = { method: 'get', url: 'v1/invoices' };

      const response = await name(query);

      expect(response.json<FixtureNameResult>()).toStrictEqual({ fileName: 'OWzbMzaHATEVIEad+9Zr9i1sJwQ=.json' });
    });
  });

  describe('GIVEN a method the CLI merge refuses', (): void => {
    it('WHEN named THEN answers 400', async (): Promise<void> => {
      const query = { method: 'TRACE', url: 'v1/invoices' };

      const response = await name(query);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GIVEN a blank URL', (): void => {
    it('WHEN named THEN answers 400', async (): Promise<void> => {
      const query = { method: 'GET', url: '  ' };

      const response = await name(query);

      expect(response.statusCode).toBe(400);
    });
  });
});
