import type { Route } from '@playwright/test';

import type { RecordingRoute } from '../common/playwright.type.ts';

/** Answers every request with `payload` as JSON and keeps each request body, so a spec can assert what the UI sent. */
export const recordingRoute = (payload: unknown): RecordingRoute => {
  const bodies: unknown[] = [];

  const handler = async (route: Route): Promise<void> => {
    const body: unknown = route.request().postDataJSON();

    bodies.push(body);

    return route.fulfill({ json: payload });
  };

  const recording: RecordingRoute = { handler, bodies };

  return recording;
};
