import { describe, expect, it } from 'vitest';

import { studioEnv } from './studio-env.util.ts';

const E2E_VARIABLES: [string, string][] = [
  ['STUDIO_API_PORT', '3334'],
  ['STUDIO_ALLOWED_ORIGINS', 'http://127.0.0.1:4300/'],
  ['STUDIO_AI_MOCK', '1'],
  ['STUDIO_COMPUTE_TIMEOUT_MS', ' 2000 '],
  ['NODE_ENV', 'production']
];

describe('FEATURE: studio start-up settings', (): void => {
  describe('GIVEN an empty environment', (): void => {
    it('WHEN read THEN uses port 3333, a 15 s compute budget, the dev origins and real AI', (): void => {
      const env = studioEnv({});

      expect(env).toMatchObject({ port: 3333, computeTimeoutMs: 15_000, isAiMock: false, isProduction: false });
      expect(env.allowedHosts).toContain('127.0.0.1:3333');
    });
  });

  describe('GIVEN the e2e environment', (): void => {
    it('WHEN read THEN takes the port, origins, mock flag and budget from it', (): void => {
      const variables = Object.fromEntries(E2E_VARIABLES);

      const env = studioEnv(variables);

      expect(env).toMatchObject({ port: 3334, computeTimeoutMs: 2000, isAiMock: true, isProduction: true });
      expect(env.allowedOrigins).toContain('http://127.0.0.1:4300');
      expect(env.allowedHosts).toStrictEqual(['127.0.0.1:3334', 'localhost:3334', 'localhost:4200', '127.0.0.1:4200', '127.0.0.1:4300']);
    });
  });

  describe('GIVEN an invalid number', (): void => {
    it.each<[string, string, string, number]>([
      ['STUDIO_API_PORT', 'abc', 'an integer from 1 to 65535', 3333],
      ['STUDIO_API_PORT', '0', 'an integer from 1 to 65535', 3333],
      ['STUDIO_API_PORT', '70000', 'an integer from 1 to 65535', 3333],
      ['STUDIO_COMPUTE_TIMEOUT_MS', 'NaN', 'an integer from 1 to 2147483647', 15_000],
      ['STUDIO_COMPUTE_TIMEOUT_MS', '1.5', 'an integer from 1 to 2147483647', 15_000],
      ['STUDIO_COMPUTE_TIMEOUT_MS', '-1', 'an integer from 1 to 2147483647', 15_000]
    ])('WHEN %s is "%s" THEN fails naming the variable, its range and a fix', (name: string, value: string, range: string, fallback: number): void => {
      const variables = { [name]: value };
      const message = `${name} must be ${range}, got "${value}"`;
      const fix = `unset ${name}, or set it to e.g. ${fallback}`;

      expect((): unknown => studioEnv(variables)).toThrow(expect.objectContaining({ message, fix }));
    });
  });

  describe('GIVEN a blank number', (): void => {
    it('WHEN read THEN falls back to the default', (): void => {
      const variables = Object.fromEntries([['STUDIO_API_PORT', '  ']]);

      const env = studioEnv(variables);

      expect(env.port).toBe(3333);
    });
  });
});
