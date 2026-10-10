import { once } from 'node:events';
import { createServer } from 'node:net';
import type { Server } from 'node:net';

/** A bare TCP server holding a random loopback port, so another listen on that port fails with `EADDRINUSE`; the spec closes it. */
export const portHolder = async (): Promise<Server> => {
  const server = createServer();

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  return server;
};

/** The TCP port a listening server is bound to. */
export const listeningPort = (server: Server): number => {
  const address = server.address();

  if (address === null || typeof address === 'string') throw new Error('the server is not listening on a TCP port');

  return address.port;
};
