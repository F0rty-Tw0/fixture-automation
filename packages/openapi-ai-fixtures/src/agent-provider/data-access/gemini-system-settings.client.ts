import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { isAbsolute } from 'node:path';

import { isMissingFile } from '@fixture-automation/shared';

import { assertSafeGeminiSystemSettings } from '../utils/gemini-settings.util.ts';

export const geminiSystemSettingsPath = (): string => {
  const configured = process.env['GEMINI_CLI_SYSTEM_SETTINGS_PATH'];

  if (configured) {
    const isConfiguredPathAbsolute = isAbsolute(configured);

    if (!isConfiguredPathAbsolute) throw new Error('Gemini model discovery cannot verify a relative system settings path');

    return configured;
  }

  const currentPlatform = platform();

  if (currentPlatform === 'darwin') return '/Library/Application Support/GeminiCli/settings.json';

  if (currentPlatform === 'win32') return 'C:\\ProgramData\\gemini-cli\\settings.json';

  return '/etc/gemini-cli/settings.json';
};

export const assertSafeSystemSettings = async (path: string): Promise<void> => {
  let content: string;

  try {
    content = await readFile(path, 'utf8');
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (isMissing) return;

    throw new Error('Gemini model discovery could not verify managed system settings', { cause: error });
  }

  assertSafeGeminiSystemSettings(content);
};
