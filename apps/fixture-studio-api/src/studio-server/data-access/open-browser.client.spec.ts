import { ChildProcess } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { openBrowser } from './open-browser.client.ts';

const URL = 'http://127.0.0.1:3333/';
const DETACHED = { detached: true, stdio: 'ignore' };

describe('FEATURE: browser opener', (): void => {
  describe('GIVEN Windows', (): void => {
    it('WHEN opened THEN starts the URL through cmd with verbatim arguments and a hidden window', (): void => {
      const child = new ChildProcess();
      const spawnFn = vi.fn((): ChildProcess => child);

      openBrowser(URL, vi.fn(), spawnFn, 'win32');

      expect(spawnFn).toHaveBeenCalledWith(
        'cmd',
        ['/c', 'start', '""', URL],
        expect.objectContaining({ ...DETACHED, windowsHide: true, windowsVerbatimArguments: true })
      );
    });
  });

  describe('GIVEN a non-Windows platform', (): void => {
    it.each<[NodeJS.Platform, string]>([
      ['darwin', 'open'],
      ['linux', 'xdg-open']
    ])('WHEN opened on %s THEN runs %s with the URL, detached', (platform: NodeJS.Platform, command: string): void => {
      const child = new ChildProcess();
      const spawnFn = vi.fn((): ChildProcess => child);

      openBrowser(URL, vi.fn(), spawnFn, platform);

      expect(spawnFn).toHaveBeenCalledWith(command, [URL], expect.objectContaining(DETACHED));
    });
  });

  describe('GIVEN a spawned opener', (): void => {
    it('WHEN opened THEN releases the child so it cannot hold the server open', (): void => {
      const child = new ChildProcess();
      const unref = vi.spyOn(child, 'unref');
      const spawnFn = vi.fn((): ChildProcess => child);

      openBrowser(URL, vi.fn(), spawnFn, 'linux');

      expect(unref).toHaveBeenCalledOnce();
    });

    it('WHEN the child reports an error THEN hands it to onError once instead of throwing', (): void => {
      const child = new ChildProcess();
      const spawnFn = vi.fn((): ChildProcess => child);
      const onError = vi.fn<(error: Error) => void>();
      const error = new Error('spawn xdg-open ENOENT');

      openBrowser(URL, onError, spawnFn, 'linux');

      const isHandled = child.emit('error', error);

      expect(isHandled).toBe(true);
      expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    });
  });
});
