import { once } from 'node:events';
import type { Server } from 'node:net';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { launchStudio } from './studio-launch.ts';
import { MOCK_AI } from '../../ai/data-access/ai-mock.client.ts';
import { listeningPort, portHolder } from '../../test/utils/held-port.spec.util.ts';
import { studioServer } from '../../test/utils/studio-spec.spec.util.ts';
import type { StudioLaunch } from '../common/studio-server.type.ts';

describe('FEATURE: studio launch', (): void => {
  let fastify: FastifyInstance;
  let openBrowser: Mock<StudioLaunch['openBrowser']>;
  let writeStdout: Mock<StudioLaunch['writeStdout']>;

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
    openBrowser = vi.fn<StudioLaunch['openBrowser']>();
    writeStdout = vi.fn<StudioLaunch['writeStdout']>();
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe('GIVEN the port is already taken', (): void => {
    let holder: Server;
    let launch: StudioLaunch;

    beforeEach(async (): Promise<void> => {
      holder = await portHolder();
      const port = listeningPort(holder);

      launch = { fastify, port, isBundled: true, isOpen: true, openBrowser, writeStdout };
    });

    afterEach(async (): Promise<void> => {
      holder.close();
      await once(holder, 'close');
    });

    it('WHEN launched THEN answers exit code 1', async (): Promise<void> => {
      const exitCode = await launchStudio(launch);

      expect(exitCode).toBe(1);
    });

    it('WHEN launched THEN prints no URL', async (): Promise<void> => {
      await launchStudio(launch);

      expect(writeStdout).not.toHaveBeenCalled();
    });

    it('WHEN launched THEN opens no browser', async (): Promise<void> => {
      await launchStudio(launch);

      expect(openBrowser).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a free port in bundled mode', (): void => {
    let launch: StudioLaunch;

    beforeEach((): void => {
      launch = { fastify, port: 0, isBundled: true, isOpen: true, openBrowser, writeStdout };
    });

    it('WHEN launched THEN answers exit code 0', async (): Promise<void> => {
      const exitCode = await launchStudio(launch);

      expect(exitCode).toBe(0);
    });

    it('WHEN launched THEN prints the loopback URL it listens on', async (): Promise<void> => {
      await launchStudio(launch);

      const port = listeningPort(fastify.server);

      expect(writeStdout).toHaveBeenCalledExactlyOnceWith(`Fixture Studio: http://127.0.0.1:${port}\n`);
    });

    it('WHEN launched THEN opens that URL in a browser', async (): Promise<void> => {
      await launchStudio(launch);

      const port = listeningPort(fastify.server);

      expect(openBrowser).toHaveBeenCalledExactlyOnceWith(`http://127.0.0.1:${port}`, expect.any(Function));
    });

    it('WHEN launched with --no-open THEN prints the URL but opens no browser', async (): Promise<void> => {
      const noOpen: StudioLaunch = { ...launch, isOpen: false };

      await launchStudio(noOpen);

      expect(writeStdout).toHaveBeenCalledOnce();
      expect(openBrowser).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a free port in source mode, where the Angular dev server owns the UI', (): void => {
    it('WHEN launched THEN listens but neither prints a URL nor opens a browser', async (): Promise<void> => {
      const launch: StudioLaunch = { fastify, port: 0, isBundled: false, isOpen: true, openBrowser, writeStdout };

      const exitCode = await launchStudio(launch);

      expect(exitCode).toBe(0);
      expect(writeStdout).not.toHaveBeenCalled();
      expect(openBrowser).not.toHaveBeenCalled();
    });
  });
});
