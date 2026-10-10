import { spawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';

type SpawnOpener = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

const DETACHED: SpawnOptions = { detached: true, stdio: 'ignore' };
// `windowsVerbatimArguments` stops libuv escaping `""` into `"\"\""`, which `start` would take as the window title.
const WINDOWS_DETACHED: SpawnOptions = { ...DETACHED, windowsHide: true, windowsVerbatimArguments: true };

const openerCommand = (platform: NodeJS.Platform): string => {
  if (platform === 'darwin') return 'open';

  return 'xdg-open';
};

const spawnOpener = (url: string, spawnFn: SpawnOpener, platform: NodeJS.Platform): ChildProcess => {
  if (platform === 'win32') return spawnFn('cmd', ['/c', 'start', '""', url], WINDOWS_DETACHED);

  const command = openerCommand(platform);

  return spawnFn(command, [url], DETACHED);
};

/** Opens `url` in the default browser; a failure (e.g. no opener installed) goes to `onError` instead of crashing the process. */
export const openBrowser = (
  url: string,
  onError: (error: Error) => void,
  spawnFn: SpawnOpener = spawn,
  platform: NodeJS.Platform = process.platform
): void => {
  const child = spawnOpener(url, spawnFn, platform);

  child.once('error', onError);
  child.unref();
};
