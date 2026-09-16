import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

export const saveFailedResponse = async (options: AiFixtureOptions, response: string, attempt: 1 | 2): Promise<void> => {
  if (options.recoveryFile === undefined) return;

  const basePath = resolve(options.recoveryFile);
  let file = `${basePath}.failed-attempt-${attempt}.txt`;

  try {
    await mkdir(dirname(file), { recursive: true });

    try {
      await writeFile(file, response, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    } catch (error: unknown) {
      const exists = error instanceof Error && 'code' in error && error.code === 'EEXIST';

      if (!exists) throw error;

      file = `${basePath}.failed-attempt-${attempt}-${randomUUID()}.txt`;
      await writeFile(file, response, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    }
  } catch (cause: unknown) {
    throw new Error(`Could not save failed AI response to ${file}: ${String(cause)}`, { cause });
  }

  process.stderr.write(`saved failed AI response: ${file}\n`);
};
