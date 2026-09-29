import { describe, expect, it } from 'vitest';

import { jsonDocument } from './json-document.util.ts';
import type { FixtureDocument } from '../common/document-view.type.ts';

describe('FEATURE: result documents', (): void => {
  it('GIVEN a label, file name and content WHEN built THEN is a JSON document', (): void => {
    const expected: FixtureDocument = {
      format: 'json',
      label: 'Merged fixture',
      fileName: 'invoice.json',
      content: '{}',
      language: 'json'
    };

    expect(jsonDocument('Merged fixture', 'invoice.json', '{}')).toStrictEqual(expected);
  });
});
