import { describe, expect, it } from 'vitest';

import { DEFAULT_MODEL, selectedModel } from './model-flag.util.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

const OPTIONS: AiFixtureOptions = { tool: 'claude' };

describe('FEATURE: selected model flag', (): void => {
  describe('GIVEN options without a model', (): void => {
    it('WHEN selecting the model THEN returns undefined', (): void => {
      expect(selectedModel(OPTIONS)).toBeUndefined();
    });
  });

  describe('GIVEN options with the default literal', (): void => {
    it('WHEN selecting the model THEN returns undefined', (): void => {
      const options: AiFixtureOptions = { ...OPTIONS, model: DEFAULT_MODEL };

      expect(selectedModel(options)).toBeUndefined();
    });
  });

  describe('GIVEN options with an explicit slug', (): void => {
    it('WHEN selecting the model THEN returns the slug', (): void => {
      const options: AiFixtureOptions = { ...OPTIONS, model: 'opus' };

      expect(selectedModel(options)).toBe('opus');
    });
  });

  describe('GIVEN a model that starts with a dash', (): void => {
    it.each(['-p', '--dangerously-skip-permissions', '-'])('WHEN %s is selected THEN refuses it as a flag', (model: string): void => {
      const options: AiFixtureOptions = { ...OPTIONS, model };

      expect((): string | undefined => selectedModel(options)).toThrow(
        expect.objectContaining({
          message: `model "${model}" must not start with "-"`,
          fix: 'pass the model slug itself, e.g. --model gpt-5'
        })
      );
    });
  });

  describe('GIVEN a slug with a dash inside', (): void => {
    it('WHEN selecting the model THEN passes it through', (): void => {
      const options: AiFixtureOptions = { ...OPTIONS, model: 'gpt-5.5-codex' };

      expect(selectedModel(options)).toBe('gpt-5.5-codex');
    });
  });

  describe('GIVEN the default literal', (): void => {
    it('WHEN read THEN is the word default', (): void => {
      expect(DEFAULT_MODEL).toBe('default');
    });
  });
});
