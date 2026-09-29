import { stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import type { AiTool, AiToolInstall } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

type ToolExecutable = {
  readonly tool: AiTool;
  readonly executable: string;
};

/** The executable each provider client launches, in the order tools are listed everywhere else. */
const TOOL_EXECUTABLES: ToolExecutable[] = [
  { tool: 'claude', executable: 'claude' },
  { tool: 'codex', executable: 'codex' },
  { tool: 'antigravity', executable: 'agy' },
  { tool: 'copilot', executable: 'copilot' },
  { tool: 'gemini', executable: 'gemini' }
];

/** What Windows searches when `PATHEXT` is unset. */
const DEFAULT_WINDOWS_EXTENSIONS = ['.COM', '.EXE', '.BAT', '.CMD'];

/** Windows environment names are case-insensitive (`Path`), so every name is matched that way. */
const envValue = (env: NodeJS.ProcessEnv, name: string): string => {
  const isName = ([key]: [string, string | undefined]): boolean => key.toUpperCase() === name;
  const entry = Object.entries(env).find(isName);

  return entry?.[1] ?? '';
};

/** The file-name endings a command resolves through: none on POSIX, each `PATHEXT` entry on Windows. */
const executableExtensions = (env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] => {
  if (platform !== 'win32') return [''];

  const pathext = envValue(env, 'PATHEXT');
  const extensions = pathext.split(';').filter(Boolean);

  return extensions.length > 0 ? extensions : DEFAULT_WINDOWS_EXTENSIONS;
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);

    return stats.isFile();
  } catch {
    return false;
  }
};

const isOnPath = async (names: string[], directories: string[]): Promise<boolean> => {
  for (const directory of directories) {
    for (const name of names) {
      const candidate = join(directory, name);
      const found = await isFile(candidate);

      if (found) return true;
    }
  }

  return false;
};

/**
 * Which AI CLIs have their executable on `PATH`, trying each `PATHEXT` extension on Windows.
 * Only looks at files: it never starts a process, so it costs nothing and proves no login.
 */
export const detectAiTools = async (
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): Promise<AiToolInstall[]> => {
  const path = envValue(env, 'PATH');
  const directories = path.split(delimiter).filter(Boolean);
  const extensions = executableExtensions(env, platform);

  const installOf = async ({ tool, executable }: ToolExecutable): Promise<AiToolInstall> => {
    const names = extensions.map((extension) => `${executable}${extension}`);
    const installed = await isOnPath(names, directories);
    const install: AiToolInstall = { tool, installed };

    return install;
  };

  return Promise.all(TOOL_EXECUTABLES.map(installOf));
};
