import type { FillSource, FixtureFormat } from '@fixture-automation/fixture-studio-api/contract';

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

/** How a highlighted value ends up: broken in the existing fixture, or filled by AI, by the schema sampler, or not at all. */
export type FixOutcome = FillSource | 'broken';

/** What was wrong with a highlighted value before the fix. */
export type FixOrigin = 'broken' | 'missing';

/** A fixture path to highlight, in the diff's dotted form or as a JSON pointer. */
export type PathHighlight = {
  readonly path: string;
  readonly origin: FixOrigin;
  readonly outcome: FixOutcome;
};

/** The lines a highlighted value covers, by 1-based line numbers, and the text its tooltip reads. */
export type LineHighlight = {
  readonly from: number;
  readonly to: number;
  readonly origin: FixOrigin;
  readonly outcome: FixOutcome;
  readonly label: string;
};
