import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatRadioGroupHarness } from '@angular/material/radio/testing';

import type { BrokenValue, DiffResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MissingValuesPanel } from './missing-values-panel.ts';
import { provideHttpStudioEngine } from '../../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import { DIFF_RESULT_STUB, FIXTURE_VIEW_STUB, LOADED_SPEC_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp } from '../../../test/utils/studio-http.spec.util.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';
import { provideFixtureWorkbench } from '../../../workbench/domain-logic/fixture-workbench.provider.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const BROKEN_MEMO: BrokenValue = { path: 'memo', value: 'string', reason: 'openapi-sampler placeholder' };
const WITH_BROKEN: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: ['status', 'memo'], replacedPaths: ['memo'], broken: [BROKEN_MEMO] };
const NOTHING_MISSING: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: [] };

describe('FEATURE: MissingValuesPanel', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<MissingValuesPanel>;
  let loader: HarnessLoader;

  const render = async (result: DiffResult): Promise<void> => {
    fixture.componentRef.setInput('result', result);
    await fixture.whenStable();
  };

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE, provideFixtureWorkbench());
    TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, LOADED_SPEC_STUB);
    await TestBed.inject(FixtureComparison).readFile(new File(['{"id":"in_1","memo":"string"}'], 'invoice.json'));

    fixture = TestBed.createComponent(MissingValuesPanel);
    fixture.componentRef.setInput('view', FIXTURE_VIEW_STUB);
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  afterEach((): void => {
    http.verify();
  });

  describe('GIVEN a diff with an absent path and a broken value', (): void => {
    beforeEach(async (): Promise<void> => {
      await render(WITH_BROKEN);
    });

    it('WHEN rendered THEN lists the absent path as missing and the broken value apart', (): void => {
      expect(textsAt(fixture, '.missing__path')).toStrictEqual(['status']);
      expect(textsAt(fixture, '.broken__path')).toStrictEqual(['memo']);
    });

    it('WHEN rendered THEN offers to fix the broken values, chosen by default, and says the sampler already fixes them', async (): Promise<void> => {
      const choice = await loader.getHarness(MatRadioGroupHarness);

      expect(await choice.getCheckedValue()).toBe('fix');
      expect(textAt(fixture, '.missing-step__note')).toContain('Fixing needs no AI');
    });

    it('WHEN broken values are kept THEN diffs again without refilling them', (): void => {
      requiredElement(fixture, 'mat-radio-button:last-of-type input').click();
      TestBed.tick();
      const request = http.expectOne('/api/specs/spec-1/diff');

      expect(request.request.body).toMatchObject({ replacePlaceholders: false });
      request.flush(WITH_BROKEN);
    });

    it('WHEN Continue to AI fill is pressed THEN tells the steps to move on, counting every value to fill', (): void => {
      const continued = vi.fn();

      fixture.componentInstance.continued.subscribe(continued);
      requiredElement(fixture, '.missing-step__actions button').click();

      expect(textAt(fixture, '.missing-step__count')).toBe('2 values to fill');
      expect(continued).toHaveBeenCalledTimes(1);
    });
  });

  it('GIVEN a diff without broken values WHEN rendered THEN offers no choice about them', async (): Promise<void> => {
    await render(DIFF_RESULT_STUB);

    expect(hostOf(fixture).querySelector('mat-radio-group')).toBeNull();
    expect(textAt(fixture, '.missing-step__count')).toBe('1 value to fill');
  });

  it('GIVEN nothing to fill WHEN rendered THEN says so instead of offering AI fill', async (): Promise<void> => {
    await render(NOTHING_MISSING);

    expect(hostOf(fixture).querySelector('.missing-step__actions button')).toBeNull();
    expect(textAt(fixture, '.missing-step__done')).toContain('Nothing to fill');
  });
});
