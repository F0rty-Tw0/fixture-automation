import type { HttpTestingController } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { ApiErrorBody, LoadSpecBody } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SpecStore } from './spec.store.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { HttpStudioEngine } from '../../shared/studio-engine/data-access/http-studio.engine.ts';
import { LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { answerSpecLoad, configureStudioHttp, failSpecLoad } from '../../test/utils/studio-http.spec.util.ts';

const HTTP_ENGINE: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };

const URL_SOURCE: LoadSpecBody = { url: 'https://example.com/openapi.json' };

describe('FEATURE: spec store', (): void => {
  let http: HttpTestingController;
  let store: SpecStore;

  beforeEach((): void => {
    http = configureStudioHttp(HTTP_ENGINE);
    store = TestBed.inject(SpecStore);
  });

  afterEach((): void => {
    http.verify();
  });

  describe('GIVEN no source', (): void => {
    it('WHEN effects run THEN stays idle without a request', (): void => {
      TestBed.tick();

      expect(store.spec.status()).toBe('idle');
      http.expectNone('/api/specs');
    });

    it('WHEN read THEN has no loaded spec', (): void => {
      expect(store.loadedSpec()).toBeUndefined();
    });
  });

  describe('GIVEN a URL source', (): void => {
    beforeEach((): void => {
      store.load(URL_SOURCE);
    });

    it('WHEN the request is in flight THEN is loading and posts the source', (): void => {
      TestBed.tick();

      const request = http.expectOne('/api/specs');

      expect(store.spec.status()).toBe('loading');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toStrictEqual(URL_SOURCE);
    });

    it('WHEN the API answers THEN exposes the loaded spec', async (): Promise<void> => {
      await answerSpecLoad(http, LOADED_SPEC_STUB);

      expect(store.spec.status()).toBe('resolved');
      expect(store.loadedSpec()).toStrictEqual(LOADED_SPEC_STUB);
    });

    it('WHEN the API fails THEN is in error with no loaded spec', async (): Promise<void> => {
      const error: ApiErrorBody = { message: 'Not an OpenAPI document.', fix: undefined };

      await failSpecLoad(http, error);

      expect(store.spec.status()).toBe('error');
      expect(store.loadedSpec()).toBeUndefined();
    });
  });
});
