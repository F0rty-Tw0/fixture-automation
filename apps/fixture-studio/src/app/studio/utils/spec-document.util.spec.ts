import { describe, expect, it } from 'vitest';

import { parseSpecDocument } from './spec-document.util.ts';
import type { SpecDocumentParse } from '../common/studio.type.ts';

describe('FEATURE: dropped spec parsing', (): void => {
  it('GIVEN a JSON object WHEN parsed THEN returns it as the document', (): void => {
    const document = { openapi: '3.1.0' };
    const expected: SpecDocumentParse = { kind: 'document', document };

    expect(parseSpecDocument('{"openapi":"3.1.0"}', 'api.json')).toStrictEqual(expected);
  });

  it('GIVEN text that is not JSON WHEN parsed THEN names the file in the error', (): void => {
    const expected: SpecDocumentParse = { kind: 'error', message: 'api.yaml is not valid JSON.' };

    expect(parseSpecDocument('openapi: 3.1.0', 'api.yaml')).toStrictEqual(expected);
  });

  it('GIVEN a JSON array WHEN parsed THEN asks for an object', (): void => {
    const expected: SpecDocumentParse = { kind: 'error', message: 'list.json must hold a JSON object (an OpenAPI document).' };

    expect(parseSpecDocument('[1,2]', 'list.json')).toStrictEqual(expected);
  });
});
