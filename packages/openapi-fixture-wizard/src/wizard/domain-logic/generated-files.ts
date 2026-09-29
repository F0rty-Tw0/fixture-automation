import { join, resolve } from 'node:path';

import { fixtures, pruneSpec, typescriptImport, typescriptStub, writeTextFile } from '@fixture-automation/openapi-fixtures';
import { generateTypes } from '@fixture-automation/openapi-types';

import type { GenerateRequest } from '../common/wizard.type.ts';

/** `<schema>.spec.json` (pruned, carrying `x-root-schema`) and `<schema>.d.ts`, as `openapi-types` writes them. */
const writeTypes = async (request: GenerateRequest): Promise<string[]> => {
  const { spec, schemaName, outDir } = request;
  const pruned = pruneSpec(spec, schemaName);
  const types = await generateTypes(pruned);
  const specFile = join(outDir, `${schemaName}.spec.json`);
  const typesFile = join(outDir, `${schemaName}.d.ts`);

  await writeTextFile(specFile, `${JSON.stringify(pruned, null, 2)}\n`);
  await writeTextFile(typesFile, types);

  return [specFile, typesFile];
};

const writeStub = async (request: GenerateRequest, json: string): Promise<string> => {
  const { schemaName, outDir } = request;
  const stubFile = join(outDir, `${schemaName}.fixture.ts`);
  const typesFile = join(outDir, `${schemaName}.d.ts`);
  const typesImport = typescriptImport(resolve(stubFile), resolve(typesFile));

  await writeTextFile(stubFile, typescriptStub(schemaName, typesImport, json));

  return stubFile;
};

/** Write the generated files the chosen format asks for and return their paths in write order. */
export const generateFiles = async (request: GenerateRequest): Promise<string[]> => {
  const { spec, schemaName, outDir, format } = request;
  const wantsTypes = format !== 'json';
  const wantsJson = format !== 'ts';
  const fixture = fixtures(spec)(schemaName);
  const json = JSON.stringify(fixture, null, 2);
  const written: string[] = [];

  if (wantsTypes) {
    const typeFiles = await writeTypes(request);

    written.push(...typeFiles);
  }

  if (wantsJson) {
    const jsonFile = join(outDir, `${schemaName}.fixture.json`);

    await writeTextFile(jsonFile, `${json}\n`);
    written.push(jsonFile);
  }

  if (wantsTypes) {
    const stubFile = await writeStub(request, json);

    written.push(stubFile);
  }

  return written;
};
