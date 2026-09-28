import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatSelectHarness } from '@angular/material/select/testing';

import type { AiModelsResult, AiToolStatus, AiToolsResult, ApiErrorBody, MergeResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiFillPanel } from './ai-fill-panel.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { provideFixtureWorkbench } from '../../domain-logic/fixture-workbench.provider.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { languageModelMock, languageModelSessionMock } from '../../test/mocks/browser.mock.ts';
import {
  CLI_TOOLS_RESULT_STUB,
  DIFF_RESULT_STUB,
  FIXTURE_VIEW_STUB,
  LOADED_SPEC_STUB,
  MERGE_RESULT_STUB
} from '../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();
const STREAM = '{"type":"progress","stream":"stdout","text":"thinking"}\n{"type":"result","populated":{"status":"open"}}\n';
const TOOLS_URL = '/api/ai/cli/tools';
const MODELS: AiModelsResult = { models: ['mock-model'], source: 'mock' };
const MISSING_CLAUDE: AiToolStatus = { tool: 'claude', installed: false };
const INSTALLED_CODEX: AiToolStatus = { tool: 'codex', installed: true };
const CLAUDE_MISSING_TOOLS: AiToolsResult = { tools: [MISSING_CLAUDE, INSTALLED_CODEX], mock: false };
const NO_TOOLS: AiToolsResult = { tools: [MISSING_CLAUDE], mock: false };
const MOCK_TOOLS: AiToolsResult = { ...CLI_TOOLS_RESULT_STUB, mock: true };
const DISCOVERY_ERROR: ApiErrorBody = { message: 'claude model discovery failed: not logged in', fix: 'log in' };
const BAD_GATEWAY = { status: 502, statusText: 'Bad Gateway' };

const runButton = (fixture: ComponentFixture<AiFillPanel>): HTMLButtonElement => {
  const button = requiredElement(fixture, '.fill__actions button');

  if (!(button instanceof HTMLButtonElement)) throw new Error('The run button is missing.');

  return button;
};

/** The panel asks once its resources run; retry until the request is sent, then answer it. */
const answerPanel = async (http: HttpTestingController, url: string, body: object): Promise<void> => {
  const answer = (): void => {
    TestBed.tick();
    http.expectOne(url).flush(body);
  };

  await vi.waitFor(answer);
};

const failDiscovery = async (http: HttpTestingController): Promise<void> => {
  const fail = (): void => {
    TestBed.tick();
    http.expectOne('/api/ai/cli/models?tool=claude').flush(DISCOVERY_ERROR, BAD_GATEWAY);
  };

  await vi.waitFor(fail);
};

/** The merge starts once the stream's result settles; retry until it is sent. */
const mergeRequest = async (http: HttpTestingController): Promise<TestRequest> => {
  const expectMerge = (): TestRequest => {
    TestBed.tick();

    return http.expectOne('/api/specs/spec-1/merge');
  };

  return vi.waitFor(expectMerge);
};

