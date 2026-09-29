import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { describe, expect, it } from 'vitest';

import { abortOnDisconnect } from './abort-on-disconnect.ts';

const unfinishedResponse = (): ServerResponse => {
  const request = new IncomingMessage(new Socket());

  return new ServerResponse(request);
};

describe('FEATURE: abort on disconnect', (): void => {
  describe('GIVEN a response still being written', (): void => {
    it('WHEN it closes THEN the controller aborts', (): void => {
      const response = unfinishedResponse();
      const controller = abortOnDisconnect(response);

      response.emit('close');

      expect(controller.signal.aborted).toBe(true);
    });

    it('WHEN it has not closed THEN the controller stays open', (): void => {
      const controller = abortOnDisconnect(unfinishedResponse());

      expect(controller.signal.aborted).toBe(false);
    });
  });
});
