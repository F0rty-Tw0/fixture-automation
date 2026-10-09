import { describe, expect, it } from 'vitest';

import { studioLogger } from './studio-logger.config.ts';

const PRETTY_TRANSPORT = { target: 'pino-http-print' };

describe('FEATURE: studio logger', (): void => {
  describe('GIVEN production', (): void => {
    it.each<[boolean]>([[true], [false]])('WHEN bundled is %s THEN logs info as plain JSON', (isBundled: boolean): void => {
      const logger = studioLogger({ isProduction: true, isBundled });

      expect(logger).toStrictEqual({ level: 'info' });
    });
  });

  describe('GIVEN the bundled package outside production', (): void => {
    it('WHEN picked THEN logs info through the pretty printer', (): void => {
      const logger = studioLogger({ isProduction: false, isBundled: true });

      expect(logger).toMatchObject({ level: 'info', transport: PRETTY_TRANSPORT });
    });
  });

  describe('GIVEN a run from source outside production', (): void => {
    it('WHEN picked THEN logs debug through the pretty printer', (): void => {
      const logger = studioLogger({ isProduction: false, isBundled: false });

      expect(logger).toMatchObject({ level: 'debug', transport: PRETTY_TRANSPORT });
    });
  });
});