describe('FEATURE: AiFillPanel', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AiFillPanel>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    localStorage.clear();
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
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  afterEach((): void => {
    http.verify();
    vi.unstubAllGlobals();
  });

  describe('GIVEN every CLI is installed and discovery works', (): void => {
    beforeEach(async (): Promise<void> => {
      await answerPanel(http, TOOLS_URL, CLI_TOOLS_RESULT_STUB);
      await answerPanel(http, '/api/ai/cli/models?tool=claude', MODELS);
      await fixture.whenStable();
    });

    describe('SCENARIO: provider', (): void => {
      it('GIVEN no opt-in WHEN rendered THEN fills with the local CLI and says why Chrome AI is off', (): void => {
        expect(textAt(fixture, '.fill__chip')).toBe('Local CLI');
        expect(textAt(fixture, '.fill__availability')).toBe('Chrome AI: Not available in this browser');
      });

      it('GIVEN the scenario field WHEN rendered THEN calls it an extra prompt added to the built-in instructions', (): void => {
        expect(textAt(fixture, '.fill__scenario mat-label')).toBe('Extra prompt (scenario)');
        expect(textAt(fixture, '.fill__scenario mat-hint')).toContain('Added to the built-in instructions sent to the model');
      });

      it('GIVEN a browser without Chrome AI WHEN the user opts in THEN keeps the CLI and says so', async (): Promise<void> => {
        const optIn = await loader.getHarness(MatCheckboxHarness.with({ label: 'Use on-device Chrome AI' }));

        await optIn.check();

        expect(textAt(fixture, '.fill__chip')).toBe('Local CLI');
        expect(textAt(fixture, '.fill__note')).toContain("Chrome AI can't run in this browser");
      });
    });

    describe('SCENARIO: filling', (): void => {
      let fill: TestRequest;

      beforeEach((): void => {
        runButton(fixture).click();
        TestBed.tick();
        fill = http.expectOne('/api/specs/spec-1/ai-fill');
      });

      it('WHEN running THEN offers Cancel, and Cancel aborts the stream', (): void => {
        fixture.detectChanges();
        const cancel = hostOf(fixture).querySelectorAll<HTMLButtonElement>('.fill__actions button')[1];

        cancel?.click();

        expect(cancel?.textContent.trim()).toBe('Cancel');
        expect(fill.cancelled).toBe(true);
      });

      it('WHEN the CLI answers THEN logs its progress and shows the valid merge', async (): Promise<void> => {
        fill.event({ type: HttpEventType.DownloadProgress, loaded: STREAM.length, partialText: STREAM });
        const merge = await mergeRequest(http);

        merge.flush(MERGE_RESULT_STUB);
        await settle();
        fixture.detectChanges();

        expect(textsAt(fixture, '.log__line')).toStrictEqual(['thinking']);
        expect(textAt(fixture, '.fill__badge')).toBe('Valid against the schema · 1 values filled');
      });

      it('WHEN the merge breaks the schema THEN lists the errors', async (): Promise<void> => {
        const invalid: MergeResult = { ...MERGE_RESULT_STUB, valid: false, errors: ['status: must be one of draft, open'] };

        fill.event({ type: HttpEventType.DownloadProgress, loaded: STREAM.length, partialText: STREAM });
        const merge = await mergeRequest(http);

        merge.flush(invalid);
        await settle();
        fixture.detectChanges();

        expect(textAt(fixture, '.fill__badge')).toBe('1 schema errors');
        expect(textsAt(fixture, '.fill__error')).toStrictEqual(['status: must be one of draft, open']);
      });
    });
  });

  describe('GIVEN Chrome AI whose model is not downloaded yet', (): void => {
    let factory: LanguageModelFactory;

    beforeEach(async (): Promise<void> => {
      factory = languageModelMock();
      vi.mocked(factory.availability).mockResolvedValue('downloadable');
      vi.mocked(factory.create).mockResolvedValue(languageModelSessionMock());
      vi.stubGlobal('LanguageModel', factory);
      await answerPanel(http, TOOLS_URL, CLI_TOOLS_RESULT_STUB);
      await answerPanel(http, '/api/ai/cli/models?tool=claude', MODELS);

      const optIn = await loader.getHarness(MatCheckboxHarness.with({ label: 'Use on-device Chrome AI' }));

      await optIn.check();
    });

    it('WHEN opted in THEN says there is no model yet, offers the download, and keeps Fill disabled', (): void => {
      expect(textAt(fixture, '.fill__model-text')).toContain('No on-device model on this machine yet');
      expect(textAt(fixture, '.fill__model-action')).toBe('Download model');
      expect(runButton(fixture).disabled).toBe(true);
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('WHEN the model is downloaded THEN it is ready and Fill is enabled', async (): Promise<void> => {
      vi.mocked(factory.availability).mockResolvedValue('available');

      requiredElement(fixture, '.fill__model-action').click();
      await settle();
      await fixture.whenStable();

      expect(factory.create).toHaveBeenCalledTimes(1);
      expect(textAt(fixture, '.fill__model-text')).toBe('The on-device model is ready.');
      expect(runButton(fixture).disabled).toBe(false);
    });
  });

  describe('GIVEN the chosen CLI is not installed', (): void => {
    beforeEach(async (): Promise<void> => {
      await answerPanel(http, TOOLS_URL, CLAUDE_MISSING_TOOLS);
      await answerPanel(http, '/api/ai/cli/models?tool=codex', MODELS);
      await fixture.whenStable();
    });

    it('WHEN the CLI list opens THEN codex is chosen and the missing tool is disabled and marked', async (): Promise<void> => {
      const cli = await loader.getHarness(MatSelectHarness.with({ selector: '.fill__cli' }));

      await cli.open();
      const [claude] = await cli.getOptions();

      expect(await cli.getValueText()).toBe('codex');
      expect(await claude?.getText()).toBe('claude — not installed');
      expect(await claude?.isDisabled()).toBe(true);
    });
  });

  describe('GIVEN no CLI is installed', (): void => {
    beforeEach(async (): Promise<void> => {
      await answerPanel(http, TOOLS_URL, NO_TOOLS);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN says no CLI is on PATH and keeps Fill disabled', (): void => {
      expect(textAt(fixture, '.fill__hint--problem')).toBe('No AI CLI found on PATH');
      expect(runButton(fixture).disabled).toBe(true);
    });
  });

  describe('GIVEN the API runs the mock AI', (): void => {
    beforeEach(async (): Promise<void> => {
      await answerPanel(http, TOOLS_URL, MOCK_TOOLS);
      await answerPanel(http, '/api/ai/cli/models?tool=claude', MODELS);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN badges the mock next to the CLI', (): void => {
      expect(textAt(fixture, '.fill__chip--mock')).toBe('Mock AI — no CLI runs');
    });
  });

  describe('GIVEN model discovery fails', (): void => {
    beforeEach(async (): Promise<void> => {
      await answerPanel(http, TOOLS_URL, CLI_TOOLS_RESULT_STUB);
      await failDiscovery(http);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN shows the discovery error under the model field', (): void => {
      expect(textAt(fixture, '.fill__hint--problem')).toContain(DISCOVERY_ERROR.message);
    });

    it('WHEN Retry is clicked THEN discovers again and the error is gone', async (): Promise<void> => {
      requiredElement(fixture, '.fill__retry').click();
      await answerPanel(http, '/api/ai/cli/models?tool=claude', MODELS);
      await fixture.whenStable();

      expect(textAt(fixture, '.fill__hint--problem')).toBe('');
    });
  });
});
