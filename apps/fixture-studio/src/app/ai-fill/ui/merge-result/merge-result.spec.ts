import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { MergeResult } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { MergeResultView } from './merge-result.ts';
import type { HashedExport } from '../../../shared/document-view/common/document-view.type.ts';
import { exportNamingMock } from '../../../shared/document-view/test/mocks/export-naming.mock.ts';
import { MERGE_RESULT_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import type { FilledPath } from '../../../workbench/common/ai-fill.type.ts';

const FILLED: FilledPath[] = [{ path: 'status', source: 'ai' }];
const INVALID: MergeResult = { ...MERGE_RESULT_STUB, valid: false, errors: ['/status: must be one of draft, open'] };

describe('FEATURE: MergeResultView', (): void => {
  let fixture: ComponentFixture<MergeResultView>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(MergeResultView);
    fixture.componentRef.setInput('fileName', 'invoice.json');
    fixture.componentRef.setInput('filledPaths', FILLED);
  });

  describe('GIVEN a valid merge', (): void => {
    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('merge', MERGE_RESULT_STUB);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN is a region that says it is valid and how many values it filled', (): void => {
      expect(hostOf(fixture).getAttribute('aria-label')).toBe('Merge result');
      expect(textAt(fixture, '.merge__badge')).toBe('Valid against the schema · 1 values filled');
    });

    it('WHEN rendered THEN lists where each value came from and offers the merged fixture', (): void => {
      expect(textsAt(fixture, '.sources__source')).toStrictEqual(['Filled by AI']);
      expect(textAt(fixture, '.merge__section-title')).toBe('Merged fixture');
      expect(textAt(fixture, '.bar__file')).toBe('invoice.json');
    });
  });

  it('GIVEN an invalid merge WHEN rendered THEN lists its schema errors', async (): Promise<void> => {
    fixture.componentRef.setInput('merge', INVALID);

    await fixture.whenStable();

    expect(textAt(fixture, '.merge__badge')).toBe('1 schema errors');
    expect(textsAt(fixture, '.merge__error')).toStrictEqual(['/status: must be one of draft, open']);
  });

  it('GIVEN a hashed export WHEN rendered THEN the file bar offers the hashed name', async (): Promise<void> => {
    const hashedExport: HashedExport = { method: 'GET', path: '/v1/invoices', naming: exportNamingMock() };

    fixture.componentRef.setInput('merge', MERGE_RESULT_STUB);
    fixture.componentRef.setInput('hashedExport', hashedExport);

    await fixture.whenStable();

    expect(hostOf(fixture).querySelector('fs-copy-export-bar mat-slide-toggle')).not.toBeNull();
  });

  it('GIVEN no filled paths WHEN rendered THEN leaves out the source list', async (): Promise<void> => {
    fixture.componentRef.setInput('merge', MERGE_RESULT_STUB);
    fixture.componentRef.setInput('filledPaths', []);

    await fixture.whenStable();

    expect(hostOf(fixture).querySelector('fs-fill-source-list')).toBeNull();
  });
});
