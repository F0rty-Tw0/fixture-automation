import type { FixtureFormat } from '@fixture-automation/fixture-studio-api/contract';

export type CodeLanguage = 'json' | 'typescript';

/** One generated source, ready for display and export. */
export type FixtureDocument = {
  readonly format: FixtureFormat;
  readonly label: string;
  readonly fileName: string;
  readonly content: string;
  readonly language: CodeLanguage;
};

/** A changed range of a document, by 1-based line numbers, both ends included. */
export type ChangedLines = {
  readonly from: number;
  readonly to: number;
};

/** One change on the overview ruler beside a diff: its offset and size as percentages of the document, and its first line. */
export type ChangeMark = {
  readonly top: number;
  readonly height: number;
  readonly line: number;
};
