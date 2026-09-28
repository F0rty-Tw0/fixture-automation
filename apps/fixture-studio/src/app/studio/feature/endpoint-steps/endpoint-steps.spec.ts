import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';

import type { Endpoint, GenerateResult, GeneratedFixture, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EndpointSteps } from './endpoint-steps.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { scrollIntoViewMock } from '../../test/mocks/browser.mock.ts';
import { CLI_TOOLS_RESULT_STUB, DIFF_RESULT_STUB, ENDPOINT_STUB, GENERATED_FIXTURE_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerGenerate, answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const CREATE_INVOICE: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST' };
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [ENDPOINT_STUB, CREATE_INVOICE] };
const CREATE_FIXTURE: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, endpointId: CREATE_INVOICE.id };
const RESULT: GenerateResult = { fixtures: [GENERATED_FIXTURE_STUB, CREATE_FIXTURE] };
const MODELS = { models: [], source: 'mock' };

type StepRow = {
  readonly state: string | undefined;
  readonly status: string;
};

describe('FEATURE: EndpointSteps', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<EndpointSteps>;
  let loader: HarnessLoader;
  let scrollIntoView: Mock<Element['scrollIntoView']>;

  const stepRows = (): StepRow[] => {
    const matches = hostOf(fixture).querySelectorAll<HTMLElement>('fs-studio-step');
    const steps = [...matches];

    const rowOf = (step: HTMLElement): StepRow => {
      const row: StepRow = { state: step.dataset['state'], status: step.querySelector('.step__status')?.textContent ?? '' };

      return row;
    };

    return steps.map(rowOf);
  };

  /** Answers the request the panel sends once its resources run. */
  const answer = async (url: string, body: object): Promise<void> => {
    const flush = (): void => {
      TestBed.tick();
      http.expectOne(url).flush(body);
    };

    await vi.waitFor(flush);
  };

  beforeEach(async (): Promise<void> => {
    scrollIntoView = scrollIntoViewMock();
    vi.stubGlobal('LanguageModel', undefined);
    http = configureStudioHttp(STUDIO_ENGINE);

    const browser = TestBed.inject(SpecBrowser);
    const generation = TestBed.inject(FixtureGeneration);

    browser.loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, SPEC);
    browser.toggleAllVisible();
    generation.generate();
    await answerGenerate(http, 'spec-1', RESULT);

    fixture = TestBed.createComponent(EndpointSteps);
    fixture.componentRef.setInput('view', generation.views()[0]);
    fixture.componentRef.setInput('index', 0);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
    vi.unstubAllGlobals();
  });

  describe('GIVEN the chosen endpoint before any compare', (): void => {
    it('WHEN rendered THEN shows compare active for its endpoint and the rest waiting', (): void => {
      expect(hostOf(fixture).hidden).toBe(false);
      expect(stepRows()).toStrictEqual([
        { state: 'active', status: 'GET /v1/invoices' },
        { state: 'pending', status: 'Waiting for a compare' },
        { state: 'pending', status: 'Waiting for missing values' }
      ]);
    });

    it('WHEN another endpoint is chosen THEN these steps hide, keeping their state', async (): Promise<void> => {
      TestBed.inject(FixtureGeneration).selectEndpoint(CREATE_INVOICE.id);
      await fixture.whenStable();

      expect(hostOf(fixture).hidden).toBe(true);
    });

    it('WHEN the endpoint switch picks another THEN that one becomes the chosen endpoint', async (): Promise<void> => {
      const endpoint = await loader.getHarness(MatSelectHarness);

      await endpoint.clickOptions({ text: 'POST /v1/invoices' });

      expect(TestBed.inject(FixtureGeneration).activeEndpointId()).toBe(CREATE_INVOICE.id);
    });
  });

  describe('GIVEN a compare that found a missing value', (): void => {
    beforeEach(async (): Promise<void> => {
      const comparison = fixture.debugElement.injector.get(FixtureComparison);

      await comparison.readFile(new File(['{"id":"in_1"}'], 'invoice.json'));
      comparison.compare(ENDPOINT_STUB.id);
      TestBed.tick();
      http.expectOne('/api/specs/spec-1/diff').flush(DIFF_RESULT_STUB);
      await settle();
      await fixture.whenStable();
    });

    it('WHEN rendered THEN the missing values step is active and AI fill still waits', (): void => {
      expect(stepRows().map((row) => row.state)).toStrictEqual(['done', 'active', 'pending']);
      expect(stepRows()[1]?.status).toBe('1 missing · 0 broken');
    });

    it('WHEN the user continues THEN AI fill opens and scrolls into view', async (): Promise<void> => {
      requiredElement(fixture, '.missing-step__actions button').click();
      await answer('/api/ai/cli/tools', CLI_TOOLS_RESULT_STUB);
      await answer('/api/ai/cli/models?tool=claude', MODELS);
      await fixture.whenStable();

      expect(stepRows().map((row) => row.state)).toStrictEqual(['done', 'done', 'active']);
      expect(hostOf(fixture).querySelector('fs-ai-fill-panel')).not.toBeNull();
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});
