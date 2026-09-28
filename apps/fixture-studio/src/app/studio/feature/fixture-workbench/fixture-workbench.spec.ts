import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FixtureWorkbench } from './fixture-workbench.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { DIFF_RESULT_STUB, FIXTURE_VIEW_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { textAt } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

/** Compares a fixture in the workbench's own compare state, the API answering with `missingPaths`. */
const compareFinding = async (
  http: HttpTestingController,
  fixture: ComponentFixture<FixtureWorkbench>,
  missingPaths: string[]
): Promise<void> => {
  const comparison = fixture.debugElement.injector.get(FixtureComparison);

  TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
  await answerSpecLoad(http, LOADED_SPEC_STUB);
  await comparison.readFile(new File(['{"id":"in_1"}'], 'invoice.json'));
  comparison.compare(FIXTURE_VIEW_STUB.endpointId);
  TestBed.tick();
  http.expectOne('/api/specs/spec-1/diff').flush({ ...DIFF_RESULT_STUB, missingPaths });
  await settle();
};

describe('FEATURE: FixtureWorkbench', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<FixtureWorkbench>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE);
    fixture = TestBed.createComponent(FixtureWorkbench);
    fixture.componentRef.setInput('view', FIXTURE_VIEW_STUB);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN generated documents WHEN rendered THEN offers them, then Compare and AI fill', async (): Promise<void> => {
    const group = await loader.getHarness(MatTabGroupHarness.with({ selector: '.workbench__tabs' }));
    const tabs = await group.getTabs();
    const labels = await Promise.all(tabs.map(async (tab) => tab.getLabel()));

    expect(labels).toStrictEqual(['JSON fixture', 'Compare', 'AI fill · compare first']);
  });

  it('GIVEN no compare yet WHEN rendered THEN keeps AI fill disabled and says to compare first', async (): Promise<void> => {
    const group = await loader.getHarness(MatTabGroupHarness.with({ selector: '.workbench__tabs' }));
    const [aiFill] = await group.getTabs({ label: /^AI fill/u });

    expect(await aiFill?.isDisabled()).toBe(true);
    expect(textAt(fixture, '.workbench__tab-hint')).toBe('· compare first');
  });

  it('GIVEN a compare that found nothing missing WHEN rendered THEN says there is nothing to fill', async (): Promise<void> => {
    await compareFinding(http, fixture, []);
    fixture.detectChanges();

    expect(textAt(fixture, '.workbench__tab-hint')).toBe('· nothing missing');
  });

  it('GIVEN a compare that found missing paths WHEN rendered THEN opens AI fill without a hint', async (): Promise<void> => {
    await compareFinding(http, fixture, DIFF_RESULT_STUB.missingPaths);
    const group = await loader.getHarness(MatTabGroupHarness.with({ selector: '.workbench__tabs' }));
    const [aiFill] = await group.getTabs({ label: 'AI fill' });

    expect(await aiFill?.isDisabled()).toBe(false);
  });
});
