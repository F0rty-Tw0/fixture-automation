import type { GenerateBody } from '@fixture-automation/fixture-studio-api/contract';

import type { CodeLanguage, FixtureDocument } from '../../shared/document-view/common/document-view.type.ts';

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

export type FixtureFormatMeta = {
  readonly label: string;
  readonly extension: string;
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
