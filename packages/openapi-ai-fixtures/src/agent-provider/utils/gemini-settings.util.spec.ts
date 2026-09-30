import { describe, expect, it } from 'vitest';

import { assertSafeGeminiSystemSettings, geminiSettingsContent } from './gemini-settings.util.ts';
import { GEMINI_EXCLUDED_TOOLS } from '../common/gemini.const.ts';

const READ_TOOLS = ['read_file', 'grep_search', 'glob', 'list_directory'];

const parsedSettings = (content: string): unknown => {
  const settings: unknown = JSON.parse(content);

  return settings;
};

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

describe('FEATURE: Gemini generation settings', (): void => {
  describe('GIVEN a run without files', (): void => {
    it('WHEN the settings are built THEN every built-in tool is excluded', (): void => {
      const content = geminiSettingsContent(false);

      expect(parsedSettings(content)).toHaveProperty('tools.exclude', GEMINI_EXCLUDED_TOOLS);
    });
  });

  describe('GIVEN a run that reads staged files', (): void => {
    it.each(READ_TOOLS)('WHEN the settings are built THEN %s stays declared', (tool: string): void => {
      const content = geminiSettingsContent(true);

      expect(parsedSettings(content)).toHaveProperty('tools.exclude', expect.not.arrayContaining([tool]));
    });

    it.each(['read_many_files', 'write_file', 'replace', 'run_shell_command', 'web_fetch', 'google_web_search', 'read_mcp_resource'])(
      'WHEN the settings are built THEN %s stays excluded',
      (tool: string): void => {
        const content = geminiSettingsContent(true);

        expect(parsedSettings(content)).toHaveProperty('tools.exclude', expect.arrayContaining([tool]));
      }
    );
  });
});
