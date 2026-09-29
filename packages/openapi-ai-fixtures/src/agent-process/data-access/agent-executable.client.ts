import { access, readFile } from 'node:fs/promises';
import { delimiter, dirname, extname, isAbsolute, join, resolve } from 'node:path';

import { nodeEntryPathFromWindowsWrapper } from '../utils/agent-executable-shim.util.ts';

const NODE_ENTRY_EXTENSIONS = ['.cjs', '.js', '.mjs'];
const WINDOWS_WRAPPER_EXTENSIONS = ['.bat', '.cmd'];

type ResolvedAgentExecutable = [string, ...string[]];

const knownWindowsCommand = async (executable: string): Promise<string> => {
  const isAbsoluteExecutable = isAbsolute(executable);

  if (isAbsoluteExecutable) return executable;

  const hasExtension = extname(executable).length > 0;
  const exactNames = [executable];
  const candidateNames = [`${executable}.exe`, `${executable}.cmd`, executable];
  const names = hasExtension ? exactNames : candidateNames;
  const pathEntry = Object.entries(process.env).find(([name]): boolean => {
    return name.toLowerCase() === 'path';
  });
  const path = pathEntry?.[1] ?? '';
  const directories = path.split(delimiter).filter(Boolean);

  for (const directory of directories) {
    for (const name of names) {
      const candidate = join(directory, name);

      try {
        await access(candidate);

        return candidate;
      } catch {
        continue;
      }
    }
  }

  return executable;
};

const executableGuidance = (wrapper: string): Error => {
  return new Error(
    `Unable to safely execute Windows command wrapper "${wrapper}". Supply options.executable as an absolute native executable or Node.js entry point.`
  );
};

const nodeEntryPointFromWrapper = async (wrapper: string): Promise<string> => {
  let source: string;

  try {
    source = await readFile(wrapper, 'utf8');
  } catch {
    throw executableGuidance(wrapper);
  }

  const entryPath = nodeEntryPathFromWindowsWrapper(source);

  if (entryPath === undefined) throw executableGuidance(wrapper);

  const directoryMacro = /^(?:%~dp0|%dp0%)/i;
  const usesWrapperDirectory = directoryMacro.test(entryPath);

  if (!usesWrapperDirectory) throw executableGuidance(wrapper);

  const withoutMacro = entryPath.replace(directoryMacro, '');
  const relativeEntryPath = withoutMacro.replace(/^[\\/]+/, '');
  const wrapperDirectory = dirname(wrapper);
  const entryPoint = resolve(wrapperDirectory, relativeEntryPath);

  return entryPoint;
};

const resolvedWindowsWrapper = async (wrapper: string): Promise<ResolvedAgentExecutable> => {
  const entryPoint = await nodeEntryPointFromWrapper(wrapper);
  const executable: ResolvedAgentExecutable = [process.execPath, entryPoint];

  return executable;
};

/** Resolves a native command or a documented Node entry-point shim without a shell. */
export const resolveAgentExecutable = async (
  commandExecutable: string,
  override: string | undefined
): Promise<ResolvedAgentExecutable> => {
  if (override !== undefined) {
    const isAbsoluteOverride = isAbsolute(override);

    if (!isAbsoluteOverride) {
      const message = 'options.executable must be an absolute native executable or Node.js entry point';

      throw new Error(message);
    }

    const overrideExtension = extname(override).toLowerCase();
    const isNodeEntry = NODE_ENTRY_EXTENSIONS.includes(overrideExtension);

    if (isNodeEntry) return [process.execPath, override];

    const isWindows = process.platform === 'win32';
    const isWrapper = WINDOWS_WRAPPER_EXTENSIONS.includes(overrideExtension);

    if (isWindows && isWrapper) return resolvedWindowsWrapper(override);

    return [override];
  }

  if (process.platform !== 'win32') return [commandExecutable];

  const executable = await knownWindowsCommand(commandExecutable);
  const extension = extname(executable).toLowerCase();
  const isWrapper = WINDOWS_WRAPPER_EXTENSIONS.includes(extension);

  if (isWrapper) return resolvedWindowsWrapper(executable);

  return [executable];
};
