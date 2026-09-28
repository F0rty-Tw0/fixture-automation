import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { NdjsonStream } from '../common/playwright.type.ts';

const NDJSON_HEADERS = { 'content-type': 'application/x-ndjson' };

const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const sendChunk = async (response: ServerResponse, text: string): Promise<void> => {
  await new Promise<void>((resolve: () => void): void => {
    response.write(text, (): void => resolve());
  });
};

/**
 * Starts a local server that answers one `ai-fill` request and keeps it open: the test writes each chunk,
 * so a line can be split across chunks, and a browser abort is observed on the real connection.
 */
export const startNdjsonStream = async (): Promise<NdjsonStream> => {
  const bodies: unknown[] = [];
  const arrived = Promise.withResolvers<ServerResponse>();
  let isAborted = false;

  const answer = (request: IncomingMessage, response: ServerResponse): void => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer): void => {
      chunks.push(chunk);
    });

    request.on('end', (): void => {
      bodies.push(parseBody(Buffer.concat(chunks).toString('utf8')));
      response.writeHead(200, NDJSON_HEADERS);
      response.flushHeaders();
      arrived.resolve(response);
    });

    response.on('close', (): void => {
      isAborted = !response.writableEnded;
    });
  };

  const server = createServer(answer);

  await new Promise<void>((resolve: () => void): void => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address: AddressInfo | string | null = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  const write = async (text: string): Promise<void> => sendChunk(await arrived.promise, text);

  const end = async (): Promise<void> => {
    const response = await arrived.promise;

    response.end();
  };

  const close = async (): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolve: () => void): void => {
      server.close((): void => resolve());
    });
  };

  const stream: NdjsonStream = {
    url: `http://127.0.0.1:${port}/ai-fill`,
    bodies,
    write,
    end,
    isAborted: (): boolean => isAborted,
    close
  };

  return stream;
};
