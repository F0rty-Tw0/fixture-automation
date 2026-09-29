import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PopulatedModuleProject } from '../common/populated-module.type.ts';

const MANIFEST = '{ "type": "module" }\n';

const MISSING_TYPES = `export type components = {
  schemas: {
    missing: {
      status: string;
    };
  };
};
`;

export const STUB_SOURCE = `import type { components } from "./missing.d.ts";

export const MISSING_STUB: components["schemas"]["missing"] = { status: "open" };
`;

export const populatedModuleProject = async (): Promise<PopulatedModuleProject> => {
  const directory = await mkdtemp(join(tmpdir(), 'merge-populated-'));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const write = async (name: string, source: string): Promise<string> => {
      const file = join(directory, name);

      await writeFile(file, source);

      return file;
    };

    await write('package.json', MANIFEST);
    await write('missing.d.ts', MISSING_TYPES);

    const stubFile = await write('populated.stub.ts', STUB_SOURCE);
    const project: PopulatedModuleProject = { directory, stubFile, write, dispose };

    return project;
  } catch (error: unknown) {
    await dispose();

    throw error;
  }
};
