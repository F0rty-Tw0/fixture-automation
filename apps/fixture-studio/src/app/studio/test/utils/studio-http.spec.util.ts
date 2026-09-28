import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { ApiErrorBody, GenerateResult, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';

const SPECS_URL = '/api/specs';

/** Configures TestBed with a fake HTTP backend plus the given providers (at least the engine), and returns the backend's controller. */
export const configureStudioHttp = (...providers: Provider[]): HttpTestingController => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), ...providers] });

  return TestBed.inject(HttpTestingController);
};

export const settle = async (): Promise<void> => {
  await TestBed.inject(ApplicationRef).whenStable();
};

/** Runs pending resource effects, answers the spec load, and waits for the signals to settle. */
export const answerSpecLoad = async (http: HttpTestingController, spec: LoadedSpec): Promise<void> => {
  TestBed.tick();
  http.expectOne(SPECS_URL).flush(spec);
  await settle();
};

export const failSpecLoad = async (http: HttpTestingController, error: ApiErrorBody): Promise<void> => {
  TestBed.tick();
  http.expectOne(SPECS_URL).flush(error, { status: 422, statusText: 'Unprocessable Entity' });
  await settle();
};

export const answerGenerate = async (http: HttpTestingController, specId: string, result: GenerateResult): Promise<void> => {
  TestBed.tick();
  http.expectOne(`${SPECS_URL}/${specId}/generate`).flush(result);
  await settle();
};
