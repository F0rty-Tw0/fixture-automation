import type { StudioLaunch } from '../common/studio-server.type.ts';

const HOST = '127.0.0.1';

/** Prints the bundled UI's URL and, unless `--no-open`, opens it; a missing browser only logs a warning. */
const announceUi = (launch: StudioLaunch, url: string): void => {
  launch.writeStdout(`Fixture Studio: ${url}\n`);

  if (!launch.isOpen) return;

  const warnNoBrowser = (error: Error): void => {
    launch.fastify.log.warn({ err: error }, 'could not open a browser; open the URL yourself');
  };

  launch.openBrowser(url, warnNoBrowser);
};

/**
 * Listens on loopback at `launch.port` and answers the process exit code. Bundled, it then announces the UI's URL;
 * a failed listen logs, closes the server and answers 1 without printing or opening anything.
 */
export const launchStudio = async (launch: StudioLaunch): Promise<number> => {
  let url: string;

  try {
    url = await launch.fastify.listen({ host: HOST, port: launch.port });
  } catch (error: unknown) {
    launch.fastify.log.error({ err: error }, 'Fixture Studio API failed to start');
    await launch.fastify.close();

    return 1;
  }

  if (launch.isBundled) announceUi(launch, url);

  return 0;
};
