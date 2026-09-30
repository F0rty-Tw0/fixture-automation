import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';

import type { DiffResult, EnvelopeResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComparePanel } from './compare-panel.ts';
import { provideHttpStudioEngine } from '../../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import { DIFF_RESULT_STUB, FIXTURE_VIEW_STUB, LOADED_SPEC_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, settle } from '../../../test/utils/studio-http.spec.util.ts';
import { provideFixtureWorkbench } from '../../../workbench/domain-logic/fixture-workbench.provider.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();
const DETECTED_DATA: EnvelopeResult = { candidates: ['data', 'meta'], detected: 'data' };
const NO_ENVELOPE: EnvelopeResult = { candidates: [], detected: undefined };
const WARNED_DIFF: DiffResult = { ...DIFF_RESULT_STUB, warnings: ['The broken-value check timed out; no value was replaced.'] };

const dropFile = (fixture: ComponentFixture<ComparePanel>, file: File): void => {
  const drop = new Event('drop', { cancelable: true });
  const dataTransfer = { files: [file] };

  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
  requiredElement(fixture, '.drop').dispatchEvent(drop);
};

/** Files are read asynchronously; retry until the panel shows the result. */
const shown = async (fixture: ComponentFixture<ComparePanel>, selector: string): Promise<string> => {
  const read = (): string => {
    fixture.detectChanges();

    const text = textAt(fixture, selector);

    if (text === '') throw new Error(`Nothing rendered at ${selector} yet.`);

    return text;
  };

  return vi.waitFor(read);
};

/**
 * Waits for the panel to send `url`, answers it, renders, and returns the body that was sent. While a request is open,
 * harness actions wait for a settle that never comes, so clicks that start one go through the DOM.
 */
const answer = async (
  http: HttpTestingController,
  fixture: ComponentFixture<ComparePanel>,
  url: string,
  body: object
): Promise<unknown> => {
  const expectRequest = (): TestRequest => {
    TestBed.tick();

    return http.expectOne(url);
  };

  const request = await vi.waitFor(expectRequest);
  const sent: unknown = request.request.body;

  request.flush(body);
  await settle();
  fixture.detectChanges();

  return sent;
};

const ENVELOPE_URL = '/api/specs/spec-1/envelope';

const DIFF_URL = '/api/specs/spec-1/diff';

