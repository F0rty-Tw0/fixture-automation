import type { Route } from '@playwright/test';
import { expect } from '@playwright/test';

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

/** The request bodies `recording` answered, polled until they match: a request the UI sends after a change may still be on its way. */
export const expectSentBodies = async (recording: RecordingRoute, bodies: unknown[]): Promise<void> => {
  const sent = (): unknown[] => recording.bodies;

  await expect.poll(sent).toEqual(bodies);
};
