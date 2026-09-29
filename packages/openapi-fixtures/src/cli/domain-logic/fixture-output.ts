import { fixtures } from '../../fixture-sampling/data-access/fixtures.client.ts';
import type { OpenApiSpec } from '../../shared/openapi-document/common/openapi.type.ts';
import { writeTextFile } from '../../text-file/data-access/json-file.client.ts';
import { typescriptStub } from '../../typescript-stub/utils/typescript-stub.util.ts';

/** The sampled fixture as JSON, or as a typed `.ts` stub when a types import is given. */
export const fixtureOutput = (
  spec: OpenApiSpec,
  schemaName: string,
  requiredOnly: boolean,
  typesImport: string | undefined
): string => {
  const sampleOptions = { skipNonRequired: requiredOnly };
  const fixture = fixtures(spec, sampleOptions)(schemaName);
  const json = JSON.stringify(fixture, null, 2);
  let output = `${json}\n`;

  if (typesImport !== undefined) output = typescriptStub(schemaName, typesImport, json);

  return output;
};

/** Write the fixture to `outFile`, or to stdout when no destination was given. */
export const writeFixtureOutput = async (outFile: string | undefined, output: string): Promise<void> => {
  if (outFile !== undefined && outFile !== '') {
    await writeTextFile(outFile, output);

    return;
  }

  process.stdout.write(output);
};
