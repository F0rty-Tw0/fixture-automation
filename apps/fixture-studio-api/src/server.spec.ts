import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_AI } from './ai/data-access/ai-mock.client.ts';
import type { ApiErrorBody } from './contract/common/studio-api.type.ts';
import { buildServer } from './server.ts';
import type { StudioServerOptions } from './studio-server/common/studio-server.type.ts';
import { allowedHosts, allowedOrigins } from './studio-server/utils/allowed-origins.util.ts';
import { studioAiMock } from './test/mocks/studio-ai.mock.ts';
import { staticUiFolder } from './test/utils/static-ui.spec.util.ts';
import { studioServer } from './test/utils/studio-spec.spec.util.ts';

const MISSING_SPEC_URL = '/api/specs/missing/generate';
const MODELS_URL = '/api/ai/cli/models?tool=claude';
const FORBIDDEN_ORIGIN: ApiErrorBody = {
  message: 'origin not allowed',
  fix: 'open Fixture Studio from an allowed origin, or add yours to STUDIO_ALLOWED_ORIGINS'
};
const GENERATE_BODY = { endpointIds: ['GET /a'], formats: ['json'], requiredOnly: false };
const UI_HOST = '127.0.0.1:3999';
const UI_ORIGINS = allowedOrigins(undefined, 3999, true);
const UI_HOSTS = allowedHosts(3999, UI_ORIGINS);
const UI_SERVER_OPTIONS: StudioServerOptions = {
  allowedOrigins: UI_ORIGINS,
  allowedHosts: UI_HOSTS,
  logger: false,
  ai: MOCK_AI,
  computeTimeoutMs: 15_000,
  warmSpecWorker: false
};

