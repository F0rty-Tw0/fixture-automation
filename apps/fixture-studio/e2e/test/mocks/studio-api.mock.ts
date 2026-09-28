import type { ApiErrorBody, GenerateResult, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import type { Route } from '@playwright/test';

import type { RecordingRoute, RouteHandler } from '../common/playwright.type.ts';
import { GENERATE_RESULT_STUB, LOADED_SPEC_STUB, SPEC_ERROR_STUB, UNMOCKED_ERROR_STUB } from '../stubs/studio-api.stub.ts';
import { recordingRoute } from '../utils/recording-route.spec.util.ts';

/** The dev proxy's answer when the API process is down: a bare 502 with no body. */
const UNREACHABLE_STATUS = 502;

export const specsMock = (spec: LoadedSpec = LOADED_SPEC_STUB): RecordingRoute => recordingRoute(spec);

export const generateMock = (result: GenerateResult = GENERATE_RESULT_STUB): RecordingRoute => recordingRoute(result);

export const apiErrorMock = (error: ApiErrorBody = SPEC_ERROR_STUB, status = 422): RouteHandler => {
  return async (route: Route): Promise<void> => route.fulfill({ json: error, status });
};

export const unreachableMock = (): RouteHandler => {
  return async (route: Route): Promise<void> => route.fulfill({ body: '', status: UNREACHABLE_STATUS });
};

/** Catch-all under every scenario mock: answers 501 and records the url, so a missing mock fails the test. */
export const unmockedApiMock = (unmockedUrls: string[], error: ApiErrorBody = UNMOCKED_ERROR_STUB): RouteHandler => {
  return async (route: Route): Promise<void> => {
    unmockedUrls.push(route.request().url());

    return route.fulfill({ json: error, status: 501 });
  };
};
