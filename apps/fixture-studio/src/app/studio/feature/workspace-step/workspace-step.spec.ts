import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { Endpoint, GenerateResult, GeneratedFixture, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WorkspaceStep } from './workspace-step.ts';
import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { scrollIntoViewMock } from '../../test/mocks/browser.mock.ts';
import { ENDPOINT_STUB, GENERATED_FIXTURE_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { hostOf, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerGenerate, answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const CREATE_INVOICE: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST' };
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [ENDPOINT_STUB, CREATE_INVOICE] };
const LIST_FIXTURE: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, json: '{}' };
const CREATE_FIXTURE: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, endpointId: CREATE_INVOICE.id, schemaName: 'Invoice', json: '{}' };
const RESULT: GenerateResult = { fixtures: [LIST_FIXTURE, CREATE_FIXTURE] };

const tabLabels = (fixture: ComponentFixture<WorkspaceStep>): string[] => textsAt(fixture, '.workspace__tab-label');

describe('FEATURE: WorkspaceStep', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<WorkspaceStep>;
  let scrollIntoView: Mock<Element['scrollIntoView']>;

  beforeEach(async (): Promise<void> => {
    scrollIntoView = scrollIntoViewMock();
    http = configureStudioHttp(STUDIO_ENGINE);
    const browser = TestBed.inject(SpecBrowser);

    browser.loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, SPEC);
    browser.toggleAllVisible();
    fixture = TestBed.createComponent(WorkspaceStep);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN nothing generated WHEN rendered THEN explains how to fill the workspace', (): void => {
    const host = hostOf(fixture);

    expect(host.querySelector('.workspace__empty')?.textContent).toContain('press Generate');
  });

  it('GIVEN nothing generated WHEN rendered THEN leaves the scroll position alone', (): void => {
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  describe('GIVEN a generate call', (): void => {
    beforeEach((): void => {
      TestBed.inject(FixtureGeneration).generate();
    });

    it('WHEN in flight THEN says so, leaving the progress bar to the Generate button', (): void => {
      TestBed.tick();
      const request = http.expectOne('/api/specs/spec-1/generate');

      fixture.detectChanges();
      const host = hostOf(fixture);

      expect(host.querySelector('mat-progress-bar')).toBeNull();
      expect(host.querySelector('.workspace__empty')?.textContent).toBe('Generating fixtures…');
      request.flush(RESULT);
    });

    it('WHEN the API answers THEN opens one tab per endpoint, labelled by method and path', async (): Promise<void> => {
      await answerGenerate(http, 'spec-1', RESULT);
      await fixture.whenStable();

      expect(tabLabels(fixture)).toStrictEqual(['GET /v1/invoices', 'POST /v1/invoices']);
    });

    it('WHEN the API answers THEN scrolls the workspace into view, since it opens below the endpoint list', async (): Promise<void> => {
      await answerGenerate(http, 'spec-1', RESULT);
      await fixture.whenStable();

      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
    });

    it('WHEN the API fails THEN shows the error notice', async (): Promise<void> => {
      TestBed.tick();
      http.expectOne('/api/specs/spec-1/generate').flush({ message: 'Unknown spec id.' }, { status: 404, statusText: 'Not Found' });
      await settle();
      const host = hostOf(fixture);

      expect(host.querySelector('.notice__message')?.textContent).toBe('Unknown spec id.');
    });
  });
});
