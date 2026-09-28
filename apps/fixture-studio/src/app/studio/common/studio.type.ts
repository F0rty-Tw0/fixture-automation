import type { Endpoint, FixtureFormat, GenerateBody } from '@fixture-automation/fixture-studio-api/contract';

/** Model of the spec URL form. */
export type SpecSource = {
  readonly url: string;
};

/** Filter over the loaded endpoints; an empty string means "any". */
export type EndpointFilter = {
  readonly query: string;
  readonly tag: string;
  readonly method: string;
};

/** Generation choices; each format flag maps to one `FixtureFormat`. */
export type GenerateOptions = {
  readonly json: boolean;
  readonly stub: boolean;
  readonly types: boolean;
  readonly requiredOnly: boolean;
};

export type GenerateRequest = {
  readonly specId: string;
  readonly body: GenerateBody;
};

export type EndpointGroup = {
  readonly tag: string;
  readonly endpoints: Endpoint[];
};

export type CodeLanguage = 'json' | 'typescript';

export type FixtureFormatMeta = {
  readonly label: string;
  readonly extension: string;
  readonly language: CodeLanguage;
};

/** One generated source, ready for display and export. */
export type FixtureDocument = {
  readonly format: FixtureFormat;
  readonly label: string;
  readonly fileName: string;
  readonly content: string;
  readonly language: CodeLanguage;
};

/** One workspace tab: an endpoint and its generated documents. */
export type FixtureView = {
  readonly endpointId: string;
  readonly method: string;
  readonly path: string;
  readonly schemaName: string;
  readonly documents: FixtureDocument[];
};

type RecoveryHint = {
  /** How the user can recover, when the engine knows. */
  readonly fix: string | undefined;
};

/** How a `StudioEngine` rejects: a user-facing message, a recovery hint, and the original failure as `cause`. */
export type StudioEngineFailure = Error & RecoveryHint;

type SpecDocumentParsed = {
  readonly kind: 'document';
  readonly document: Record<string, unknown>;
};

type SpecDocumentRejected = {
  readonly kind: 'error';
  readonly message: string;
};

/** Outcome of reading a dropped spec file. */
export type SpecDocumentParse = SpecDocumentParsed | SpecDocumentRejected;

/** Where a step sits on the pipeline rail. */
export type StepState = 'pending' | 'active' | 'done';

/** Rail state of the three studio steps. */
export type StudioSteps = {
  readonly spec: StepState;
  readonly endpoints: StepState;
  readonly workspace: StepState;
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

/** Fixture paths that share their first segment, e.g. every missing path under `customer`. */
export type PathGroup = {
  readonly root: string;
  readonly paths: string[];
};
