import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

import type { AgentCommand } from '../common/agent.type.ts';

const safeFilePath = (scratchDirectory: string, path: string): string => {
  const normalizedPath = path.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  const hasUnsafeSegment = segments.some((segment): boolean => {
    return segment.length === 0 || segment === '.' || segment === '..';
  });
  const hasDrivePrefix = /^[a-z]:/i.test(normalizedPath);
  const hasWindowsSpecialSegment = segments.some((segment): boolean => {
    return segment.includes(':');
  });
  const isAbsolutePath = isAbsolute(path);
  const startsAtRoot = normalizedPath.startsWith('/');
  const isUnsafe = isAbsolutePath || startsAtRoot || hasDrivePrefix || hasUnsafeSegment || hasWindowsSpecialSegment;

  if (isUnsafe) {
    const message = `Agent file path "${path}" must be relative and stay within the agent scratch directory`;

    throw new Error(message);
  }

  return join(scratchDirectory, ...segments);
};

export const stageAgentFiles = async (scratchDirectory: string, command: AgentCommand): Promise<void> => {
  const files = command.files ?? [];

  for (const file of files) {
    const target = safeFilePath(scratchDirectory, file.path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
};

export const agentEnvironment = (command: AgentCommand): NodeJS.ProcessEnv => {
  const environment: Record<string, string | undefined> = { ...process.env };
  const overlay = command.env ?? {};
  const isWindows = process.platform === 'win32';

  for (const [name, value] of Object.entries(overlay)) {
    const matchingNames = Object.keys(environment).filter((entry): boolean => {
      if (isWindows) return entry.toLowerCase() === name.toLowerCase();

      return entry === name;
    });

    for (const matchingName of matchingNames) {
      Reflect.deleteProperty(environment, matchingName);
    }

    if (value !== undefined) environment[name] = value;
  }

  return environment;
};
