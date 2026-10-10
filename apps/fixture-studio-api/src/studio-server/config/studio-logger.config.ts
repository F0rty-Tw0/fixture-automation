import type { StudioLogger } from '../common/studio-server.type.ts';

const PRINT_OPTIONS = { all: true, relativeUrl: true, translateTime: 'SYS:HH:MM:ss' };
const PRETTY_TRANSPORT = { target: 'pino-http-print', options: PRINT_OPTIONS };
const PRODUCTION_LOGGER: StudioLogger = { level: 'info' };

type StudioRunMode = {
  readonly isProduction: boolean;
  /** True inside the published `fixture-studio` package, whose users need request lines, not debug noise. */
  readonly isBundled: boolean;
};

/** Plain JSON at `info` in production; otherwise pretty-printed, at `debug` only when run from source. */
export const studioLogger = (mode: StudioRunMode): StudioLogger => {
  if (mode.isProduction) return PRODUCTION_LOGGER;

  const level = mode.isBundled ? 'info' : 'debug';
  const logger: StudioLogger = { level, transport: PRETTY_TRANSPORT };

  return logger;
};