describe('FEATURE: ComparePanel', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ComparePanel>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE, provideFixtureWorkbench());
    TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, LOADED_SPEC_STUB);
    fixture = TestBed.createComponent(ComparePanel);
    fixture.componentRef.setInput('view', FIXTURE_VIEW_STUB);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN no fixture yet WHEN rendered THEN offers a drop zone and a paste box, but no compare', (): void => {
    expect(textAt(fixture, '.drop__title')).toBe('Drop an existing fixture');
    expect(hostOf(fixture).querySelector('.compare__run')).toBeNull();
  });

  describe('GIVEN a dropped JSON fixture', (): void => {
    beforeEach(async (): Promise<void> => {
      dropFile(fixture, new File(['{"data":{"id":"in_1"}}'], 'invoice.json'));
      await shown(fixture, '.compare__name');
    });

    it('WHEN read THEN asks the API for its envelope with the parsed fixture', async (): Promise<void> => {
      const sent = await answer(http, fixture, ENVELOPE_URL, DETECTED_DATA);
      const payload = { id: 'in_1' };
      const fixtureValue = { data: payload };

      expect(sent).toStrictEqual({ endpointId: FIXTURE_VIEW_STUB.endpointId, fixture: fixtureValue });
      await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);
    });

    describe('WHEN the API detects an envelope', (): void => {
      let sentDiff: unknown;

      beforeEach(async (): Promise<void> => {
        await answer(http, fixture, ENVELOPE_URL, DETECTED_DATA);
        sentDiff = await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);
      });

      it('THEN preselects it and compares inside it at once, replacing placeholders', async (): Promise<void> => {
        const select = await loader.getHarness(MatSelectHarness);

        expect(textAt(fixture, '.compare__name')).toBe('invoice.json');
        expect(await select.getValueText()).toBe('data');
        expect(sentDiff).toMatchObject({ objectShape: 'data', replacePlaceholders: true });
      });

      it('THEN offers "none" and every candidate', async (): Promise<void> => {
        const select = await loader.getHarness(MatSelectHarness);

        await select.open();
        const options = await select.getOptions();
        const labels = await Promise.all(options.map(async (option) => option.getText()));

        expect(labels).toStrictEqual(['None — the fixture is the payload', 'data', 'meta']);
      });

      it('THEN shows the diff and steps the compare button back', async (): Promise<void> => {
        const compare = await loader.getHarness(MatButtonHarness.with({ text: 'Compare with schema' }));

        expect(hostOf(fixture).querySelector('.compare__diff fs-document-view')).not.toBeNull();
        expect(await compare.getAppearance()).toBe('outlined');
      });

      it('THEN the legend names the sampler fill the diff highlights', (): void => {
        expect(textsAt(fixture, '.document__legend-item')).toStrictEqual(['S Generated from the schema', '+ Was missing']);
      });

      it('THEN shows no warnings', (): void => {
        expect(hostOf(fixture).querySelector('fs-notice-list')).toBeNull();
      });

      it('THEN choosing no envelope compares again with the fixture as the payload', async (): Promise<void> => {
        const select = await loader.getHarness(MatSelectHarness);

        await select.open();
        document.querySelector<HTMLElement>('mat-option')?.click();
        const sent = await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);

        expect(sent).toMatchObject({ objectShape: undefined });
      });
    });

    it('WHEN the diff fell back in parts THEN lists the warnings and still shows the diff', async (): Promise<void> => {
      await answer(http, fixture, ENVELOPE_URL, NO_ENVELOPE);
      await answer(http, fixture, DIFF_URL, WARNED_DIFF);

      expect(textsAt(fixture, '.notices__lines li')).toStrictEqual(WARNED_DIFF.warnings);
      expect(hostOf(fixture).querySelector('.compare__diff fs-document-view')).not.toBeNull();
    });

    it('WHEN the API finds no envelope THEN compares the fixture as the payload', async (): Promise<void> => {
      await answer(http, fixture, ENVELOPE_URL, NO_ENVELOPE);
      const sent = await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);

      expect(sent).toMatchObject({ objectShape: undefined });
    });

    it('WHEN the envelope detection fails THEN still compares, as the payload', async (): Promise<void> => {
      const expectRequest = (): TestRequest => {
        TestBed.tick();

        return http.expectOne(ENVELOPE_URL);
      };
      const request = await vi.waitFor(expectRequest);

      request.flush({ message: 'down' }, { status: 502, statusText: 'Bad Gateway' });
      const sent = await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);

      expect(sent).toMatchObject({ objectShape: undefined });
    });
  });

  it('GIVEN a TypeScript fixture WHEN dropped THEN says it is being read until the parse settles', async (): Promise<void> => {
    dropFile(fixture, new File(["export const A = { id: 'x' };"], 'invoice.ts'));
    fixture.detectChanges();

    expect(textAt(fixture, '.compare__reading')).toBe('Reading invoice.ts…');

    await shown(fixture, '.compare__name');

    expect(hostOf(fixture).querySelector('.compare__reading')).toBeNull();

    await answer(http, fixture, ENVELOPE_URL, NO_ENVELOPE);
    await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);
  });

  it('GIVEN a TypeScript fixture with a call WHEN dropped THEN explains why it cannot be read', async (): Promise<void> => {
    dropFile(fixture, new File(['export const A = { at: now() };'], 'invoice.ts'));

    const message = await shown(fixture, '.compare__source-error');

    expect(message).toContain('a function call');
  });

  it('GIVEN pasted text WHEN used THEN reads it as the existing fixture', async (): Promise<void> => {
    const paste = await loader.getHarness(MatInputHarness);

    await paste.setValue('{"id":1}');
    requiredElement(fixture, '.compare__paste button').click();

    expect(await shown(fixture, '.compare__name')).toBe('Pasted text');

    await answer(http, fixture, ENVELOPE_URL, NO_ENVELOPE);
    await answer(http, fixture, DIFF_URL, DIFF_RESULT_STUB);
  });
});
