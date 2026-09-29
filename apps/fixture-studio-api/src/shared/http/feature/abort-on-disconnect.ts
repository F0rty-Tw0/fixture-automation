import type { ServerResponse } from 'node:http';

/** An `AbortController` aborted when the client drops the connection before `response` finished. */
export const abortOnDisconnect = (response: ServerResponse): AbortController => {
  const controller = new AbortController();

  const abortIfUnfinished = (): void => {
    if (response.writableFinished) return;

    controller.abort(new Error('the client disconnected'));
  };

  response.once('close', abortIfUnfinished);

  return controller;
};
