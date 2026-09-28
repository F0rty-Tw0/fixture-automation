import type { DiffBody } from '@fixture-automation/fixture-studio-api/contract';

/** An existing fixture, read and parsed locally in the browser; the file itself is never sent. */
export type ExistingFixture = {
  readonly name: string;
  readonly value: unknown;
  /** `value` as 2-space JSON, the left side of the compare view. */
  readonly pretty: string;
};

type LiteralRead = {
  readonly kind: 'value';
  readonly value: unknown;
};

type LiteralRejected = {
  readonly kind: 'error';
  readonly message: string;
};

/** Outcome of reading a fixture's text as JSON or as a TypeScript literal. */
export type LiteralParse = LiteralRead | LiteralRejected;

/** Model of the compare form. */
export type CompareForm = {
  readonly pasted: string;
  /** Envelope property holding the payload, e.g. `data`; empty when the fixture is the payload. Detected on read. */
  readonly objectShape: string;
  /** Also refill present values that break the schema or are openapi-sampler defaults. */
  readonly replacePlaceholders: boolean;
};

export type DiffRequest = {
  readonly specId: string;
  readonly body: DiffBody;
};
