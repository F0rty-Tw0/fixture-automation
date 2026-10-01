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

/** A line equal in both documents of a diff, by its 0-based index in each. */
export type LineAnchor = {
  readonly a: number;
  readonly b: number;
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

/**
 * A fixture path to highlight, in the diff's dotted form or as a JSON pointer. A broken value says why (`must be
 * string`) and what the fixture held (`0`), so its tooltip explains a mark that the value alone does not.
 */
export type PathHighlight = {
  readonly path: string;
  readonly origin: FixOrigin;
  readonly outcome: FixOutcome;
  readonly reason?: string;
  readonly found?: string;
};

/** The lines a highlighted value covers, by 1-based line numbers, and the text its tooltip reads. */
export type LineHighlight = {
  readonly from: number;
  readonly to: number;
  readonly origin: FixOrigin;
  readonly outcome: FixOutcome;
  readonly label: string;
  readonly reason?: string;
  readonly found?: string;
};