describe('FEATURE: studio server', (): void => {
  let fastify: FastifyInstance;

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('SCENARIO: access guard', (): void => {
    describe('GIVEN the default allowlist', (): void => {
      beforeEach(async (): Promise<void> => {
        fastify = await studioServer(MOCK_AI);
      });

      it('WHEN a foreign origin calls THEN answers 403 before the route runs', async (): Promise<void> => {
        const headers = { origin: 'https://evil.example' };

        const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

        expect(response.statusCode).toBe(403);
        expect(response.json()).toStrictEqual(FORBIDDEN_ORIGIN);
      });

      it.each(['http://localhost:4200', 'http://127.0.0.1:4200'])(
        'WHEN the allowed origin %s calls THEN reaches the route',
        async (origin: string): Promise<void> => {
          const headers = { origin };

          const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

          expect(response.statusCode).toBe(404);
        }
      );

      it('WHEN a tool sends neither Origin nor Sec-Fetch-Site THEN reaches the route', async (): Promise<void> => {
        const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, payload: GENERATE_BODY });

        expect(response.statusCode).toBe(404);
        expect(response.json<ApiErrorBody>().message).toBe('spec not found');
      });

      it('WHEN the dev proxy forwards Host localhost:4200 from the same origin THEN reaches the route', async (): Promise<void> => {
        const headers = { host: 'localhost:4200', 'sec-fetch-site': 'same-origin' };

        const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

        expect(response.statusCode).toBe(404);
      });

      it('WHEN a rebound domain is the Host THEN answers 403', async (): Promise<void> => {
        const headers = { host: 'evil.example:3333' };

        const response = await fastify.inject({ method: 'GET', url: MODELS_URL, headers });

        expect(response.statusCode).toBe(403);
        expect(response.json<ApiErrorBody>().message).toBe('host not allowed');
      });
    });

    describe('GIVEN a cross-site page embedding the models URL', (): void => {
      it('WHEN the browser fetches it without an Origin THEN answers 403 and no CLI runs', async (): Promise<void> => {
        const ai = studioAiMock();

        fastify = await studioServer(ai);
        const headers = { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'image' };

        const response = await fastify.inject({ method: 'GET', url: MODELS_URL, headers });

        expect(response.statusCode).toBe(403);
        expect(response.json<ApiErrorBody>().message).toBe('cross-site request refused');
        expect(vi.mocked(ai.discover)).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN the e2e setup: API on 3334 behind a proxy on 127.0.0.1:4300', (): void => {
      beforeEach((): void => {
        const origins = allowedOrigins('http://127.0.0.1:4300', 3334, false);
        const hosts = allowedHosts(3334, origins);

        fastify = buildServer({
          allowedOrigins: origins,
          allowedHosts: hosts,
          logger: false,
          ai: MOCK_AI,
          computeTimeoutMs: 15_000,
          warmSpecWorker: false
        });
      });

      it.each(['127.0.0.1:4300', '127.0.0.1:3334', 'localhost:3334'])(
        'WHEN the Host is %s THEN reaches the route',
        async (host: string): Promise<void> => {
          const headers = { host, origin: 'http://127.0.0.1:4300' };

          const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

          expect(response.statusCode).toBe(404);
        }
      );

      it('WHEN the Host is the default port THEN answers 403', async (): Promise<void> => {
        const headers = { host: 'localhost:3333' };

        const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

        expect(response.statusCode).toBe(403);
      });
    });
  });

  describe('SCENARIO: error bodies', (): void => {
    beforeEach(async (): Promise<void> => {
      fastify = await studioServer(MOCK_AI);
    });

    describe('GIVEN an unknown route', (): void => {
      it('WHEN it is called THEN answers 404 with an ApiErrorBody', async (): Promise<void> => {
        const response = await fastify.inject({ method: 'GET', url: '/api/nope' });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual({ message: 'route not found: GET /api/nope' });
      });
    });

    describe('GIVEN a malformed JSON body', (): void => {
      it('WHEN it is posted THEN answers 400 with an ApiErrorBody', async (): Promise<void> => {
        const headers = { 'content-type': 'application/json' };

        const response = await fastify.inject({ method: 'POST', url: '/api/specs', headers, payload: '{nope' });

        expect(response.statusCode).toBe(400);
        const body = response.json<ApiErrorBody>();

        expect(response.statusCode).toBe(400);
        expect(body.message).toContain('JSON');
        expect(body.fix).toBeUndefined();
      });
    });
  });

  describe('SCENARIO: static UI', (): void => {
    describe('GIVEN a built UI at uiRoot on port 3999', (): void => {
      let folder: string;

      beforeEach(async (): Promise<void> => {
        folder = await staticUiFolder();
        const uiRoot = join(folder, 'ui');

        fastify = buildServer({ ...UI_SERVER_OPTIONS, uiRoot });
      });

      afterEach(async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true });
      });

      it('WHEN the browser navigates to / THEN answers the index page as HTML', async (): Promise<void> => {
        const headers = { host: UI_HOST, 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate' };

        const response = await fastify.inject({ method: 'GET', url: '/', headers });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('<p>ui</p>');
        expect(response.headers['content-type']).toMatch(/^text\/html/u);
      });

      it('WHEN the page loads /app.js from the same origin THEN answers 200', async (): Promise<void> => {
        const headers = { host: UI_HOST, 'sec-fetch-site': 'same-origin' };

        const response = await fastify.inject({ method: 'GET', url: '/app.js', headers });

        expect(response.statusCode).toBe(200);
      });

      it('WHEN a missing asset is requested THEN answers 404 with an ApiErrorBody', async (): Promise<void> => {
        const headers = { host: UI_HOST };

        const response = await fastify.inject({ method: 'GET', url: '/missing.js', headers });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual({ message: 'route not found: GET /missing.js' });
      });

      it('WHEN an unknown API route is called THEN answers 404 with an ApiErrorBody', async (): Promise<void> => {
        const headers = { host: UI_HOST };

        const response = await fastify.inject({ method: 'GET', url: '/api/nope', headers });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual({ message: 'route not found: GET /api/nope' });
      });

      it.each([
        ['/..%2fpackage.json', 404, 'route not found: GET /..%2fpackage.json'],
        ['/%2e%2e/package.json', 404, 'route not found: GET /package.json']
      ])(
        'WHEN %s climbs out of uiRoot THEN answers %i without leaking the file',
        async (url: string, statusCode: number, message: string): Promise<void> => {
          const headers = { host: UI_HOST };

          const response = await fastify.inject({ method: 'GET', url, headers });

          expect(response.body).not.toContain('sentinel');
          expect(response.statusCode).toBe(statusCode);
          expect(response.json<ApiErrorBody>().message).toBe(message);
        }
      );

      it('WHEN the page posts to the API from its own origin THEN reaches the route', async (): Promise<void> => {
        const headers = { host: UI_HOST, origin: `http://${UI_HOST}` };

        const response = await fastify.inject({ method: 'POST', url: MISSING_SPEC_URL, headers, payload: GENERATE_BODY });

        expect(response.statusCode).toBe(404);
        expect(response.json<ApiErrorBody>().message).toBe('spec not found');
      });
    });

    describe('GIVEN no uiRoot', (): void => {
      beforeEach((): void => {
        fastify = buildServer(UI_SERVER_OPTIONS);
      });

      it('WHEN the browser navigates to / THEN answers 404 with an ApiErrorBody', async (): Promise<void> => {
        const headers = { host: UI_HOST, 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate' };

        const response = await fastify.inject({ method: 'GET', url: '/', headers });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toStrictEqual({ message: 'route not found: GET /' });
      });
    });
  });
});
