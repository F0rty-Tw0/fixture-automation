import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpecStep } from './spec-step.ts';
import { provideHttpStudioEngine } from '../../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { LOADED_SPEC_STUB } from '../../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, failSpecLoad } from '../../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const OPENAPI_DOCUMENT = { openapi: '3.1.0' };
const DOCUMENT_BODY = { document: OPENAPI_DOCUMENT };

const pickFile = (fixture: ComponentFixture<SpecStep>, file: File): void => {
  const input = requiredElement(fixture, 'input[type="file"]');
  const files = [file];

  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change'));
};

const dropFile = (fixture: ComponentFixture<SpecStep>, file: File): void => {
  const zone = requiredElement(fixture, '.drop');
  const drop = new Event('drop', { cancelable: true });
  const dataTransfer = { files: [file] };

  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
  zone.dispatchEvent(new Event('dragover', { cancelable: true }));
  zone.dispatchEvent(drop);
};

/** Files are read asynchronously; retry until the load request goes out. */
const sentSpecRequest = async (http: HttpTestingController): Promise<TestRequest> => {
  const expectRequest = (): TestRequest => {
    TestBed.tick();

    return http.expectOne('/api/specs');
  };

  return vi.waitFor(expectRequest);
};

/** Files are read asynchronously; retry until the file error renders. */
const shownFileError = async (fixture: ComponentFixture<SpecStep>): Promise<string> => {
  const readError = (): string => {
    fixture.detectChanges();

    const message = textAt(fixture, '.source__file-error');

    if (message === '') throw new Error('No file error rendered yet.');

    return message;
  };

  return vi.waitFor(readError);
};

describe('FEATURE: SpecStep', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SpecStep>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE);
    fixture = TestBed.createComponent(SpecStep);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  describe('SCENARIO: loading by URL', (): void => {
    it('GIVEN an empty URL WHEN submitted THEN asks for a URL and sends nothing', async (): Promise<void> => {
      const load = await loader.getHarness(MatButtonHarness.with({ text: 'Load spec' }));

      await load.click();

      expect(textAt(fixture, 'mat-error')).toBe('Enter the URL of an OpenAPI JSON document.');
      http.expectNone('/api/specs');
    });

    it('GIVEN a non-http URL WHEN submitted THEN asks for http(s)', async (): Promise<void> => {
      const url = await loader.getHarness(MatInputHarness);
      const load = await loader.getHarness(MatButtonHarness.with({ text: 'Load spec' }));

      await url.setValue('ftp://example.com/openapi.json');
      await load.click();

      expect(textAt(fixture, 'mat-error')).toBe('Use an http:// or https:// URL.');
    });

    describe('GIVEN a valid URL', (): void => {
      beforeEach(async (): Promise<void> => {
        const url = await loader.getHarness(MatInputHarness);
        const form = requiredElement(fixture, 'form');

        await url.setValue(' https://example.com/openapi.json ');
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      });

      it('WHEN submitted THEN posts the trimmed URL and shows progress', (): void => {
        TestBed.tick();
        const request = http.expectOne('/api/specs');

        fixture.detectChanges();

        expect(request.request.body).toStrictEqual({ url: 'https://example.com/openapi.json' });
        expect(hostOf(fixture).querySelector('mat-progress-bar')).not.toBeNull();
      });

      it('WHEN the API answers THEN hides the progress bar', async (): Promise<void> => {
        await answerSpecLoad(http, LOADED_SPEC_STUB);

        expect(hostOf(fixture).querySelector('mat-progress-bar')).toBeNull();
      });

      it('WHEN the API rejects the spec THEN shows its message and fix', async (): Promise<void> => {
        const error: ApiErrorBody = { message: 'Swagger 2 is not supported.', fix: 'Convert it to OpenAPI 3.' };

        await failSpecLoad(http, error);

        expect(textAt(fixture, '.notice__message')).toBe(error.message);
        expect(textAt(fixture, '.notice__fix')).toBe('Fix Convert it to OpenAPI 3.');
      });
    });
  });

  describe('SCENARIO: loading a local file', (): void => {
    it('GIVEN a JSON spec file WHEN picked THEN posts it as the document', async (): Promise<void> => {
      pickFile(fixture, new File(['{"openapi":"3.1.0"}'], 'api.json'));
      const request = await sentSpecRequest(http);

      expect(request.request.body).toStrictEqual(DOCUMENT_BODY);
    });

    it('GIVEN a file that is not JSON WHEN dropped THEN explains why and sends nothing', async (): Promise<void> => {
      dropFile(fixture, new File(['openapi: 3.1.0'], 'api.yaml'));
      const message = await shownFileError(fixture);

      expect(message).toBe('api.yaml is not valid JSON.');
      http.expectNone('/api/specs');
    });

    it('GIVEN a rejected file WHEN a valid one is dropped THEN clears the error and loads it', async (): Promise<void> => {
      dropFile(fixture, new File(['nope'], 'bad.json'));
      await shownFileError(fixture);
      dropFile(fixture, new File(['{"openapi":"3.1.0"}'], 'good.json'));
      const request = await sentSpecRequest(http);

      fixture.detectChanges();

      expect(textAt(fixture, '.source__file-error')).toBe('');
      expect(request.request.body).toStrictEqual(DOCUMENT_BODY);
    });
  });
});
