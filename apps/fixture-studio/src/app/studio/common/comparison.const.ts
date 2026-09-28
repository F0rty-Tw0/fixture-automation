import type { EnvelopeResult } from '@fixture-automation/fixture-studio-api/contract';

import type { CompareForm } from './comparison.type.ts';

export const DEFAULT_COMPARE_FORM: CompareForm = {
  pasted: '',
  objectShape: '',
  replacePlaceholders: true
};

/** Source name shown for text pasted instead of a file. */
export const PASTED_SOURCE_NAME = 'Pasted text';

/** What an envelope detection that failed or found nothing offers: compare the fixture as the payload. */
export const NO_ENVELOPE: EnvelopeResult = { candidates: [], detected: undefined };
