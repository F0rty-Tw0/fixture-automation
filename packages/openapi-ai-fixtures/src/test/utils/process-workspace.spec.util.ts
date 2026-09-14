import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { isMissingFile } from '@fixture-automation/shared';

import type { ProcessWorkspace } from '../common/process.type.ts';

const readWhenAvailable = async (file: string): Promise<string> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      return await readFile(file, 'utf8');
    } catch (error: unknown) {
      const isMissing = isMissingFile(error);

      if (!isMissing) throw error;

      await setTimeout(10);
    }
  }

  throw new Error(`Timed out waiting for fixture file: ${file}`);
};

export const processWorkspace = async (): Promise<ProcessWorkspace> => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-process-spec-'));
  const file = (name: string): string => join(directory, name);
  const waitForFile = async (name: string): Promise<string> => readWhenAvailable(file(name));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };
  const workspace: ProcessWorkspace = { directory, dispose, file, waitForFile };

  return workspace;
};
