import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printHelp } from './cli-help.client.ts';

const HELP = 'usage: openapi-fixtures <spec-url>\n\n  --help  print this help';
const STYLED_HELP = '[1m[36musage: openapi-fixtures <spec-url>[39m[22m\n\n  --help  print this help';

const captured = (): string[] => {
  const chunks: string[] = [];
  const write = (chunk: unknown): boolean => {
    chunks.push(String(chunk));

    return true;
  };

  vi.spyOn(process.stdout, 'write').mockImplementation(write);

  return chunks;
};

describe('FEATURE: command line help printing', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GIVEN colors are disabled', (): void => {
    beforeEach((): void => {
      vi.stubEnv('FORCE_COLOR', undefined);
      vi.stubEnv('NO_COLOR', '1');
    });

    it('WHEN printing THEN writes the help unchanged with a trailing newline', (): void => {
      const chunks = captured();

      printHelp(HELP);

      expect(chunks).toStrictEqual([`${HELP}\n`]);
    });
  });

  describe('GIVEN colors are forced', (): void => {
    beforeEach((): void => {
      vi.stubEnv('NO_COLOR', undefined);
      vi.stubEnv('FORCE_COLOR', '1');
    });

    it('WHEN printing THEN styles only the usage heading', (): void => {
      const chunks = captured();

      printHelp(HELP);

      expect(chunks).toStrictEqual([`${STYLED_HELP}\n`]);
    });
  });
});
