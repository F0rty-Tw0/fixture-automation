import { describe, expect, it } from 'vitest';

import { workerEnv } from './worker-env.util.ts';

describe('FEATURE: spec worker environment', (): void => {
  describe('GIVEN the environment of a watch-mode dev server', (): void => {
    it('WHEN derived THEN drops the dependency reporting switch and keeps everything else', (): void => {
      const variables: [string, string][] = [
        ['WATCH_REPORT_DEPENDENCIES', '1'],
        ['STUDIO_AI_MOCK', '1'],
        ['PATH', '/usr/bin']
      ];
      const env = Object.fromEntries(variables);

      const derived = workerEnv(env);

      expect(Object.keys(derived)).toStrictEqual(['STUDIO_AI_MOCK', 'PATH']);
      expect(env).toHaveProperty('WATCH_REPORT_DEPENDENCIES', '1');
    });
  });

  describe('GIVEN an environment without it', (): void => {
    it('WHEN derived THEN is an equal copy', (): void => {
      const variables: [string, string][] = [['HOME', '/home/me']];
      const env = Object.fromEntries(variables);

      const derived = workerEnv(env);

      expect(derived).toStrictEqual(env);
      expect(derived).not.toBe(env);
    });
  });
});
