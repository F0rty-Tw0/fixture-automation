import { readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveFailedResponse } from './agent-response-file.client.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import type { ProcessWorkspace } from '../test/common/process.type.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const OPTIONS: AiFixtureOptions = { tool: 'claude' };
const silenceStderr = (): boolean => true;

describe('FEATURE: failed agent response persistence', (): void => {
  let workspace: ProcessWorkspace;

  beforeEach(async (): Promise<void> => {
    workspace = await processWorkspace();
  });

  afterEach(async (): Promise<void> => {
    vi.restoreAllMocks();
    await workspace.dispose();
  });

  describe('GIVEN a recovery path', (): void => {
    it('WHEN a response contains control characters and trailing whitespace THEN writes it byte-for-byte to the first diagnostic sidecar', async (): Promise<void> => {
      const recoveryFile = workspace.file('diagnostics/response');
      const response = '\r\n{"status": \t\u0000  ';
      const saved = `${resolve(recoveryFile)}.failed-attempt-1.txt`;
      const options: AiFixtureOptions = { ...OPTIONS, recoveryFile };
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(silenceStderr);

      await saveFailedResponse(options, response, 1);

      expect(await readFile(saved, 'utf8')).toBe(response);
      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining(saved));
    });

    it('WHEN the regular diagnostic sidecar already exists THEN preserves it and creates a UUID-suffixed sidecar', async (): Promise<void> => {
      const recoveryFile = workspace.file('response');
      const existing = `${resolve(recoveryFile)}.failed-attempt-1.txt`;
      const response = 'replacement';
      const options: AiFixtureOptions = { ...OPTIONS, recoveryFile };
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(silenceStderr);

      await writeFile(existing, 'preserve this');
      await saveFailedResponse(options, response, 1);
      const entries = await readdir(dirname(existing));
      const prefix = `${basename(recoveryFile)}.failed-attempt-1-`;
      const alternatives = entries.filter((entry: string): boolean => entry.startsWith(prefix));
      const alternative = alternatives.at(0);

      expect(await readFile(existing, 'utf8')).toBe('preserve this');
      expect(alternatives).toHaveLength(1);
      expect(alternative).toBeDefined();

      if (alternative === undefined) throw new Error('expected a UUID-suffixed diagnostic sidecar');

      const saved = join(dirname(existing), alternative);

      expect(await readFile(saved, 'utf8')).toBe(response);
      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining(saved));
    });

    it('WHEN the diagnostic sidecar is a symlink THEN leaves the link target untouched and creates a UUID-suffixed sidecar', async (): Promise<void> => {
      const recoveryFile = workspace.file('response');
      const existing = `${resolve(recoveryFile)}.failed-attempt-1.txt`;
      const target = workspace.file('protected.txt');
      const response = 'malformed response';
      const options: AiFixtureOptions = { ...OPTIONS, recoveryFile };

      await writeFile(target, 'protected');
      await symlink(target, existing, 'file');
      await saveFailedResponse(options, response, 1);
      const entries = await readdir(dirname(existing));

      const prefix = `${basename(recoveryFile)}.failed-attempt-1-`;
      const alternative = entries.find((entry: string): boolean => entry.startsWith(prefix));

      expect(await readFile(target, 'utf8')).toBe('protected');
      expect(alternative).toBeDefined();

      if (alternative === undefined) throw new Error('expected a UUID-suffixed diagnostic sidecar');

      const saved = join(dirname(existing), alternative);

      expect(await readFile(saved, 'utf8')).toBe(response);
    });

    it('WHEN the recovery base is a normal output file THEN leaves that output untouched', async (): Promise<void> => {
      const recoveryFile = workspace.file('fixture.json');
      const response = '{ malformed';
      const saved = `${resolve(recoveryFile)}.failed-attempt-2.txt`;
      const options: AiFixtureOptions = { ...OPTIONS, recoveryFile };

      await writeFile(recoveryFile, '{"existing":"fixture"}\n');
      await saveFailedResponse(options, response, 2);

      expect(await readFile(recoveryFile, 'utf8')).toBe('{"existing":"fixture"}\n');
      expect(await readFile(saved, 'utf8')).toBe(response);
    });

    it('WHEN the recovery path cannot be created THEN rejects with the intended diagnostic path', async (): Promise<void> => {
      const blockingFile = workspace.file('blocked');
      const recoveryFile = join(blockingFile, 'response');
      const intended = `${resolve(recoveryFile)}.failed-attempt-1.txt`;
      const options: AiFixtureOptions = { ...OPTIONS, recoveryFile };
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(silenceStderr);

      await writeFile(blockingFile, 'not a directory');

      await expect(saveFailedResponse(options, 'malformed', 1)).rejects.toThrow(intended);
      expect(stderrWrite).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN no recovery path', (): void => {
    it('WHEN a response fails THEN does not create diagnostics or write to stderr', async (): Promise<void> => {
      const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(silenceStderr);

      await saveFailedResponse(OPTIONS, 'malformed', 1);

      expect(await readdir(workspace.directory)).toStrictEqual([]);
      expect(stderrWrite).not.toHaveBeenCalled();
    });
  });
});
