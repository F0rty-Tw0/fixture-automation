import type { HttpTestingController } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { GenerateBody, GenerateResult, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GenerationStore } from './generation.store.ts';
import { HttpStudioEngine } from './http-studio.engine.ts';
import { SpecStore } from './spec.store.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { GenerateRequest } from '../common/studio.type.ts';
import { GENERATED_FIXTURE_STUB, LOADED_SPEC_STUB } from '../test/stubs/studio.stub.ts';
import { answerGenerate, answerSpecLoad, configureStudioHttp } from '../test/utils/studio-http.spec.util.ts';

const HTTP_ENGINE: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };

const GENERATE_BODY: GenerateBody = { endpointIds: ['GET /v1/invoices'], formats: ['json'], requiredOnly: false };
const REQUEST: GenerateRequest = { specId: 'spec-1', body: GENERATE_BODY };
const RESULT: GenerateResult = { fixtures: [GENERATED_FIXTURE_STUB] };
const OTHER_SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, specId: 'spec-2' };

describe('FEATURE: generation store', (): void => {
  let http: HttpTestingController;
  let store: GenerationStore;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(HTTP_ENGINE);
    store = TestBed.inject(GenerationStore);
    TestBed.inject(SpecStore).load({ url: 'https://example.com/a.json' });
    await answerSpecLoad(http, LOADED_SPEC_STUB);
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN no generate call WHEN effects run THEN stays idle', (): void => {
    TestBed.tick();

    expect(store.result.status()).toBe('idle');
  });

  describe('GIVEN a generate call', (): void => {
    beforeEach((): void => {
      store.generate(REQUEST);
    });

    it('WHEN the request is in flight THEN posts the body to the spec route', (): void => {
      TestBed.tick();

      const request = http.expectOne('/api/specs/spec-1/generate');

      expect(request.request.body).toStrictEqual(GENERATE_BODY);
    });

    it('WHEN the API answers THEN exposes the result', async (): Promise<void> => {
      await answerGenerate(http, 'spec-1', RESULT);

      expect(store.result.value()).toStrictEqual(RESULT);
    });

    it('WHEN another spec loads THEN drops the result', async (): Promise<void> => {
      await answerGenerate(http, 'spec-1', RESULT);
      TestBed.inject(SpecStore).load({ url: 'https://example.com/b.json' });
      await answerSpecLoad(http, OTHER_SPEC);

      expect(store.result.status()).toBe('idle');
    });
  });
});
