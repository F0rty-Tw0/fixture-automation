import type { FixtureDocument } from '../common/document-view.type.ts';

/** A JSON document shown in the workbench that was not generated from the schema (compare and fill results). */
export const jsonDocument = (label: string, fileName: string, content: string): FixtureDocument => {
  const document: FixtureDocument = { format: 'json', label, fileName, content, language: 'json' };

  return document;
};
