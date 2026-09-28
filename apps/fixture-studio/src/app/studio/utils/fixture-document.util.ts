import type { FixtureFormat, GeneratedFixture } from '@fixture-automation/fixture-studio-api/contract';

import { FIXTURE_FORMAT_META, FIXTURE_FORMAT_ORDER } from '../common/studio.const.ts';
import type { FixtureDocument, FixtureView, GenerateOptions } from '../common/studio.type.ts';

export const fixtureFormats = (options: GenerateOptions): FixtureFormat[] => {
  return FIXTURE_FORMAT_ORDER.filter((format) => options[format]);
};

const documentsOf = (fixture: GeneratedFixture): FixtureDocument[] => {
  const documents: FixtureDocument[] = [];

  for (const format of FIXTURE_FORMAT_ORDER) {
    const content = fixture[format];
    const meta = FIXTURE_FORMAT_META[format];

    if (content === undefined) continue;

    const document: FixtureDocument = {
      format,
      label: meta.label,
      fileName: `${fixture.schemaName}${meta.extension}`,
      content,
      language: meta.language
    };

    documents.push(document);
  }

  return documents;
};

/** Splits an endpoint id (`METHOD /path`) into its parts. */
const viewOf = (fixture: GeneratedFixture): FixtureView => {
  const separator = fixture.endpointId.indexOf(' ');
  const method = fixture.endpointId.slice(0, separator);
  const path = fixture.endpointId.slice(separator + 1);
  const documents = documentsOf(fixture);
  const view: FixtureView = { endpointId: fixture.endpointId, method, path, schemaName: fixture.schemaName, documents };

  return view;
};

export const fixtureViews = (fixtures: GeneratedFixture[]): FixtureView[] => {
  return fixtures.map(viewOf);
};

/** A JSON document shown in the workbench that was not generated from the schema (compare and fill results). */
export const jsonDocument = (label: string, fileName: string, content: string): FixtureDocument => {
  const document: FixtureDocument = { format: 'json', label, fileName, content, language: 'json' };

  return document;
};
