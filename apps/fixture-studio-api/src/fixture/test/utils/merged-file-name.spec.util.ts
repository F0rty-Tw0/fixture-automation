import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { mergeFixture } from '@fixture-automation/openapi-fixture-merge';
import type { MergeInput } from '@fixture-automation/openapi-fixture-merge';

/** The file name `mergeFixture` writes, run as the CLI wizard runs it, for `endpointUrl` under `subdirectory`; its temp directory is gone when it returns. */
export const mergedFileName = async (endpointUrl: string, subdirectory: string | undefined): Promise<string> => {
  const outDir = await mkdtemp(join(tmpdir(), 'fixture-name-'));
  const corruptFile = join(outDir, 'corrupt.json');
  const populatedFile = join(outDir, 'populated.json');
  const input: MergeInput = { corruptFile, populatedFile, outDir, endpointUrl, subdirectory };

  try {
    await writeFile(corruptFile, '{}');
    await writeFile(populatedFile, '{}');

    const result = await mergeFixture(input);

    return basename(result.outFile);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
};
