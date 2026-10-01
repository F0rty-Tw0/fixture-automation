import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { AiFillEvent, AiModelsResult, ApiErrorBody, FillSource } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiFillPanel } from './ai-fill-panel.ts';
import { provideHttpStudioEngine } from '../../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import { rangeRectsMock } from '../../../test/mocks/browser.mock.ts';
import {
  CLI_TOOLS_RESULT_STUB,
  DIFF_RESULT_STUB,
  FIXTURE_VIEW_STUB,
  LOADED_SPEC_STUB,
  MERGE_RESULT_STUB
} from '../../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, settle } from '../../../test/utils/studio-http.spec.util.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';
import { provideFixtureWorkbench } from '../../../workbench/domain-logic/fixture-workbench.provider.ts';
import { answerPanel, mergeRequest, runButton } from '../../test/utils/ai-fill-panel.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();
const MODELS: AiModelsResult = { models: ['mock-model'], source: 'mock' };
const FILL_URL = '/api/specs/spec-1/ai-fill';
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };
const MERGE_FAILURE: ApiErrorBody = { message: 'The merge worker crashed.', fix: undefined };
const CLI_ERROR: AiFillEvent = { type: 'error', message: 'claude exited with code 1.', fix: 'Sign in to claude.' };
const OPEN_STATUS = { status: 'open' };
const DRAFT_STATUS = { status: 'draft' };
const SAMPLED_STATUS: Record<string, FillSource> = { status: 'sampler' };
const PLAIN_RESULT: AiFillEvent = { type: 'result', populated: OPEN_STATUS };
const SALVAGED_RESULT: AiFillEvent = {
  type: 'result',
  populated: DRAFT_STATUS,
  sources: SAMPLED_STATUS,
  notes: ['The model left status out; the schema sample stands in.']
};

const lineOf = (event: AiFillEvent): string => `${JSON.stringify(event)}\n`;

describe('FEATURE: AiFillPanel results', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AiFillPanel>;

  /** Starts a fill and streams `event` as its last line; a result then asks for the merge, which stays open until answered. */
  const fillWith = (event: AiFillEvent): TestRequest => {
    runButton(fixture).click();
    TestBed.tick();

    const fill = http.expectOne(FILL_URL);
    const text = lineOf(event);

    fill.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });

    return fill;
  };

  const render = async (): Promise<void> => {
    await settle();
    fixture.detectChanges();
  };

  const region = (label: string): Element | null => hostOf(fixture).querySelector(`[role="region"][aria-label="${label}"]`);

  beforeEach(async (): Promise<void> => {
    rangeRectsMock();
    vi.stubGlobal('LanguageModel', undefined);
    http = configureStudioHttp(STUDIO_ENGINE, provideFixtureWorkbench());
    TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, LOADED_SPEC_STUB);

    const comparison = TestBed.inject(FixtureComparison);

    await comparison.readFile(new File(['{"id":"in_1"}'], 'invoice.json'));
    comparison.compare('GET /v1/invoices');
    TestBed.tick();
    http.expectOne('/api/specs/spec-1/diff').flush(DIFF_RESULT_STUB);
    await settle();

    fixture = TestBed.createComponent(AiFillPanel);
    fixture.componentRef.setInput('view', FIXTURE_VIEW_STUB);
    await answerPanel(http, '/api/ai/cli/tools', CLI_TOOLS_RESULT_STUB);
    await answerPanel(http, '/api/ai/cli/models?tool=claude', MODELS);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
    vi.unstubAllGlobals();
  });

  describe('GIVEN a CLI fill that fails', (): void => {
    beforeEach(async (): Promise<void> => {
      fillWith(CLI_ERROR);
      await render();
    });

    it('WHEN rendered THEN offers the schema-complete fixture instead', (): void => {
      expect(region('Generated fallback')).not.toBeNull();
      expect(textAt(fixture, '.fallback__title')).toBe('Generated from the schema');
    });

    it('WHEN rendered THEN the fallback offers the hashed name, once', (): void => {
      const toggles = hostOf(fixture).querySelectorAll('mat-slide-toggle');
      const fallbackToggle = region('Generated fallback')?.querySelector('mat-slide-toggle');

      expect(toggles).toHaveLength(1);
      expect(fallbackToggle).toBeInstanceOf(HTMLElement);
    });

    it('WHEN rendered THEN shows the error after the fallback, not in its place', (): void => {
      const fallback = region('Generated fallback');
      const notice = requiredElement(fixture, 'fs-api-error-notice');
      const position = fallback?.compareDocumentPosition(notice) ?? 0;

      expect(textAt(fixture, '.notice__message')).toBe('claude exited with code 1.');
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('GIVEN an answer with sources and notes WHEN merged THEN shows the notes and where each value came from', async (): Promise<void> => {
    fillWith(SALVAGED_RESULT);
    const merge = await mergeRequest(http);

    merge.flush(MERGE_RESULT_STUB);
    await render();

    expect(textsAt(fixture, '.notices__lines li')).toStrictEqual(['The model left status out; the schema sample stands in.']);
    expect(textsAt(fixture, '.sources__source')).toStrictEqual(['Generated from the schema']);
  });

  it('GIVEN an answer whose merge fails WHEN rendered THEN still shows the AI answer beside the fallback', async (): Promise<void> => {
    fillWith(PLAIN_RESULT);
    const merge = await mergeRequest(http);

    merge.flush(MERGE_FAILURE, SERVER_ERROR);
    await render();

    expect(textAt(fixture, '.fallback__title')).toBe('Generated from the schema');
    expect(textsAt(fixture, '.fill__section-title')).toContain('Filled values');
    expect(textAt(fixture, '.notice__message')).toBe(MERGE_FAILURE.message);
  });

  describe('GIVEN a merged fill', (): void => {
    beforeEach(async (): Promise<void> => {
      fillWith(PLAIN_RESULT);
      const merge = await mergeRequest(http);

      merge.flush(MERGE_RESULT_STUB);
      await render();
    });

    it('WHEN rendered THEN credits AI for the filled value', (): void => {
      expect(textsAt(fixture, '.sources__source')).toStrictEqual(['Filled by AI']);
    });

    it('WHEN rendered THEN only the merged fixture offers the hashed name, not the filled values', (): void => {
      const toggles = hostOf(fixture).querySelectorAll('mat-slide-toggle');
      const mergeToggle = region('Merge result')?.querySelector('mat-slide-toggle');

      expect(textsAt(fixture, '.fill__section-title')).toContain('Filled values');
      expect(toggles).toHaveLength(1);
      expect(mergeToggle).toBeInstanceOf(HTMLElement);
    });

    it('WHEN hashed naming is turned on THEN names the merged fixture as the API answers', async (): Promise<void> => {
      requiredElement(fixture, '[aria-label="Merge result"] mat-slide-toggle button').click();
      TestBed.tick();
      http.expectOne('/api/fixture-name?method=GET&url=/v1/invoices&subdirectory=').flush({ fileName: 'hash.json' });
      await render();

      expect(textAt(fixture, '[aria-label="Merge result"] .bar__file')).toBe('hash.json');
    });

    it('WHEN a re-run fails THEN drops the earlier merge and offers the fallback beside the error', async (): Promise<void> => {
      fillWith(CLI_ERROR);
      await render();

      expect(hostOf(fixture).querySelector('.merge__badge')).toBeNull();
      expect(region('Generated fallback')).not.toBeNull();
      expect(textAt(fixture, '.notice__message')).toBe('claude exited with code 1.');
    });
  });
});
