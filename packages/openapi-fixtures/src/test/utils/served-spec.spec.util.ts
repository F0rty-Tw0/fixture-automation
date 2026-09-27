import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ServedSpec } from '../common/served-spec.type.ts';

/** Holds every request open: no response at all, or headers plus `firstChunk` (chunked, no `content-length`) and nothing more. */
export const stalledSpec = async (firstChunk?: string): Promise<ServedSpec> => {
  const serve = (_request: IncomingMessage, response: ServerResponse): void => {
    if (firstChunk === undefined) return;

    response.setHeader('Content-Type', 'application/json');
    response.write(firstChunk);
  };
  const server = createServer(serve);
  const listening = once(server, 'listening');

  server.listen(0, '127.0.0.1');
  await listening;

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const dispose = async (): Promise<void> => {
    const closed = once(server, 'close');

    server.closeAllConnections();
    server.close();
    await closed;
  };
  const url = new URL(`http://127.0.0.1:${port}/spec.json`);
  const hosted: ServedSpec = { url, dispose };

  return hosted;
};

/** Serves `text` at `/spec.json`; pass `status` to reproduce an HTTP failure. */
export const servedSpec = async (text: string, status = 200): Promise<ServedSpec> => {
  const serve = (request: IncomingMessage, response: ServerResponse): void => {
    request.resume();
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(text);
  };
  const server = createServer(serve);
  const listening = once(server, 'listening');

  server.listen(0, '127.0.0.1');
  await listening;

  const address = server.address();
  const dispose = async (): Promise<void> => {
    const closed = once(server, 'close');

    server.close();
    await closed;
  };

  if (typeof address !== 'object' || address === null) {
    await dispose();

    throw new Error('the spec server has no TCP address');
  }

  const url = new URL(`http://127.0.0.1:${address.port}/spec.json`);
  const hosted: ServedSpec = { url, dispose };

  return hosted;
};
