import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { Endpoint, GenerateResult, GeneratedFixture, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StudioPage } from './studio-page.ts';
import { provideHttpStudioEngine } from '../../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { FixtureGeneration } from '../../../spec/domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import { scrollIntoViewMock } from '../../../test/mocks/browser.mock.ts';
import { ENDPOINT_STUB, GENERATED_FIXTURE_STUB, LOADED_SPEC_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf } from '../../../test/utils/fixture-dom.spec.util.ts';
import { answerGenerate, answerSpecLoad, configureStudioHttp } from '../../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const SECOND: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST' };
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [ENDPOINT_STUB, SECOND] };
const SECOND_FIXTURE: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, endpointId: SECOND.id };
const ONE_FIXTURE: GenerateResult = { fixtures: [GENERATED_FIXTURE_STUB] };
const TWO_FIXTURES: GenerateResult = { fixtures: [GENERATED_FIXTURE_STUB, SECOND_FIXTURE] };

type StepSnapshot = {
  readonly state: string | undefined;
  readonly status: string;
};

/** The steps on screen: every generated endpoint has its own last three, but only the chosen one shows. */
const stepSnapshots = (fixture: ComponentFixture<StudioPage>): StepSnapshot[] => {
  const matches = hostOf(fixture).querySelectorAll<HTMLElement>('fs-studio-step');
  const isShown = (step: HTMLElement): boolean => step.closest('[hidden]') === null;
  const all = [...matches];
  const steps = all.filter(isShown);

  const snapshotOf = (step: HTMLElement): StepSnapshot => {
    const status = step.querySelector('.step__status')?.textContent ?? '';
    const snapshot: StepSnapshot = { state: step.dataset['state'], status };

    return snapshot;
  };

  return steps.map(snapshotOf);
};

describe('FEATURE: StudioPage', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<StudioPage>;

  beforeEach(async (): Promise<void> => {
    scrollIntoViewMock();
    http = configureStudioHttp(STUDIO_ENGINE);
    fixture = TestBed.createComponent(StudioPage);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN a fresh studio WHEN rendered THEN only the spec step is active, and all six steps wait on it', (): void => {
    const host = hostOf(fixture);

    expect(stepSnapshots(fixture)).toStrictEqual([
      { state: 'active', status: 'URL or JSON file' },
      { state: 'pending', status: 'Waiting for a spec' },
      { state: 'pending', status: 'Waiting for fixtures' },
      { state: 'pending', status: 'Waiting for fixtures' },
      { state: 'pending', status: 'Waiting for a compare' },
      { state: 'pending', status: 'Waiting for missing values' }
    ]);
    expect(host.querySelector('.rail__waiting')).not.toBeNull();
  });

  describe('GIVEN a spec being loaded', (): void => {
    beforeEach((): void => {
      TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    });

    it('WHEN in flight THEN the spec step says it is loading', (): void => {
      TestBed.tick();
      const request = http.expectOne('/api/specs');

      fixture.detectChanges();

      expect(stepSnapshots(fixture)[0]?.status).toBe('Loading…');
      request.flush(SPEC);
    });

    it('WHEN loaded THEN the endpoints step is active and the masthead names the spec', async (): Promise<void> => {
      await answerSpecLoad(http, SPEC);
      await fixture.whenStable();
      const host = hostOf(fixture);

      expect(stepSnapshots(fixture)[1]).toStrictEqual({ state: 'active', status: '0 of 2 selected' });
      expect(host.querySelector('.masthead__spec')?.textContent).toContain('Billing API');
    });
  });

  describe.each([
    [ONE_FIXTURE, '1 endpoint generated'],
    [TWO_FIXTURES, '2 endpoints generated']
  ])('GIVEN generated fixtures', (result, status): void => {
    it(`WHEN ${result.fixtures.length} arrive THEN generate is done, reading "${status}", and the first endpoint's compare is active`, async (): Promise<void> => {
      const browser = TestBed.inject(SpecBrowser);

      browser.loadUrl('https://example.com/openapi.json');
      await answerSpecLoad(http, SPEC);
      browser.toggleAllVisible();
      TestBed.inject(FixtureGeneration).generate();
      await answerGenerate(http, 'spec-1', result);
      await fixture.whenStable();

      const steps = stepSnapshots(fixture);

      expect(steps).toHaveLength(6);
      expect(steps[2]).toStrictEqual({ state: 'done', status });
      expect(steps[3]).toStrictEqual({ state: 'active', status: 'GET /v1/invoices' });
    });
  });

  it('GIVEN two generated endpoints WHEN the second is chosen THEN the last three steps follow it', async (): Promise<void> => {
    const browser = TestBed.inject(SpecBrowser);
    const generation = TestBed.inject(FixtureGeneration);

    browser.loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, SPEC);
    browser.toggleAllVisible();
    generation.generate();
    await answerGenerate(http, 'spec-1', TWO_FIXTURES);
    generation.selectEndpoint(SECOND.id);
    await fixture.whenStable();

    expect(stepSnapshots(fixture)[3]?.status).toBe('POST /v1/invoices');
  });
});
