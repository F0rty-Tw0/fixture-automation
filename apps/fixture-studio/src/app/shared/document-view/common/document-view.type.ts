import type { Signal } from '@angular/core';

import type { FillSource, FixtureFormat, FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';

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

/** The lines between two anchors in either document of a diff, by their line codes and the index they start at. */
export type LineGap = {
  readonly fromA: number;
  readonly fromB: number;
  readonly codesA: string;
  readonly codesB: string;
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

/** Names an export the way the CLI merge names its file; the studio binds it to the API. */
export type ExportNaming = {
  /** The subdirectory this viewer used last, `''` for none. */
  readonly subdirectory: Signal<string>;
  rememberSubdirectory(subdirectory: string): void;
  /** The hashed file name the CLI merge writes for the query; rejects when the API refuses it. */
  fileName(query: FixtureNameQuery, abortSignal: AbortSignal): Promise<string>;
};

/** An endpoint whose final fixture can be exported under the CLI merge's hashed file name instead of its plain one. */
export type HashedExport = {
  readonly method: string;
  /** The OpenAPI path template (`/v1/invoices/{id}`), prefilled as the URL the user makes concrete. */
  readonly path: string;
  readonly naming: ExportNaming;
};
