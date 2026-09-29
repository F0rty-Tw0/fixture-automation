import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type {
  ApiErrorBody,
  Endpoint,
  GenerateResult,
  GeneratedFixture,
  LoadedSpec
} from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FixtureGeneration } from './fixture-generation.service.ts';
import { SpecBrowser } from './spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { ENDPOINT_STUB, GENERATED_FIXTURE_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { answerGenerate, answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';
import { DEFAULT_GENERATE_OPTIONS } from '../common/generation.const.ts';
import type { GenerateOptions } from '../common/generation.type.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const FIRST: Endpoint = { ...ENDPOINT_STUB, id: 'GET /a', path: '/a' };
const SECOND: Endpoint = { ...ENDPOINT_STUB, id: 'GET /b', path: '/b' };
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [FIRST, SECOND] };
const NO_FORMATS: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, json: false, stub: false };
const TYPES_REQUIRED_ONLY: GenerateOptions = { json: false, stub: false, types: true, requiredOnly: true };
const FIXTURE: GeneratedFixture = { ...GENERATED_FIXTURE_STUB, endpointId: 'GET /a', json: '{}' };
const RESULT: GenerateResult = { fixtures: [FIXTURE] };
const SECOND_FIXTURE: GeneratedFixture = { ...FIXTURE, endpointId: 'GET /b' };
const BOTH: GenerateResult = { fixtures: [FIXTURE, SECOND_FIXTURE] };

describe('FEATURE: fixture generation', (): void => {
  let http: HttpTestingController;
  let browser: SpecBrowser;
  let generation: FixtureGeneration;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE);
    browser = TestBed.inject(SpecBrowser);
    generation = TestBed.inject(FixtureGeneration);
    browser.loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, SPEC);
  });

  afterEach((): void => {
    http.verify();
  });

  describe('GIVEN nothing selected', (): void => {
    it('WHEN read THEN cannot generate', (): void => {
      expect(generation.canGenerate()).toBe(false);
    });

    it('WHEN generating anyway THEN posts nothing to generate', (): void => {
      generation.generate();
      TestBed.tick();

      http.expectNone('/api/specs/spec-1/generate');
      expect(generation.isGenerating()).toBe(false);
    });
  });

  describe('GIVEN endpoints selected out of spec order', (): void => {
    beforeEach((): void => {
      browser.toggle(SECOND.id);
      browser.toggle(FIRST.id);
    });

    it('WHEN the default formats are on THEN can generate', (): void => {
      expect(generation.canGenerate()).toBe(true);
    });

    it('WHEN every format is off THEN cannot generate', (): void => {
      generation.options.set(NO_FORMATS);

      expect(generation.canGenerate()).toBe(false);
    });

    it('WHEN generating THEN posts ids in spec order with the chosen formats', (): void => {
      generation.options.set(TYPES_REQUIRED_ONLY);

      generation.generate();
      TestBed.tick();

      const request = http.expectOne('/api/specs/spec-1/generate');

      expect(request.request.body).toStrictEqual({ endpointIds: ['GET /a', 'GET /b'], formats: ['types'], requiredOnly: true });
    });

    it('WHEN the API answers THEN exposes one view per fixture', async (): Promise<void> => {
      generation.generate();
      await answerGenerate(http, 'spec-1', RESULT);

      expect(generation.isGenerating()).toBe(false);
      expect(generation.views().map((view) => view.endpointId)).toStrictEqual(['GET /a']);
    });

    it('WHEN nothing is generated yet THEN no endpoint is active', (): void => {
      expect(generation.activeEndpointId()).toBeUndefined();
    });

    describe('WHEN two fixtures are generated', (): void => {
      beforeEach(async (): Promise<void> => {
        generation.generate();
        await answerGenerate(http, 'spec-1', BOTH);
      });

      it('THEN the first endpoint is active', (): void => {
        expect(generation.activeEndpointId()).toBe('GET /a');
      });

      it('THEN another endpoint can be chosen', (): void => {
        generation.selectEndpoint('GET /b');

        expect(generation.activeEndpointId()).toBe('GET /b');
      });

      it('THEN the chosen endpoint stays active across a new generate that still has it', async (): Promise<void> => {
        generation.selectEndpoint('GET /b');
        generation.options.set(TYPES_REQUIRED_ONLY);
        generation.generate();
        await answerGenerate(http, 'spec-1', BOTH);

        expect(generation.activeEndpointId()).toBe('GET /b');
      });

      it('THEN a new generate without the chosen endpoint falls back to the first', async (): Promise<void> => {
        generation.selectEndpoint('GET /b');
        generation.options.set(TYPES_REQUIRED_ONLY);
        generation.generate();
        await answerGenerate(http, 'spec-1', RESULT);

        expect(generation.activeEndpointId()).toBe('GET /a');
      });
    });

    it('WHEN the API fails THEN exposes its message and fix', async (): Promise<void> => {
      const error: ApiErrorBody = { message: 'Unknown spec id.', fix: 'Reload the spec.' };

      generation.generate();
      TestBed.tick();
      http.expectOne('/api/specs/spec-1/generate').flush(error, { status: 404, statusText: 'Not Found' });
      await settle();

      expect(generation.error()).toStrictEqual(error);
      expect(generation.views()).toStrictEqual([]);
    });
  });
});
