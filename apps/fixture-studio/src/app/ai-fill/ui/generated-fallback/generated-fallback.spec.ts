import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { GeneratedFallback } from './generated-fallback.ts';
import type { HashedExport } from '../../../shared/document-view/common/document-view.type.ts';
import { exportNamingMock } from '../../../shared/document-view/test/mocks/export-naming.mock.ts';
import { jsonDocument } from '../../../shared/document-view/utils/json-document.util.ts';
import { DIFF_RESULT_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: GeneratedFallback', (): void => {
  let fixture: ComponentFixture<GeneratedFallback>;

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(GeneratedFallback);
    fixture.componentRef.setInput(
      'document',
      jsonDocument('Generated from the schema', 'invoice.json', DIFF_RESULT_STUB.completeJson)
    );
    await fixture.whenStable();
  });

  it('GIVEN the schema-complete fixture WHEN rendered THEN is a region named for the fallback', (): void => {
    expect(hostOf(fixture).getAttribute('aria-label')).toBe('Generated fallback');
  });

  it('GIVEN the schema-complete fixture WHEN rendered THEN says why it stands in and offers it for export', (): void => {
    expect(textAt(fixture, '.fallback__text')).toContain('The AI fill did not finish');
    expect(textAt(fixture, '.fallback__title')).toBe('Generated from the schema');
    expect(textAt(fixture, '.bar__file')).toBe('invoice.json');
  });

  it('GIVEN no compare warnings WHEN rendered THEN shows no warning notice', (): void => {
    expect(hostOf(fixture).querySelector('fs-notice-list')).toBeNull();
  });

  it('GIVEN a hashed export WHEN rendered THEN the file bar offers the hashed name', async (): Promise<void> => {
    const hashedExport: HashedExport = { method: 'GET', path: '/v1/invoices', naming: exportNamingMock() };

    fixture.componentRef.setInput('hashedExport', hashedExport);

    await fixture.whenStable();

    expect(hostOf(fixture).querySelector('fs-copy-export-bar mat-slide-toggle')).not.toBeNull();
  });

  describe('GIVEN compare warnings', (): void => {
    const WARNINGS = ['The fixture has no "data" property, so the whole fixture was compared instead.'];

    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('warnings', WARNINGS);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN does not promise every value was fixed', (): void => {
      expect(textAt(fixture, '.fallback__text')).not.toContain('ready to export');
      expect(textAt(fixture, '.fallback__text')).toContain('some values may still be missing or broken');
    });

    it('WHEN rendered THEN lists the warnings', (): void => {
      expect(textsAt(fixture, '.notices__lines li')).toStrictEqual(WARNINGS);
    });
  });
});
