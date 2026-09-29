import { describe, expect, it } from 'vitest';

import { assertSafeGeminiSystemSettings } from './gemini-settings.util.ts';

describe('FEATURE: Gemini system settings safety', (): void => {
  describe('GIVEN an ambiguous string-valued Auto Memory setting', (): void => {
    it('WHEN checking discovery safety THEN rejects the setting instead of coercing it', (): void => {
      const content = '{"experimental":{"autoMemory":"false"}}';
      const verify = (): void => assertSafeGeminiSystemSettings(content);

      expect(verify).toThrow(/system settings enable Auto Memory/);
    });
  });

  describe('GIVEN an ambiguous string-valued hook setting', (): void => {
    it('WHEN checking discovery safety THEN rejects the setting instead of coercing it', (): void => {
      const content = '{"hooksConfig":{"enabled":"false"}}';
      const verify = (): void => assertSafeGeminiSystemSettings(content);

      expect(verify).toThrow(/system settings enable hooks/);
    });
  });
});
