import { join, resolve } from 'node:path';
import { styleText } from 'node:util';

import { aiMissingFixture, discoverModels } from '@fixture-automation/openapi-ai-fixtures';
import { HTTP_METHODS, endpointUrlInput, isHttpMethod, mergeFixture } from '@fixture-automation/openapi-fixture-merge';
import type { MergeInput, MergeSpec } from '@fixture-automation/openapi-fixture-merge';
import { FixtureError, loadSpec, terminalQuestion } from '@fixture-automation/openapi-fixtures';
import type { Inputs, OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { choose } from './choose.client.ts';
import { diffExisting } from './diff.client.ts';
import { fillMissing } from './fill.client.ts';
import { generateFiles } from './generate.client.ts';
import { DEFAULT_OUT_DIR, FORMATS, WIZARD_INPUTS, WIZARD_USAGE } from '../common/wizard.const.ts';
import type { DiffResult, WizardContext, WizardDeps } from '../common/wizard.type.ts';
import { resolveTarget } from '../utils/route-schema.util.ts';

const MISSING_DIR = 'missing';

const defaultDeps: WizardDeps = { question: terminalQuestion, discover: discoverModels, fill: aiMissingFixture };

const mergeFilled = async (context: WizardContext, populatedFile: string): Promise<string[]> => {
  const { fixtureFile, inputs, objectShape, outDir, schemaName, specUrl } = context;
  const endpointUrl = await endpointUrlInput(inputs, undefined, WIZARD_USAGE);
  const subdirectory = await inputs.optional(undefined, WIZARD_INPUTS.subdirectory);
  const spec: MergeSpec = { url: specUrl, schemaName };
  const input: MergeInput = { corruptFile: fixtureFile, populatedFile, outDir, endpointUrl, objectShape, subdirectory, spec };
  const result = await mergeFixture(input);
  const mergedFiles = [result.outFile, result.provenanceFile];

  return mergedFiles;
};

/** After the diff found missing fields: fill with a harness, then merge, each behind a y/N. */
const fillAndMerge = async (context: WizardContext, diffed: DiffResult): Promise<string[]> => {
  const { inputs } = context;
  const missingFiles = [diffed.jsonFile, diffed.typesFile, diffed.stubFile];
  const wantsAi = await inputs.flag(undefined, WIZARD_INPUTS.fillWithAi);

  if (!wantsAi) return missingFiles;

  const populatedFile = await fillMissing(context, diffed);
  const wantsMerge = await inputs.flag(undefined, WIZARD_INPUTS.merge);

  if (!wantsMerge) return [...missingFiles, populatedFile];

  const mergedFiles = await mergeFilled(context, populatedFile);

  return [...missingFiles, populatedFile, ...mergedFiles];
};

const checkExisting = async (context: WizardContext): Promise<string[]> => {
  const { inputs, spec, schemaName, outDir, fixtureFile, objectShape } = context;
  const requiredOnly = await inputs.flag(undefined, WIZARD_INPUTS.requiredOnly);
  const missingDir = join(outDir, MISSING_DIR);
  const diffed = await diffExisting({ spec, schemaName, fixtureFile, outDir: missingDir, requiredOnly, objectShape });

  if (diffed === undefined) {
    console.error(styleText('green', 'no missing fields', { stream: process.stderr }));

    return [];
  }

  console.error(
    styleText('yellow', `${diffed.diff.paths.length} missing field(s): ${diffed.diff.paths.join(', ')}`, { stream: process.stderr })
  );

  return fillAndMerge(context, diffed);
};

/** A route (`method` then `target-url`) resolved to its response schema, or a bare `schema-name` when the method is skipped. */
const askSchemaName = async (inputs: Inputs, spec: OpenApiSpec): Promise<string> => {
  const method = await inputs.optional(undefined, WIZARD_INPUTS.method);

  if (method === undefined) {
    const declaredName = await inputs.required(undefined, WIZARD_INPUTS.schemaName, WIZARD_USAGE);

    return resolveTarget(spec, undefined, declaredName);
  }

  const isKnownMethod = isHttpMethod(method);

  if (!isKnownMethod) {
    throw new FixtureError(`unknown HTTP method: ${method}`, `use one of ${HTTP_METHODS.join(', ')}, or Enter for a schema name`);
  }

  const targetUrl = await inputs.required(undefined, WIZARD_INPUTS.targetUrl, WIZARD_USAGE);
  const schemaName = resolveTarget(spec, method, targetUrl);

  return schemaName;
};

const runSteps = async (inputs: Inputs, deps: WizardDeps): Promise<string[]> => {
  const specUrl = await inputs.required(undefined, WIZARD_INPUTS.specUrl, WIZARD_USAGE);
  const outDirAnswer = await inputs.optional(undefined, WIZARD_INPUTS.outDir);
  const outDir = resolve(outDirAnswer ?? DEFAULT_OUT_DIR);
  const spec = await loadSpec(specUrl);
  const schemaName = await askSchemaName(inputs, spec);
  const format = await choose(deps.question, WIZARD_INPUTS.format, FORMATS);
  const generated = await generateFiles({ spec, schemaName, outDir, format });
  const fixtureFile = await inputs.optional(undefined, WIZARD_INPUTS.existingFixture);

  if (fixtureFile === undefined) return generated;

  const objectShape = await inputs.optional(undefined, WIZARD_INPUTS.objectShape);
  const context: WizardContext = { inputs, deps, specUrl, spec, schemaName, outDir, fixtureFile, objectShape };
  const checked = await checkExisting(context);

  return [...generated, ...checked];
};

/** Ask every prompt in turn, run the steps the answers select, and list each written file on stderr. */
export const runWizard = async (inputs: Inputs, deps: WizardDeps = defaultDeps): Promise<void> => {
  const written = await runSteps(inputs, deps);

  for (const file of written) console.error(styleText('green', `wrote ${file}`, { stream: process.stderr }));
};
