import type { CompareForm } from './comparison.type.ts';

export const DEFAULT_COMPARE_FORM: CompareForm = {
  pasted: '',
  objectShape: '',
  replacePlaceholders: true
};

/** Source name shown for text pasted instead of a file. */
export const PASTED_SOURCE_NAME = 'Pasted text';
