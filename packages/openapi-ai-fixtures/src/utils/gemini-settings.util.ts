import { isRecord } from '@fixture-automation/shared';

const JSON_COMMENTS = /("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;

const removeJsonComment = (match: string, quoted: string | undefined): string => {
  if (quoted !== undefined) return quoted;

  return match.replace(/[^\r\n]/g, ' ');
};

const assertDisabledSetting = (group: unknown, key: string, label: string): void => {
  if (group === undefined) return;

  const isGroup = isRecord(group);

  if (!isGroup) throw new Error(`Gemini model discovery found invalid managed ${label} settings`);

  const enabled = group[key];

  if (enabled === undefined || enabled === false) return;

  throw new Error(`Gemini system settings enable ${label}; safe model discovery is unavailable`);
};

export const assertSafeGeminiSystemSettings = (content: string): void => {
  const json = content.replace(JSON_COMMENTS, removeJsonComment);
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch (error: unknown) {
    throw new Error('Gemini model discovery could not verify managed system settings', { cause: error });
  }

  if (!isRecord(value)) throw new Error('Gemini model discovery found invalid managed system settings');

  assertDisabledSetting(value['experimental'], 'autoMemory', 'Auto Memory');
  assertDisabledSetting(value['hooksConfig'], 'enabled', 'hooks');
};
